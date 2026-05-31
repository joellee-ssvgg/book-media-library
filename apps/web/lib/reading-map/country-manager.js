import { createActionSupabase } from "@/lib/supabase/server";

export async function addBookCountry(accessToken, entryId, countryCode, countryName) {
  const supabase = await createActionSupabase(accessToken);
  if ("error" in supabase) {
    return { ok: false, error: supabase.error };
  }

  const { data, error } = await supabase.client.rpc("add_book_country", {
    input_entry_id: entryId,
    input_country_code: countryCode,
    input_country_name: countryName,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return data || { ok: false, error: "no response" };
}

export async function removeBookCountry(accessToken, entryId, countryCode) {
  const supabase = await createActionSupabase(accessToken);
  if ("error" in supabase) {
    return { ok: false, error: supabase.error };
  }

  const { data, error } = await supabase.client.rpc("remove_book_country", {
    input_entry_id: entryId,
    input_country_code: countryCode,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return data || { ok: false, error: "no response" };
}
