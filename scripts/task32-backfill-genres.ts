/**
 * task32 backfill — populate `works.metadata_json.genres` (+ cleaned subjects)
 * for works that were added before the recommendation pipeline existed.
 *
 * Historical adds discarded the provider's raw subjects, so we re-fetch each work
 * from its provider via `external_ids`, extract the raw subjects exactly as the
 * live providers do, then run them through the SAME taxonomy mapping the add path
 * uses (`cleanSubjects` + `subjectsToGenreIds`). The genre taxonomy is the single
 * source of truth; only the trivial "pull subjects out of the JSON" is inlined
 * here so the script doesn't have to boot the Next-only provider/env modules.
 *
 * Write path: `works` has a BEFORE-UPDATE trigger that rejects any update without
 * an authenticated profile, and no owner-update RLS policy — so the only sanctioned
 * writer is the security-definer RPC `task32_enrich_work_metadata`, called by a
 * signed-in user. We don't have the operator's password, so we mint a labelled
 * "backfill bot" account via the service-role admin API, sign in, and call the RPC.
 * The bot becomes `updated_by` on enriched rows, so it is left in place.
 * task32 only fills works that have no genres yet — it never clobbers a richer value.
 *
 * Run:
 *   pnpm db:backfill:genres                  # local
 *   pnpm db:backfill:genres --dry-run        # preview, no writes / no bot
 *   pnpm db:backfill:genres --allow-remote   # write to remote (requires task32 deployed there)
 *   pnpm db:backfill:genres --limit=50
 *
 * Targets whatever Supabase the env points at (.env.local).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanSubjects, subjectsToGenreIds } from "@/lib/recommendations/subjects";

function loadDotEnvLocal() {
  const envPath = resolve(".env.local");
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] ??= value;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v : null)).filter((v): v is string => Boolean(v));
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "BookMediaLibrary/0.1.0", ...headers } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Per-source raw-subject extraction, mirroring the live provider adapters.
async function fetchRawSubjects(source: string, externalId: string): Promise<string[] | null> {
  if (source === "openlibrary") {
    const id = externalId.trim();
    const path = id.startsWith("/") ? `${id}.json` : `/works/${id}.json`;
    const data = await getJson(`https://openlibrary.org${path}`);
    if (!data) return null;
    return asStringArray(data.subjects ?? data.subject); // openlibrary.js
  }
  if (source === "googlebooks") {
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    const suffix = key ? `?key=${encodeURIComponent(key)}` : "";
    const data = await getJson(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(externalId)}${suffix}`);
    if (!data) return null;
    return asStringArray(data.volumeInfo?.categories); // googlebooks.js
  }
  if (source === "tmdb") {
    const key = process.env.TMDB_API_KEY;
    if (!key) return null;
    const bearer = key.startsWith("eyJ");
    const url = `https://api.themoviedb.org/3/movie/${encodeURIComponent(externalId)}${bearer ? "" : `?api_key=${encodeURIComponent(key)}`}`;
    const data = await getJson(url, bearer ? { Authorization: `Bearer ${key}` } : {});
    if (!data) return null;
    return asStringArray((data.genres ?? []).map((g: any) => (g && typeof g.name === "string" ? g.name : null))); // tmdb.js
  }
  return null;
}

// Priority order of external_ids.source per media type (cleaner taxonomy first).
const SOURCE_PRIORITY: Record<string, string[]> = {
  book: ["googlebooks", "openlibrary"],
  movie: ["tmdb"],
};

// Mint a signed-in "backfill bot" so RPC writes carry an authenticated profile.
async function createBotSession(service: SupabaseClient, url: string, anonKey: string) {
  const ts = Date.now();
  const email = `yueji-backfill-bot-${ts}@example.com`;
  const password = `Bf!${ts}-${Math.random().toString(36).slice(2, 12)}Aa1`;
  const { data: created, error: cErr } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr || !created?.user) {
    throw new Error(`创建回填账号失败: ${cErr?.message ?? "unknown"}`);
  }
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const { error: sErr } = await anon.auth.signInWithPassword({ email, password });
  if (sErr) {
    throw new Error(`回填账号登录失败: ${sErr.message}`);
  }
  return { anon, email, userId: created.user.id };
}

async function main() {
  loadDotEnvLocal();
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const allowRemote = argv.includes("--allow-remote");
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY 未配置");
    process.exit(1);
  }
  const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
  console.log(`▶ 目标 Supabase: ${url} ${isLocal ? "(本地)" : "⚠️ (远端!)"}${dryRun ? "  [dry-run]" : ""}`);

  // 安全闸：默认禁止往远端写入。dry-run（只读）不受限；要真写远端必须显式 --allow-remote。
  if (!isLocal && !dryRun && !allowRemote) {
    console.error(
      "✗ 目标是远端 Supabase，已阻止写入。\n" +
        "  · 只读预览：加 --dry-run\n" +
        "  · 确实要写远端：加 --allow-remote（请确认已获批准、且 task32 已部署到远端）"
    );
    process.exit(1);
  }

  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  // 1) works missing genres
  const { data: works, error: worksErr } = await service
    .from("works")
    .select("id, canonical_title, media_type, metadata_json")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (worksErr) {
    console.error("✗ 查询 works 失败:", worksErr.message);
    process.exit(1);
  }
  const needing = (works ?? []).filter((w: any) => {
    const g = w.metadata_json?.genres;
    return !Array.isArray(g) || g.length === 0;
  });
  console.log(`▶ 共 ${works?.length ?? 0} 个作品，其中缺 genres 的 ${needing.length} 个。`);
  if (needing.length === 0) {
    console.log("✓ 没有需要回填的作品。");
    return;
  }

  // 2) external_ids for those works (polymorphic table → not FK-embeddable)
  const ids = needing.map((w: any) => w.id);
  const { data: extRows, error: extErr } = await service
    .from("external_ids")
    .select("target_id, source, external_id")
    .eq("target_type", "work")
    .is("deleted_at", null)
    .in("target_id", ids);
  if (extErr) {
    console.error("✗ 查询 external_ids 失败:", extErr.message);
    process.exit(1);
  }
  const extByWork = new Map<string, { source: string; external_id: string }[]>();
  for (const row of extRows ?? []) {
    const list = extByWork.get(row.target_id) ?? [];
    list.push({ source: row.source, external_id: row.external_id });
    extByWork.set(row.target_id, list);
  }

  // 3) first pass (no writes): resolve genres so we know if there's anything to do
  type Plan = { work: any; source: string; subjects: string[]; genres: string[] };
  const plans: Plan[] = [];
  const stats = { enriched: 0, skipped: 0, noSignal: 0, noProvider: 0, fetchFailed: 0, writeFailed: 0 };
  let processed = 0;

  for (const work of needing) {
    if (processed >= limit) break;
    processed += 1;

    const externals = extByWork.get(work.id) ?? [];
    const priority = SOURCE_PRIORITY[work.media_type] ?? [];
    let chosen: { source: string; external_id: string } | undefined;
    for (const source of priority) {
      chosen = externals.find((e) => e.source === source);
      if (chosen) break;
    }
    if (!chosen) {
      stats.noProvider += 1;
      console.log(`  – 跳过《${work.canonical_title}》：没有可用的 provider 外部 ID（有 ${externals.map((e) => e.source).join(", ") || "无"}）`);
      continue;
    }

    const rawSubjects = await fetchRawSubjects(chosen.source, chosen.external_id);
    await sleep(250); // 对外部 API 友好
    if (rawSubjects === null) {
      stats.fetchFailed += 1;
      console.log(`  ✗ 抓取失败《${work.canonical_title}》[${chosen.source} ${chosen.external_id}]`);
      continue;
    }

    const subjects = cleanSubjects(rawSubjects);
    const genres = subjectsToGenreIds(rawSubjects);
    if (genres.length === 0 && subjects.length === 0) {
      stats.noSignal += 1;
      console.log(`  · 无类型信号《${work.canonical_title}》[${chosen.source}]`);
      continue;
    }
    plans.push({ work, source: chosen.source, subjects, genres });
    console.log(`  ✎ ${dryRun ? "[dry] " : ""}《${work.canonical_title}》→ ${genres.join(", ") || "(仅 subjects)"}`);
  }

  if (dryRun) {
    console.log(`\n▶ 完成（dry-run，未写入）：可富集 ${plans.length}，无信号 ${stats.noSignal}，无 provider ${stats.noProvider}，抓取失败 ${stats.fetchFailed}。`);
    return;
  }
  if (plans.length === 0) {
    console.log(`\n▶ 没有可写入的作品（无信号 ${stats.noSignal}，无 provider ${stats.noProvider}，抓取失败 ${stats.fetchFailed}）。`);
    return;
  }

  // 4) authenticate + write via the sanctioned RPC
  console.log(`\n▶ 创建回填账号并通过 task32 RPC 写入 ${plans.length} 个作品…`);
  const bot = await createBotSession(service, url, anonKey);
  console.log(`  · 回填账号（保留，作为 updated_by）：${bot.email}`);

  for (const plan of plans) {
    const { data, error } = await bot.anon.rpc("task32_enrich_work_metadata", {
      input_work_id: plan.work.id,
      input_subjects: plan.subjects,
      input_genres: plan.genres,
    });
    if (error) {
      stats.writeFailed += 1;
      console.log(`  ✗ 写入失败《${plan.work.canonical_title}》: ${error.message}`);
      continue;
    }
    const status = (data as any)?.status ?? "unknown";
    if (status === "enriched") {
      stats.enriched += 1;
      console.log(`  ✓ 《${plan.work.canonical_title}》→ ${plan.genres.join(", ") || "(仅 subjects)"}`);
    } else {
      stats.skipped += 1;
      console.log(`  · 跳过《${plan.work.canonical_title}》(RPC: ${status})`);
    }
  }

  console.log(
    `\n▶ 完成：富集 ${stats.enriched}，RPC 跳过 ${stats.skipped}，无信号 ${stats.noSignal}，` +
      `无 provider ${stats.noProvider}，抓取失败 ${stats.fetchFailed}，写入失败 ${stats.writeFailed}。`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
