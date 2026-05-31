"use server";

import { createActionSupabase } from "@/lib/supabase/server";

export async function getEntryReadingProgress(entryId) {
  if (!entryId) return { error: "缺少条目。", data: null };

  const supabase = await createActionSupabase();
  if ("error" in supabase) {
    return { error: supabase.error, data: null };
  }

  const { data, error } = await supabase.client.rpc("get_entry_reading_progress", {
    input_entry_id: entryId,
  });
  if (error) {
    return { error: error.message, data: null };
  }
  return { error: null, data: data ?? { current_page: null, total_pages: null } };
}

export async function logReadingPages(entryId, currentPage, totalPages = null) {
  if (!entryId) return { error: "缺少条目。", data: null };

  const page = Number(currentPage);
  if (!Number.isInteger(page) || page < 1) {
    return { error: "请输入有效的页码。", data: null };
  }
  const total = totalPages == null || totalPages === "" ? null : Number(totalPages);
  if (total != null && (!Number.isInteger(total) || total < page)) {
    return { error: "总页数不能小于当前页码。", data: null };
  }

  const supabase = await createActionSupabase();
  if ("error" in supabase) {
    return { error: supabase.error, data: null };
  }

  const { data, error } = await supabase.client.rpc("log_reading_pages", {
    input_entry_id: entryId,
    input_current_page: page,
    input_total_pages: total,
  });
  if (error) {
    return { error: error.message, data: null };
  }
  return { error: null, data };
}
