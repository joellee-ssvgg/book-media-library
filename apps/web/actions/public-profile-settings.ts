"use server";

import { createActionSupabase } from "@/lib/supabase/server";
import {
  publicProfileSettingsFormSchema,
  type PublicProfileSettingsActionState,
} from "@/schemas/public-pages";

function toFieldErrors(result: ReturnType<typeof publicProfileSettingsFormSchema.safeParse>) {
  return result.success ? undefined : result.error.flatten().fieldErrors;
}

export async function updatePublicProfileSettingsAction(
  _previousState: PublicProfileSettingsActionState,
  formData: FormData,
): Promise<PublicProfileSettingsActionState> {
  const parsed = publicProfileSettingsFormSchema.safeParse({
    accessToken: formData.get("accessToken"),
    publicVisibility: formData.get("publicVisibility"),
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
    .filter((entryId): entryId is string => Boolean(entryId))
    .map((entry_id) => ({ entry_id }));

  const supabase = await createActionSupabase(parsed.data.accessToken);

  if ("error" in supabase) {
    return {
      status: "config_error",
      message: supabase.error,
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

  return {
    status: "updated",
    message: "公开主页设置已保存。",
  };
}
