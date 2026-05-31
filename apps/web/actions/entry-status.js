"use server";

import { createActionSupabase } from "@/lib/supabase/server";

export async function setEntryStatus(entryId, status) {
  if (!entryId || !status) return { error: "缺少参数。", data: null };

  const supabase = await createActionSupabase();
  if ("error" in supabase) {
    return { error: supabase.error, data: null };
  }

  const { data, error } = await supabase.client.rpc("set_entry_status", {
    input_entry_id: entryId,
    input_status: status,
  });
  if (error) {
    return { error: error.message, data: null };
  }
  return { error: null, data };
}

export async function deleteEntry(entryId) {
  if (!entryId) return { error: "缺少参数。", data: null };

  const supabase = await createActionSupabase();
  if ("error" in supabase) {
    return { error: supabase.error, data: null };
  }

  const { data, error } = await supabase.client.rpc("task33_soft_delete_entry", {
    input_entry_id: entryId,
  });
  if (error) {
    return { error: error.message, data: null };
  }
  return { error: null, data };
}
