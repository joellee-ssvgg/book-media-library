"use server";

import { createCookieSupabaseClient } from "@/lib/supabase/auth";

const STATUS_DONE_TEXT = {
  finished: "读完了",
  watched: "看完了",
};
const STATUS_TEXT = {
  want_to_read: "想读",
  reading: "在读",
  finished: "读完了",
  abandoned: "弃读",
  want_to_watch: "想看",
  watching: "在看",
  watched: "看完了",
};

function relativeTime(value) {
  if (!value) return "";
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(value).toISOString().slice(0, 10);
}

// 把一条 private_activity_log 事件翻译成一行「痕迹」。kind ∈ book/movie/read/note。
function describe(row) {
  const title = row.works?.canonical_title ?? "未知作品";
  const isMovie = row.works?.media_type === "movie";
  const media = isMovie ? "影视" : "图书";
  const mediaKind = isMovie ? "movie" : "book";
  const payload = row.payload_json ?? {};

  switch (row.event_type) {
    case "entry_created":
      return { kind: mediaKind, tag: media, text: `添加${media}《${title}》` };
    case "entry_completed":
      return { kind: mediaKind, tag: media, text: `${isMovie ? "看完了" : "读完了"}《${title}》` };
    case "entry_archived":
      return { kind: mediaKind, tag: media, text: `归档了《${title}》` };
    case "status_changed": {
      const status = payload.status ?? payload.to ?? payload.new_status;
      const verb = STATUS_DONE_TEXT[status] ?? `标记为${STATUS_TEXT[status] ?? "新状态"}`;
      return { kind: mediaKind, tag: media, text: `${verb}《${title}》` };
    }
    case "session_logged":
    case "progress_updated": {
      const pages = payload.pages ?? payload.delta_pages ?? payload.page_count ?? payload.pages_read;
      return { kind: "read", tag: "阅读", text: pages ? `阅读了 ${pages} 页《${title}》` : `记录了阅读《${title}》` };
    }
    case "review_added":
    case "review_edited":
      return { kind: "note", tag: "笔记", text: `写了短评《${title}》` };
    case "rating_added":
      return { kind: "note", tag: "笔记", text: `给《${title}》评了分` };
    default:
      return { kind: mediaKind, tag: media, text: `更新了《${title}》` };
  }
}

export async function loadRecentActivity() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { items: [] };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { items: [] };
  }

  const { data } = await supabase
    .from("private_activity_log")
    .select("id, event_type, occurred_at, payload_json, works(canonical_title, media_type)")
    .order("occurred_at", { ascending: false })
    .limit(10);

  const items = (data ?? []).map((row) => {
    const described = describe(row);
    return { id: row.id, time: relativeTime(row.occurred_at), ...described };
  });

  return { items };
}
