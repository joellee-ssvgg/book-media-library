import { createAnonymousSupabase } from "@/lib/supabase/server";
import type { PublicProfileData, PublicWorkData } from "@/schemas/public-pages";

function anonymousClient() {
  const supabase = createAnonymousSupabase();

  if ("error" in supabase) {
    throw new Error(supabase.error);
  }

  return supabase.client;
}

export async function getPublicProfile(username: string): Promise<PublicProfileData> {
  const { data, error } = await anonymousClient().rpc<PublicProfileData>(
    "task17_get_public_profile",
    {
      input_username: username,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data ?? { status: "not_found" };
}

export async function getPublicWork(workId: string, slug: string): Promise<PublicWorkData> {
  const { data, error } = await anonymousClient().rpc<PublicWorkData>(
    "task17_get_public_work",
    {
      input_work_id: workId,
      input_slug: slug,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data ?? { status: "not_found" };
}
