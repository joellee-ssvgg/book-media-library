"use client";
import { useActionState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { generateMspfExportAction, requestAccountDeletionAction } from "@/actions/data-settings";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import { Input } from "@/components/ui/input";
import { initialAccountDeletionActionState, initialDataExportActionState } from "@/schemas/data-settings";

const SELECT_CLASS =
  "font-ui h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const DELETE_BUTTON_CLASS =
  "h-10 rounded-md bg-destructive px-5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60";

function fieldError(errors) {
  if (!errors?.length) {
    return null;
  }
  return <p className="font-ui mt-1 text-xs text-[var(--danger)]">{errors[0]}</p>;
}

function ResultRow({ label, value }) {
  return (
    <div className="grid gap-1 md:grid-cols-[140px_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all text-[var(--ink)]">{value}</dd>
    </div>
  );
}

export function DataSettingsClient() {
  const [exportState, exportAction, exportPending] = useActionState(generateMspfExportAction, initialDataExportActionState);
  const [deletionState, deletionAction, deletionPending] = useActionState(requestAccountDeletionAction, initialAccountDeletionActionState);
  const zipHref = exportState.zipBase64
    ? `data:application/zip;base64,${exportState.zipBase64}`
    : undefined;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <form action={exportAction} className="ink-card grid content-start gap-5 p-6">
        <div>
          <p className="ink-eyebrow">EXPORT</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--ink)]">导出我的数据</h2>
          <p className="ink-subtitle mt-2 text-sm">
            将书影记录、进度、笔记与清单完整打包为 MSPF v1.0.0 格式的 ZIP，随时下载备份。
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <OfflineSubmitButton pending={exportPending} pendingLabel="打包生成中…">
            导出我的数据
          </OfflineSubmitButton>
          {exportState.message ? (
            <p className="font-ui pt-2 text-sm text-muted-foreground">{exportState.message}</p>
          ) : null}
        </div>

        {exportState.status === "exported" ? (
          <div className="grid gap-4 rounded-md border border-border bg-accent/40 p-4">
            <dl className="grid gap-2 font-mono text-xs">
              <ResultRow label="任务 ID（job_id）" value={exportState.jobId} />
              <ResultRow label="生成时间" value={exportState.generatedAt} />
            </dl>
            {zipHref ? (
              <a
                className="ink-button inline-flex h-10 w-fit items-center gap-2 px-4 text-sm font-medium"
                download="mspf-export.zip"
                href={zipHref}
              >
                <Download className="size-4" />
                下载 MSPF ZIP
              </a>
            ) : null}
          </div>
        ) : null}
      </form>

      <form action={deletionAction} className="ink-card grid content-start gap-5 border-destructive/30 p-6">
        <div>
          <p className="ink-eyebrow flex items-center gap-1.5">
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            DELETE
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--ink)]">注销账号</h2>
          <p className="ink-subtitle mt-2 text-sm">
            「先导出再删除」需先完成左侧导出，账号进入 30 天软删除期，期间重新登录即可恢复；
            「直接删除」跳过导出，经 24 小时冷静期后删除。
          </p>
        </div>

        <div className="grid gap-2">
          <label className="font-ui text-sm font-medium text-[var(--ink)]" htmlFor="deletionChannel">
            删除方式
          </label>
          <select className={SELECT_CLASS} defaultValue="export_then_delete" id="deletionChannel" name="deletionChannel">
            <option value="export_then_delete">先导出再删除（30 天软删除，可反悔）</option>
            <option value="gdpr">直接删除（GDPR，24 小时冷静期）</option>
          </select>
          {fieldError(deletionState.fieldErrors?.deletionChannel)}
        </div>

        <div className="grid gap-2">
          <label className="font-ui text-sm font-medium text-[var(--ink)]" htmlFor="exportJobId">
            导出任务 ID（job_id）
          </label>
          <Input
            className="font-mono text-xs"
            id="exportJobId"
            key={exportState.jobId ?? "empty-export-job"}
            name="exportJobId"
            placeholder="完成左侧导出后自动填入"
            defaultValue={exportState.jobId ?? ""}
          />
          <p className="font-ui text-xs text-muted-foreground">仅「先导出再删除」需要填写。</p>
          {fieldError(deletionState.fieldErrors?.exportJobId)}
        </div>

        <div className="grid gap-2">
          <label className="font-ui text-sm font-medium text-[var(--ink)]" htmlFor="confirmation">
            输入 DELETE 确认
          </label>
          <Input className="font-mono" id="confirmation" name="confirmation" placeholder="DELETE" autoComplete="off" />
          {fieldError(deletionState.fieldErrors?.confirmation)}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <OfflineSubmitButton pending={deletionPending} pendingLabel="提交中…" className={DELETE_BUTTON_CLASS}>
            删除账户
          </OfflineSubmitButton>
          {deletionState.message ? (
            <p className="font-ui pt-2 text-sm text-muted-foreground">{deletionState.message}</p>
          ) : null}
        </div>

        {deletionState.status === "soft_deleted" || deletionState.status === "cooling_off" ? (
          <dl className="grid gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 font-mono text-xs">
            <ResultRow label="申请 ID" value={deletionState.requestId} />
            <ResultRow label="删除方式" value={deletionState.channel} />
            {deletionState.softDeleteUntil ? (
              <ResultRow label="软删除截止" value={deletionState.softDeleteUntil} />
            ) : null}
            {deletionState.coolingUntil ? (
              <ResultRow label="冷静期截止" value={deletionState.coolingUntil} />
            ) : null}
          </dl>
        ) : null}
      </form>
    </div>
  );
}
