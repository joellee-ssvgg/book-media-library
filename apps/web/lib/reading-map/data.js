import { createActionSupabase } from "@/lib/supabase/server";

export async function getReadingMapData(accessToken) {
  const supabase = await createActionSupabase(accessToken);
  if ("error" in supabase) {
    return { error: supabase.error, data: null };
  }

  const { data, error } = await supabase.client.rpc("get_reading_map_countries");
  if (error) {
    return { error: error.message, data: null };
  }

  if (!data) {
    return {
      error: null,
      data: { country_counts: {}, entries: [] },
    };
  }

  return { error: null, data };
}
