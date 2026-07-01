"use server";

import { createActionSupabase } from "@/lib/supabase/server";

// year/month may be null to request the current month (resolved server-side in
// the profile's timezone).
export async function fetchReadingTraces(year = null, month = null) {
  const y = year == null ? null : Number(year);
  const m = month == null ? null : Number(month);
  if (
    (y != null && !Number.isInteger(y)) ||
    (m != null && (!Number.isInteger(m) || m < 1 || m > 12))
  ) {
    return { error: "无效的年月。", data: null };
  }

  const supabase = await createActionSupabase();
  if ("error" in supabase) {
    return { error: supabase.error, data: null };
  }

  const { data, error } = await supabase.client.rpc("get_reading_traces", {
    input_year: y,
    input_month: m,
  });
  if (error) {
    return { error: error.message, data: null };
  }
  return { error: null, data: data ?? null };
}
