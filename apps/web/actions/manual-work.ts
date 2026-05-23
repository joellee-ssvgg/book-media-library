"use server";

import { createActionSupabase } from "@/lib/supabase/server";
import {
  manualWorkFormSchema,
  type DuplicateCandidate,
  type ManualWorkActionState,
} from "@/schemas/manual-work";

type CreateManualWorkRpcPayload =
  | {
      status: "created";
      work_id: string;
      default_edition_id: string;
      candidates: DuplicateCandidate[];
    }
  | {
      status: "duplicate_found";
      candidates: DuplicateCandidate[];
    };

function readFormData(formData: FormData) {
  return {
    accessToken: formData.get("accessToken"),
    mediaType: formData.get("mediaType"),
    title: formData.get("title"),
    year: formData.get("year"),
    originalTitle: formData.get("originalTitle"),
    originalLanguage: formData.get("originalLanguage"),
    externalSource: formData.get("externalSource"),
    externalId: formData.get("externalId"),
    dedupOverride: formData.get("dedupOverride") === "on",
    dedupSkippedReason: formData.get("dedupSkippedReason"),
  };
}

function toFieldErrors(error: ReturnType<typeof manualWorkFormSchema.safeParse>) {
  if (error.success) {
    return undefined;
  }

  return error.error.flatten().fieldErrors;
}

export async function createManualWorkAction(
  _previousState: ManualWorkActionState,
  formData: FormData,
): Promise<ManualWorkActionState> {
  const parsed = manualWorkFormSchema.safeParse(readFormData(formData));

  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "表单数据未通过校验。",
      fieldErrors: toFieldErrors(parsed),
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

  const { data, error } =
    await supabase.client.rpc<CreateManualWorkRpcPayload>("create_manual_work", {
      input_media_type: input.mediaType,
      input_title: input.title,
      input_year: input.year ?? null,
      input_original_title: input.originalTitle ?? null,
      input_original_language: input.originalLanguage ?? null,
      input_external_source: input.externalSource ?? null,
      input_external_id: input.externalId ?? null,
      input_dedup_override: input.dedupOverride,
      input_dedup_skipped_reason: input.dedupSkippedReason ?? null,
    });

  if (error) {
    return {
      status: "db_error",
      message: error.message,
    };
  }

  if (!data) {
    return {
      status: "db_error",
      message: "create_manual_work 没有返回结果。",
    };
  }

  const payload = data;

  if (payload.status === "duplicate_found") {
    return {
      status: "duplicate_found",
      message: "发现可能重复的作品。",
      candidates: payload.candidates,
    };
  }

  return {
    status: "created",
    message: "作品已创建，并自动生成默认版本。",
    candidates: payload.candidates,
    workId: payload.work_id,
    defaultEditionId: payload.default_edition_id,
  };
}
