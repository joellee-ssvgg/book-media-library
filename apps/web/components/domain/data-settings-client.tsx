"use client";

import { useActionState } from "react";

import {
  generateMspfExportAction,
  requestAccountDeletionAction,
} from "@/actions/data-settings";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import {
  initialAccountDeletionActionState,
  initialDataExportActionState,
} from "@/schemas/data-settings";

function fieldError(errors: string[] | undefined) {
  if (!errors?.length) {
    return null;
  }

  return <p className="mt-1 text-xs text-[#9a3412]">{errors[0]}</p>;
}

export function DataSettingsClient() {
  const [exportState, exportAction, exportPending] = useActionState(
    generateMspfExportAction,
    initialDataExportActionState,
  );
  const [deletionState, deletionAction, deletionPending] = useActionState(
    requestAccountDeletionAction,
    initialAccountDeletionActionState,
  );
  const zipHref = exportState.zipBase64
    ? `data:application/zip;base64,${exportState.zipBase64}`
    : undefined;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <form action={exportAction} className="grid content-start gap-5 border border-[#d8d2c4] bg-[#fffdf8] p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">Export</p>
          <h2 className="mt-1 text-xl font-semibold">MSPF v1.0.0</h2>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <OfflineSubmitButton pending={exportPending} pendingLabel="生成中">
            Export my data
          </OfflineSubmitButton>
          {exportState.message ? (
            <p className="pt-2 text-sm text-[#3f4945]">{exportState.message}</p>
          ) : null}
        </div>

        {exportState.status === "exported" ? (
          <div className="grid gap-4 border border-[#b9d2c9] bg-[#f3faf7] p-4">
            <dl className="grid gap-2 font-mono text-xs">
              <div className="grid gap-1 md:grid-cols-[120px_1fr]">
                <dt>job_id</dt>
                <dd>{exportState.jobId}</dd>
              </div>
              <div className="grid gap-1 md:grid-cols-[120px_1fr]">
                <dt>generated_at</dt>
                <dd>{exportState.generatedAt}</dd>
              </div>
            </dl>
            {zipHref ? (
              <a
                className="inline-flex h-10 w-fit items-center border border-[#315f53] bg-[#315f53] px-4 text-sm font-medium text-white"
                download="mspf-export.zip"
                href={zipHref}
              >
                下载 MSPF ZIP
              </a>
            ) : null}
          </div>
        ) : null}
      </form>

      <form action={deletionAction} className="grid content-start gap-5 border border-[#d8d2c4] bg-[#fffdf8] p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">Delete</p>
          <h2 className="mt-1 text-xl font-semibold">注销双通道</h2>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="deletionChannel">
            删除通道
          </label>
          <select
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            defaultValue="export_then_delete"
            id="deletionChannel"
            name="deletionChannel"
          >
            <option value="export_then_delete">Export then delete</option>
            <option value="gdpr">GDPR direct delete</option>
          </select>
          {fieldError(deletionState.fieldErrors?.deletionChannel)}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="exportJobId">
            completed export job_id
          </label>
          <input
            className="h-10 border border-[#c9c2b3] bg-white px-3 font-mono text-xs outline-none focus:border-[#315f53]"
            id="exportJobId"
            key={exportState.jobId ?? "empty-export-job"}
            name="exportJobId"
            placeholder="00000000-0000-0000-0000-000000000000"
            defaultValue={exportState.jobId ?? ""}
          />
          {fieldError(deletionState.fieldErrors?.exportJobId)}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="confirmation">
            输入 DELETE
          </label>
          <input
            className="h-10 border border-[#c9c2b3] bg-white px-3 font-mono text-sm outline-none focus:border-[#315f53]"
            id="confirmation"
            name="confirmation"
            placeholder="DELETE"
          />
          {fieldError(deletionState.fieldErrors?.confirmation)}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <OfflineSubmitButton pending={deletionPending} pendingLabel="提交中">
            删除账户
          </OfflineSubmitButton>
          {deletionState.message ? (
            <p className="pt-2 text-sm text-[#3f4945]">{deletionState.message}</p>
          ) : null}
        </div>

        {deletionState.status === "soft_deleted" || deletionState.status === "cooling_off" ? (
          <dl className="grid gap-2 border border-[#ead6ab] bg-[#fff8e8] p-4 font-mono text-xs">
            <div className="grid gap-1 md:grid-cols-[120px_1fr]">
              <dt>request_id</dt>
              <dd>{deletionState.requestId}</dd>
            </div>
            <div className="grid gap-1 md:grid-cols-[120px_1fr]">
              <dt>channel</dt>
              <dd>{deletionState.channel}</dd>
            </div>
            {deletionState.softDeleteUntil ? (
              <div className="grid gap-1 md:grid-cols-[120px_1fr]">
                <dt>soft_until</dt>
                <dd>{deletionState.softDeleteUntil}</dd>
              </div>
            ) : null}
            {deletionState.coolingUntil ? (
              <div className="grid gap-1 md:grid-cols-[120px_1fr]">
                <dt>cooling_until</dt>
                <dd>{deletionState.coolingUntil}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </form>
    </div>
  );
}
