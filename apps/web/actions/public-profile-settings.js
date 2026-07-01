"use server";
import { revalidatePath } from "next/cache";
import { createActionSupabase } from "@/lib/supabase/server";
import { publicProfileSettingsFormSchema, } from "@/schemas/public-pages";
function toFieldErrors(result) {
    return result.success ? undefined : result.error.flatten().fieldErrors;
}
export async function updatePublicProfileSettingsAction(_previousState, formData) {
    const parsed = publicProfileSettingsFormSchema.safeParse({
        accessToken: formData.get("accessToken"),
        publicVisibility: formData.get("publicVisibility"),
        username: formData.get("username"),
        displayName: formData.get("displayName"),
        bio: formData.get("bio"),
        topEntryId1: formData.get("topEntryId1"),
        topEntryId2: formData.get("topEntryId2"),
        topEntryId3: formData.get("topEntryId3"),
    });
    if (!parsed.success) {
        return {
            status: "validation_error",
            message: "公开主页设置表单未通过校验。",
            fieldErrors: toFieldErrors(parsed),
        };
    }
    const topEntries = [
        parsed.data.topEntryId1,
        parsed.data.topEntryId2,
        parsed.data.topEntryId3,
    ]
        .map((entryId) => entryId?.trim())
        .filter((entryId) => Boolean(entryId))
        .map((entry_id) => ({ entry_id }));
    const supabase = await createActionSupabase(parsed.data.accessToken);
    if ("error" in supabase) {
        return {
            status: "config_error",
            message: supabase.error,
        };
    }
    const usernameResult = await supabase.client.rpc("task30_update_username", {
        input_username: parsed.data.username,
    });
    if (usernameResult.error) {
        const raw = String(usernameResult.error.message || "");
        const friendly = raw.includes("username_taken")
            ? "这个用户名已被占用，换一个再试。"
            : raw.includes("username_invalid")
                ? "用户名只能用 3–20 位小写字母、数字或下划线。"
                : usernameResult.error.message;
        return {
            status: "db_error",
            message: friendly,
            fieldErrors: { username: [friendly] },
        };
    }
    const cardResult = await supabase.client.rpc("task29_update_profile_card", {
        input_display_name: parsed.data.displayName ?? null,
        input_bio: parsed.data.bio ?? null,
    });
    if (cardResult.error) {
        return {
            status: "db_error",
            message: cardResult.error.message,
        };
    }
    const { error } = await supabase.client.rpc("task17_update_public_profile", {
        input_public_visibility: parsed.data.publicVisibility,
        input_public_top3: topEntries,
    });
    if (error) {
        return {
            status: "db_error",
            message: error.message,
        };
    }
    revalidatePath(`/u/${parsed.data.username}`);
    return {
        status: "updated",
        message: "公开主页设置已保存。",
    };
}
