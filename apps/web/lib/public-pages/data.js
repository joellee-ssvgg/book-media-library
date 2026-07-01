import { createAnonymousSupabase } from "@/lib/supabase/server";
function anonymousClient() {
    const supabase = createAnonymousSupabase();
    if ("error" in supabase) {
        throw new Error(supabase.error);
    }
    return supabase.client;
}
export async function getPublicProfile(username) {
    const { data, error } = await anonymousClient().rpc("task17_get_public_profile", {
        input_username: username,
    });
    if (error) {
        throw new Error(error.message);
    }
    return data ?? { status: "not_found" };
}
export async function getPublicList(listId) {
    const { data, error } = await anonymousClient().rpc("task34_get_public_list", {
        input_list_id: listId,
    });
    if (error) {
        throw new Error(error.message);
    }
    return data ?? { status: "not_found" };
}
export async function getPublicWork(workId, slug) {
    const { data, error } = await anonymousClient().rpc("task17_get_public_work", {
        input_work_id: workId,
        input_slug: slug,
    });
    if (error) {
        throw new Error(error.message);
    }
    return data ?? { status: "not_found" };
}
