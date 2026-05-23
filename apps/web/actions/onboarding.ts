"use server";

import { genericCsvToImportPayload } from "@/lib/import/generic-csv";
import { mspfToImportPayload } from "@/lib/mspf/validate";
import { createActionSupabase } from "@/lib/supabase/server";
import {
  completeOnboardingFormSchema,
  onboardingImportFormSchema,
  type ImportActionState,
  type OnboardingActionState,
} from "@/schemas/onboarding";

type CompleteOnboardingRpcPayload = {
  status: "completed";
  profile_id: string;
  username: string;
  favorite_count: number;
  created_count: number;
};

type EnqueueImportRpcPayload = {
  status: "queued";
  job_id: string;
  source: "csv" | "mspf";
};

function toOnboardingFieldErrors(
  result: ReturnType<typeof completeOnboardingFormSchema.safeParse>,
) {
  return result.success ? undefined : result.error.flatten().fieldErrors;
}

function toImportFieldErrors(result: ReturnType<typeof onboardingImportFormSchema.safeParse>) {
  return result.success ? undefined : result.error.flatten().fieldErrors;
}

function favoriteFromForm(formData: FormData, index: number) {
  const title = formData.get(`favoriteTitle${index}`);
  const mediaType = formData.get(`favoriteMediaType${index}`);
  const status = formData.get(`favoriteStatus${index}`);

  if (typeof title !== "string" || title.trim() === "") {
    return null;
  }

  return {
    media_type: mediaType === "movie" ? "movie" : "book",
    canonical_title: title,
    status: typeof status === "string" && status.trim() ? status : undefined,
  };
}

async function readUploadPayload(formData: FormData, source: "csv" | "mspf") {
  const file = formData.get("historyFile");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("请选择要导入的 CSV 或 MSPF 文件。");
  }

  if (file.size > 2_000_000) {
    throw new Error("导入文件不能超过 2MB。");
  }

  const text = await file.text();

  if (source === "csv") {
    return genericCsvToImportPayload(text, file.name);
  }

  return mspfToImportPayload(JSON.parse(text) as unknown, file.name);
}

export async function completeOnboardingAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const favorites = [1, 2, 3]
    .map((index) => favoriteFromForm(formData, index))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const parsed = completeOnboardingFormSchema.safeParse({
    accessToken: formData.get("accessToken"),
    username: formData.get("username"),
    displayName: formData.get("displayName") || undefined,
    avatarUrl: formData.get("avatarUrl") || undefined,
    favorites,
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "onboarding 表单未通过校验。",
      fieldErrors: toOnboardingFieldErrors(parsed),
    };
  }

  const { accessToken, ...input } = parsed.data;
  const supabase = await createActionSupabase(accessToken);

  if ("error" in supabase) {
    return {
      status: "config_error",
      message: supabase.error,
    };
  }

  const { data, error } = await supabase.client.rpc<CompleteOnboardingRpcPayload>(
    "task14_complete_onboarding",
    {
      input_username: input.username,
      input_display_name: input.displayName ?? null,
      input_avatar_url: input.avatarUrl || null,
      input_favorites_json: input.favorites,
    },
  );

  if (error) {
    return {
      status: "db_error",
      message: error.message,
    };
  }

  if (!data) {
    return {
      status: "db_error",
      message: "task14_complete_onboarding 没有返回结果。",
    };
  }

  return {
    status: "completed",
    message: "onboarding 已完成。",
    profileId: data.profile_id,
    username: data.username,
    createdCount: data.created_count,
  };
}

export async function enqueueOnboardingImportAction(
  _previousState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const parsed = onboardingImportFormSchema.safeParse({
    accessToken: formData.get("accessToken"),
    importSource: formData.get("importSource"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "导入表单未通过校验。",
      fieldErrors: toImportFieldErrors(parsed),
    };
  }

  let payload: Awaited<ReturnType<typeof readUploadPayload>>;

  try {
    payload = await readUploadPayload(formData, parsed.data.importSource);
  } catch (error) {
    return {
      status: "validation_error",
      message: error instanceof Error ? error.message : "导入文件无法解析。",
    };
  }

  const supabase = await createActionSupabase(parsed.data.accessToken);

  if ("error" in supabase) {
    return {
      status: "config_error",
      message: supabase.error,
    };
  }

  const { data, error } = await supabase.client.rpc<EnqueueImportRpcPayload>(
    "task14_enqueue_import_job",
    {
      input_source: parsed.data.importSource,
      input_payload_json: payload,
      input_config_json: {
        source_file_name: payload.source_file_name,
        item_count: payload.items.length,
      },
    },
  );

  if (error) {
    return {
      status: "db_error",
      message: error.message,
    };
  }

  if (!data) {
    return {
      status: "db_error",
      message: "task14_enqueue_import_job 没有返回结果。",
    };
  }

  return {
    status: "queued",
    message: "导入 job 已入队。",
    jobId: data.job_id,
    source: data.source,
  };
}
