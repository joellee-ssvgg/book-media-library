"use server";

import { createCookieSupabaseClient } from "@/lib/supabase/auth";
import { createTmdbMovieProvider } from "@/lib/providers/tmdb";
import { addMovieEntryAction } from "@/actions/movie-add";
import { addBookEntryAction } from "@/actions/book-add";
import { OL_SUBJECT_SLUG, genreLabel } from "@/lib/recommendations/genres";

const movieProvider = createTmdbMovieProvider();

const MAX_SEEDS = 6; // 最多用几部库内电影当种子（= TMDB 调用次数上限）
const MAX_RESULTS = 12;
const MAX_BECAUSE = 2; // 每张卡最多展示几个「因为…」来源

// 「为你推荐 · 影视」：拿库里的电影当种子，问 TMDB「看过这部的人也喜欢」，
// 跨种子聚合（被多个种子推荐的排前），剔除已在库里的，按 命中数→评分→热度 排序。
export async function loadMovieRecommendationsAction() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { status: "error", items: [] };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", items: [] };
  }

  // 1) 库里的电影作品（任意状态都可当种子：想看 Inception 也算「对它感兴趣」）
  const { data: entries } = await supabase
    .from("user_entries")
    .select("updated_at, works!inner(id, canonical_title, media_type)")
    .eq("works.media_type", "movie")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  const workIds = [...new Set((entries ?? []).map((e) => e.works?.id).filter(Boolean))];
  if (workIds.length === 0) {
    return { status: "empty", items: [] };
  }

  // 2) 这些作品的 TMDB 外部 ID（external_ids 是多态表，单独查）
  const { data: extRows } = await supabase
    .from("external_ids")
    .select("target_id, external_id")
    .eq("target_type", "work")
    .eq("source", "tmdb")
    .is("deleted_at", null)
    .in("target_id", workIds);

  const titleByWork = new Map();
  for (const e of entries ?? []) {
    if (e.works?.id) titleByWork.set(e.works.id, e.works.canonical_title ?? "");
  }
  const tmdbByWork = new Map();
  for (const row of extRows ?? []) {
    if (!tmdbByWork.has(row.target_id)) tmdbByWork.set(row.target_id, row.external_id);
  }

  // 种子：按最近更新去重，封顶 MAX_SEEDS；库内 TMDB id 全集用于剔除
  const inLibrary = new Set();
  const seeds = [];
  const seenSeed = new Set();
  for (const workId of workIds) {
    const tmdbId = tmdbByWork.get(workId);
    if (!tmdbId) continue;
    inLibrary.add(String(tmdbId));
    if (!seenSeed.has(tmdbId) && seeds.length < MAX_SEEDS) {
      seenSeed.add(tmdbId);
      seeds.push({ tmdbId: String(tmdbId), title: titleByWork.get(workId) ?? "" });
    }
  }
  if (seeds.length === 0) {
    return { status: "empty", items: [] };
  }

  // 3) 并发拉取每个种子的推荐
  const settled = await Promise.allSettled(seeds.map((s) => movieProvider.recommendations(s.tmdbId)));

  // 4) 聚合
  const agg = new Map(); // tmdbId -> { record, count, because:Set, vote, pop }
  settled.forEach((res, i) => {
    if (res.status !== "fulfilled" || !res.value?.ok) return;
    const seedTitle = seeds[i].title;
    for (const rec of res.value.value) {
      const id = String(rec.externalId);
      if (!id || inLibrary.has(id) || rec.adult) continue;
      const existing = agg.get(id);
      if (existing) {
        existing.count += 1;
        if (seedTitle) existing.because.add(seedTitle);
      } else {
        agg.set(id, {
          record: rec,
          count: 1,
          because: new Set(seedTitle ? [seedTitle] : []),
          vote: rec.voteAverage ?? 0,
          pop: rec.popularity ?? 0,
        });
      }
    }
  });

  const items = [...agg.values()]
    .sort((a, b) => b.count - a.count || b.vote - a.vote || b.pop - a.pop)
    .slice(0, MAX_RESULTS)
    .map((c) => ({
      tmdbId: String(c.record.externalId),
      title: c.record.title,
      year: c.record.releaseYear ?? null,
      posterUrl: c.record.coverUrl ?? "",
      because: [...c.because].slice(0, MAX_BECAUSE),
    }));

  return { status: items.length ? "ok" : "empty", items };
}

// 把一部推荐电影加入「想看」。复用完整的 task15 + task32 富集管线（cookie 鉴权）。
export async function addRecommendedMovieAction(tmdbId) {
  if (!tmdbId) {
    return { status: "validation_error", message: "缺少 TMDB id。" };
  }
  const formData = new FormData();
  formData.set("provider", "tmdb");
  formData.set("externalId", String(tmdbId));
  formData.set("status", "want_to_watch");
  return addMovieEntryAction(null, formData);
}

const MAX_GENRE_SEEDS = 4; // 用库里最高频的几个类型当推荐入口（= OL 调用次数上限）
const OL_PER_SUBJECT = 24;

// 归一化标题用于「库里已有」排除（去掉大小写/标点/空格，保留中英文与数字）。
function normTitle(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "");
}

async function fetchOlSubject(slug, limit) {
  try {
    const res = await fetch(`https://openlibrary.org/subjects/${slug}.json?limit=${limit}`, {
      headers: { Accept: "application/json", "User-Agent": "BookMediaLibrary/0.1.0" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.works) ? data.works : [];
  } catch {
    return [];
  }
}

// 「为你推荐 · 图书」：统计库内图书的高频规范类型，按类型浏览 OpenLibrary
// `/subjects/{slug}.json` 取库外新书，剔除已在库的（按 OL key 或归一化标题），
// 被多个 top 类型同时命中的排前，再按版本数（热度近似）排序。
export async function loadBookRecommendationsAction() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { status: "error", items: [] };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", items: [] };
  }

  const { data: entries } = await supabase
    .from("user_entries")
    .select("works!inner(id, canonical_title, media_type, metadata_json)")
    .eq("works.media_type", "book")
    .is("deleted_at", null)
    .limit(500);

  const seenWork = new Set();
  const genreCount = new Map();
  const inLibraryTitles = new Set();
  for (const e of entries ?? []) {
    const w = e.works;
    if (!w?.id || seenWork.has(w.id)) continue;
    seenWork.add(w.id);
    inLibraryTitles.add(normTitle(w.canonical_title));
    const genres = Array.isArray(w.metadata_json?.genres) ? w.metadata_json.genres : [];
    for (const g of genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
  }
  if (seenWork.size === 0) {
    return { status: "empty", items: [] };
  }

  const topGenres = [...genreCount.entries()]
    .filter(([id]) => OL_SUBJECT_SLUG[id])
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_GENRE_SEEDS)
    .map(([id]) => id);
  if (topGenres.length === 0) {
    return { status: "empty", items: [] };
  }

  // 库内 OpenLibrary work key，用于排除已有
  const { data: extRows } = await supabase
    .from("external_ids")
    .select("external_id")
    .eq("target_type", "work")
    .eq("source", "openlibrary")
    .is("deleted_at", null)
    .in("target_id", [...seenWork]);
  const inLibraryKeys = new Set((extRows ?? []).map((r) => r.external_id));

  const lists = await Promise.all(topGenres.map((id) => fetchOlSubject(OL_SUBJECT_SLUG[id], OL_PER_SUBJECT)));

  // 每个类型各自一份候选（剔除已在库、类型内去重，按版本数降序）
  const perGenre = topGenres.map((genreId, i) =>
    (lists[i] ?? [])
      .filter((w) => {
        const key = w?.key;
        return key && !inLibraryKeys.has(key) && !inLibraryTitles.has(normTitle(w.title));
      })
      .map((w) => ({
        olKey: w.key,
        title: w.title ?? "未命名",
        author: (w.authors ?? [])[0]?.name ?? "",
        coverUrl: w.cover_id ? `https://covers.openlibrary.org/b/id/${w.cover_id}-M.jpg` : "",
        editions: w.edition_count ?? 0,
        genreId,
      }))
      .filter((it, idx, arr) => arr.findIndex((x) => x.olKey === it.olKey) === idx)
      .sort((a, b) => b.editions - a.editions)
  );

  // 一本书被哪些 top 类型命中（用于「因为…」标签）
  const becauseByKey = new Map();
  for (const list of perGenre) {
    for (const it of list) {
      const set = becauseByKey.get(it.olKey) ?? new Set();
      set.add(genreLabel(it.genreId));
      becauseByKey.set(it.olKey, set);
    }
  }

  // 轮转取（每个类型轮流出一本），保证高频类型如「科技/计算机」不被文学经典的高版本数淹没
  const cursors = perGenre.map(() => 0);
  const taken = new Set();
  const items = [];
  let progressed = true;
  while (items.length < MAX_RESULTS && progressed) {
    progressed = false;
    for (let i = 0; i < perGenre.length && items.length < MAX_RESULTS; i += 1) {
      const list = perGenre[i];
      while (cursors[i] < list.length && taken.has(list[cursors[i]].olKey)) cursors[i] += 1;
      if (cursors[i] >= list.length) continue;
      const it = list[cursors[i]];
      cursors[i] += 1;
      taken.add(it.olKey);
      items.push({
        olKey: it.olKey,
        title: it.title,
        author: it.author,
        coverUrl: it.coverUrl,
        because: [...(becauseByKey.get(it.olKey) ?? [])].slice(0, MAX_BECAUSE),
      });
      progressed = true;
    }
  }

  return { status: items.length ? "ok" : "empty", items };
}

// 把一本推荐书加入「想读」。复用 task14 + task32 富集管线（cookie 鉴权）。
export async function addRecommendedBookAction(olKey) {
  if (!olKey) {
    return { status: "validation_error", message: "缺少 OpenLibrary key。" };
  }
  const formData = new FormData();
  formData.set("provider", "openlibrary");
  formData.set("externalId", String(olKey));
  formData.set("status", "want_to_read");
  return addBookEntryAction(null, formData);
}
