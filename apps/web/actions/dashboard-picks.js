"use server";

import { createCookieSupabaseClient } from "@/lib/supabase/auth";
import { slugifyTitle } from "@/lib/public-pages/slug";

// 「下一本读这个 / 从推荐开始」的真实来源：你的想读 / 想看队列（最近更新优先）。
export async function loadNextPicks() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { picks: [] };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { picks: [] };
  }

  const { data } = await supabase
    .from("user_entries")
    .select("status, work_id, works!inner(canonical_title, media_type, first_release_year), editions(cover_url)")
    .in("status", ["want_to_read", "want_to_watch"])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(12);

  const picks = (data ?? []).map((row) => {
    const isMovie = row.works?.media_type === "movie";
    const title = row.works?.canonical_title ?? "未命名作品";
    return {
      title,
      media_type: row.works?.media_type ?? "book",
      year: row.works?.first_release_year ?? null,
      cover_url: row.editions?.cover_url ?? "",
      href: `/w/${row.work_id}/${slugifyTitle(title)}`,
      status: row.status,
      provider: isMovie ? "想看清单" : "想读清单",
      subtitle: isMovie ? "在你的想看清单里，挑个晚上看吧。" : "在你的想读清单里，挑段时间翻开吧。",
      progress_percent: 0,
    };
  });

  return { picks };
}
