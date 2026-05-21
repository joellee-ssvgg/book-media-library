"use server";

import { createUserScopedSupabase } from "@/lib/supabase/server";
import {
  recordProgressFormSchema,
  type RecordProgressActionState,
} from "@/schemas/progress";

type RecordProgressRpcPayload = {
  progress_log_id: string;
  entry_id: string;
  progress_model_id: string;
  snapshot: Record<string, unknown>;
};

function parsePayloadJson(rawPayload: FormDataEntryValue | null) {
  if (typeof rawPayload !== "string" || rawPayload.trim() === "") {
    return {};
  }

  const parsed = JSON.parse(rawPayload) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("payloadJson must be a JSON object");
  }

  return parsed;
}

function readFormData(formData: FormData) {
  return {
    accessToken: formData.get("accessToken"),
    entryId: formData.get("entryId"),
    progressModelKey: formData.get("progressModelKey"),
    eventType: formData.get("eventType"),
    payloadJson: parsePayloadJson(formData.get("payloadJson")),
    occurredAt: formData.get("occurredAt") || undefined,
    reasonCode: formData.get("reasonCode") || undefined,
    reasonNote: formData.get("reasonNote") || undefined,
    imported: formData.get("imported") === "on",
  };
}

function toFieldErrors(error: ReturnType<typeof recordProgressFormSchema.safeParse>) {
  if (error.success) {
    return undefined;
  }

  return error.error.flatten().fieldErrors;
}

export async function recordProgressAction(
  _previousState: RecordProgressActionState,
  formData: FormData,
): Promise<RecordProgressActionState> {
  let rawInput: ReturnType<typeof readFormData>;

  try {
    rawInput = readFormData(formData);
  } catch (error) {
    return {
      status: "validation_error",
      message: error instanceof Error ? error.message : "payloadJson 不是合法 JSON object。",
    };
  }

  const parsed = recordProgressFormSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "进度数据未通过校验。",
      fieldErrors: toFieldErrors(parsed),
    };
  }

  const { accessToken, ...input } = parsed.data;
  const supabase = createUserScopedSupabase(accessToken);

  if ("error" in supabase) {
    return {
      status: "config_error",
      message: supabase.error,
    };
  }

  const { data, error } = await supabase.client.rpc<RecordProgressRpcPayload>("record_progress", {
    input_entry_id: input.entryId,
    input_progress_model_key: input.progressModelKey,
    input_event_type: input.eventType,
    input_payload_json: input.payloadJson,
    input_occurred_at: input.occurredAt ?? null,
    input_reason_code: input.reasonCode ?? null,
    input_reason_note: input.reasonNote ?? null,
    input_imported: input.imported,
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
      message: "record_progress 没有返回结果。",
    };
  }

  return {
    status: "recorded",
    message: "进度已记录，并已同步更新 snapshot。",
    progressLogId: data.progress_log_id,
    entryId: data.entry_id,
    progressModelId: data.progress_model_id,
    snapshot: data.snapshot,
  };
}
