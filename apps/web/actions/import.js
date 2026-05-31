"use server";

import { z } from "zod";
import { genericCsvToImportPayload } from "@/lib/import/generic-csv";
import { mspfToImportPayload } from "@/lib/mspf/validate";
import { createActionSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { runTask13DueJobs } from "@/lib/jobs/runner";

const importSourceSchema = z.enum(["csv", "mspf"]);

export async function enqueueImportAction(_previousState, formData) {
  const source = importSourceSchema.safeParse(formData.get("importSource"));
  if (!source.success) {
    return { status: "validation_error", message: "请选择导入格式（CSV 或 MSPF）。" };
  }

  const file = formData.get("historyFile");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "validation_error", message: "请选择要导入的文件。" };
  }
  if (file.size > 2_000_000) {
    return { status: "validation_error", message: "导入文件不能超过 2MB。" };
  }

  let payload;
  try {
    const text = await file.text();
    payload =
      source.data === "csv"
        ? genericCsvToImportPayload(text, file.name)
        : mspfToImportPayload(JSON.parse(text), file.name);
  } catch (error) {
    return {
      status: "validation_error",
      message: error instanceof Error ? error.message : "导入文件无法解析。",
    };
  }

  const itemCount = payload.items.length;
  if (itemCount === 0) {
    return { status: "validation_error", message: "文件中没有可导入的条目。" };
  }

  const supabase = await createActionSupabase();
  if ("error" in supabase) {
    return { status: "config_error", message: supabase.error };
  }

  const { data: enqueued, error: enqueueError } = await supabase.client.rpc(
    "task14_enqueue_import_job",
    {
      input_source: source.data,
      input_payload_json: payload,
      input_config_json: {
        source_file_name: payload.source_file_name,
        item_count: itemCount,
      },
    }
  );
  if (enqueueError) {
    return { status: "db_error", message: enqueueError.message };
  }

  // Drain the queue with a service-role client so the import runs immediately
  // (process_task13_due_jobs is service_role only; without it the job would wait
  // for a background worker).
  const service = createServiceRoleSupabase();
  if ("error" in service) {
    return {
      status: "queued",
      message: `已入队 ${itemCount} 条，但后台处理未配置，暂未执行。`,
      jobId: enqueued?.job_id,
      total: itemCount,
    };
  }

  const runResult = await runTask13DueJobs(service.client, { limit: 1000 });
  if (!runResult.ok) {
    return {
      status: "queued",
      message: `已入队 ${itemCount} 条，但处理失败：${runResult.message}`,
      jobId: enqueued?.job_id,
      total: itemCount,
    };
  }

  return {
    status: "imported",
    message: `导入完成，已提交 ${itemCount} 条。到库里看看吧。`,
    jobId: enqueued?.job_id,
    total: itemCount,
  };
}
