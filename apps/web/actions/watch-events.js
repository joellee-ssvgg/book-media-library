"use server";

import { revalidatePath } from "next/cache";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

async function getClientAndUser() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { error: supabase.error };
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: "请先登录后再登记观影。" };
  }
  return { supabase };
}

function monthRange(year, month) {
  const pad = (n) => String(n).padStart(2, "0");
  const start = `${year}-${pad(month)}-01`;
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  return { start, end: `${ny}-${pad(nm)}-01` };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 登记一次观影：插入 watch_event，并把库内该片顺手标成「看过」（不覆盖已有 finished_at）。
export async function logWatch({ workId, entryId = null, watchedOn, note = "" }) {
  if (!workId || !watchedOn || !DATE_RE.test(watchedOn)) {
    return { error: "缺少电影或日期。" };
  }
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from("watch_events")
    .insert({ work_id: workId, entry_id: entryId, watched_on: watchedOn, note: note?.trim() || null });
  if (error) return { error: error.message };

  // 登记即视为看过：同步库内条目状态（set_entry_status 仅在 finished_at 为空时才补，不覆盖）
  if (entryId) {
    await ctx.supabase.rpc("set_entry_status", { input_entry_id: entryId, input_status: "watched" });
  }

  revalidatePath("/maps");
  return { error: null };
}

export async function removeWatchEvent(eventId) {
  if (!eventId) return { error: "缺少参数。" };
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error };

  const { error } = await ctx.supabase.rpc("task35_remove_watch_event", { input_event_id: eventId });
  if (error) return { error: error.message };

  revalidatePath("/maps");
  return { error: null };
}

// 按月加载观影记录（关联海报），返回扁平事件 + 汇总。
export async function loadWatchMonth(year, month) {
  const ctx = await getClientAndUser();
  if (ctx.error) return { events: [], summary: { count: 0, movies: 0 } };

  const { start, end } = monthRange(year, month);
  const { data } = await ctx.supabase
    .from("watch_events")
    .select("id, watched_on, note, work_id, works(canonical_title, media_type, editions(cover_url))")
    .gte("watched_on", start)
    .lt("watched_on", end)
    .is("deleted_at", null)
    .order("watched_on", { ascending: true });

  const events = (data ?? []).map((row) => ({
    id: row.id,
    watchedOn: row.watched_on,
    day: Number(String(row.watched_on).slice(8, 10)),
    note: row.note ?? "",
    workId: row.work_id,
    title: row.works?.canonical_title ?? "未命名影片",
    coverUrl: (row.works?.editions ?? []).find((e) => e?.cover_url)?.cover_url ?? "",
  }));

  return {
    events,
    summary: { count: events.length, movies: new Set(events.map((e) => e.workId)).size },
  };
}

// 年度统计（不随当前查看的月份变化）：今年 / 本月 / 累计 / 不同影片。
export async function loadWatchStats() {
  const empty = { thisYear: 0, thisMonth: 0, total: 0, movies: 0 };
  const ctx = await getClientAndUser();
  if (ctx.error) return empty;

  const { data } = await ctx.supabase.from("watch_events").select("watched_on, work_id").is("deleted_at", null);
  const rows = data ?? [];
  const now = new Date();
  const y = String(now.getFullYear());
  const ym = `${y}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return {
    thisYear: rows.filter((r) => String(r.watched_on).startsWith(y)).length,
    thisMonth: rows.filter((r) => String(r.watched_on).startsWith(ym)).length,
    total: rows.length,
    movies: new Set(rows.map((r) => r.work_id)).size,
  };
}

// 登记弹窗的电影选择：库里的电影条目。
export async function loadLibraryMovies() {
  const ctx = await getClientAndUser();
  if (ctx.error) return { movies: [] };

  const { data } = await ctx.supabase
    .from("user_entries")
    .select("id, work_id, works!inner(canonical_title, media_type, first_release_year), editions(cover_url)")
    .eq("works.media_type", "movie")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(300);

  const seen = new Set();
  const movies = [];
  for (const row of data ?? []) {
    if (!row.work_id || seen.has(row.work_id)) continue;
    seen.add(row.work_id);
    movies.push({
      entryId: row.id,
      workId: row.work_id,
      title: row.works?.canonical_title ?? "未命名影片",
      year: row.works?.first_release_year ?? null,
      coverUrl: row.editions?.cover_url ?? "",
    });
  }
  return { movies };
}
