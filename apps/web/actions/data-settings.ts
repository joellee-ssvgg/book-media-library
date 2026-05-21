"use server";

import { createStoredZipBase64 } from "@/lib/mspf/zip";
import { createUserScopedSupabase } from "@/lib/supabase/server";
import {
  accountDeletionFormSchema,
  dataExportFormSchema,
  type AccountDeletionActionState,
  type DataExportActionState,
} from "@/schemas/data-settings";

type EnqueueExportRpcPayload = {
  status: "queued";
  job_id: string;
  format: "mspf";
};

type ProcessExportRpcPayload = {
  status: "exported";
  job_id: string;
  generated_at: string;
  mspf: unknown;
};

type DeletionRpcPayload =
  | {
      status: "soft_deleted";
      request_id: string;
      channel: "export_then_delete";
      soft_delete_until: string;
    }
  | {
      status: "cooling_off";
      request_id: string;
      channel: "gdpr";
      cooling_until: string;
    };

function exportFieldErrors(result: ReturnType<typeof dataExportFormSchema.safeParse>) {
  return result.success ? undefined : result.error.flatten().fieldErrors;
}

function deletionFieldErrors(result: ReturnType<typeof accountDeletionFormSchema.safeParse>) {
  return result.success ? undefined : result.error.flatten().fieldErrors;
}

export async function generateMspfExportAction(
  _previousState: DataExportActionState,
  formData: FormData,
): Promise<DataExportActionState> {
  const parsed = dataExportFormSchema.safeParse({
    accessToken: formData.get("accessToken"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "MSPF 导出表单未通过校验。",
      fieldErrors: exportFieldErrors(parsed),
    };
  }

  const supabase = createUserScopedSupabase(parsed.data.accessToken);

  if ("error" in supabase) {
    return {
      status: "config_error",
      message: supabase.error,
    };
  }

  const { data: queued, error: enqueueError } =
    await supabase.client.rpc<EnqueueExportRpcPayload>("task18_enqueue_mspf_export");

  if (enqueueError) {
    return {
      status: "db_error",
      message: enqueueError.message,
    };
  }

  if (!queued) {
    return {
      status: "db_error",
      message: "task18_enqueue_mspf_export 没有返回结果。",
    };
  }

  const { data: exported, error: exportError } =
    await supabase.client.rpc<ProcessExportRpcPayload>("task18_process_own_export_job", {
      input_job_id: queued.job_id,
    });

  if (exportError) {
    return {
      status: "db_error",
      message: exportError.message,
    };
  }

  if (!exported?.mspf) {
    return {
      status: "db_error",
      message: "task18_process_own_export_job 没有返回 MSPF 文档。",
    };
  }

  const dataJson = `${JSON.stringify(exported.mspf, null, 2)}\n`;
  const zipBase64 = createStoredZipBase64([{ name: "data.json", content: dataJson }]);

  return {
    status: "exported",
    message: "MSPF 导出 ZIP 已生成。",
    jobId: exported.job_id,
    generatedAt: exported.generated_at,
    dataJson,
    zipBase64,
  };
}

export async function requestAccountDeletionAction(
  _previousState: AccountDeletionActionState,
  formData: FormData,
): Promise<AccountDeletionActionState> {
  const rawExportJobId = formData.get("exportJobId");
  const parsed = accountDeletionFormSchema.safeParse({
    accessToken: formData.get("accessToken"),
    deletionChannel: formData.get("deletionChannel"),
    exportJobId:
      typeof rawExportJobId === "string" && rawExportJobId.trim()
        ? rawExportJobId
        : undefined,
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "账户删除表单未通过校验。",
      fieldErrors: deletionFieldErrors(parsed),
    };
  }

  const supabase = createUserScopedSupabase(parsed.data.accessToken);

  if ("error" in supabase) {
    return {
      status: "config_error",
      message: supabase.error,
    };
  }

  const { data, error } = await supabase.client.rpc<DeletionRpcPayload>(
    "task18_request_account_deletion",
    {
      input_channel: parsed.data.deletionChannel,
      input_confirmation: parsed.data.confirmation,
      input_export_job_id: parsed.data.exportJobId ?? null,
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
      message: "task18_request_account_deletion 没有返回结果。",
    };
  }

  if (data.status === "soft_deleted") {
    return {
      status: "soft_deleted",
      message: "账户已进入 30 天软删除窗口。",
      requestId: data.request_id,
      channel: data.channel,
      softDeleteUntil: data.soft_delete_until,
    };
  }

  return {
    status: "cooling_off",
    message: "GDPR 删除请求已进入 24 小时冷静期。",
    requestId: data.request_id,
    channel: data.channel,
    coolingUntil: data.cooling_until,
  };
}
