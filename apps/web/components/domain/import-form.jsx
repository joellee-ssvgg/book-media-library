"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { enqueueImportAction } from "@/actions/import";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const initialState = { status: "idle", message: "" };

const SOURCES = [
  { value: "csv", label: "CSV", hint: "支持 Goodreads 导出" },
  { value: "mspf", label: "MSPF", hint: "阅迹导出的 JSON" },
];

export function ImportForm() {
  const [state, formAction, pending] = useActionState(enqueueImportAction, initialState);
  const [source, setSource] = useState("csv");
  const [fileName, setFileName] = useState("");

  const done = state.status === "imported" || state.status === "queued";
  const errored =
    state.status === "validation_error" ||
    state.status === "db_error" ||
    state.status === "config_error";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <form action={formAction} className="ink-card grid gap-5 p-6">
        <input type="hidden" name="importSource" value={source} />

        <div>
          <p className="font-ui text-sm font-medium text-[var(--ink)]">导入格式</p>
          <div className="mt-2 flex gap-1 rounded-md border border-border bg-muted/70 p-1">
            {SOURCES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setSource(item.value)}
                className={cn(
                  "font-ui flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                  source === item.value
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
                <span className="ml-1.5 text-xs text-muted-foreground">· {item.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-ui text-sm font-medium text-[var(--ink)]">选择文件</p>
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-[var(--paper-deep)] px-4 py-8 text-center transition-colors hover:border-primary/50">
            <Upload className="size-6 text-[var(--ink-faint)]" strokeWidth={1.5} />
            {fileName ? (
              <span className="inline-flex items-center gap-1.5 font-ui text-sm text-[var(--ink)]">
                <FileText className="size-4" strokeWidth={1.5} />
                {fileName}
              </span>
            ) : (
              <span className="font-ui text-sm text-[var(--ink-soft)]">
                点击选择 {source === "csv" ? ".csv" : ".json"} 文件（最大 2MB）
              </span>
            )}
            <input
              type="file"
              name="historyFile"
              accept={source === "csv" ? ".csv,text/csv" : ".json,application/json"}
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <OfflineSubmitButton pending={pending} pendingLabel="导入中">
            开始导入
          </OfflineSubmitButton>
          {done && (
            <Link href="/library" className="font-ui text-sm font-medium text-primary hover:underline">
              去图书库查看 →
            </Link>
          )}
        </div>

        {state.message ? (
          <p
            className={cn(
              "inline-flex items-start gap-1.5 font-ui text-sm",
              done ? "text-primary" : errored ? "text-destructive" : "text-[var(--ink-soft)]"
            )}
          >
            {done ? (
              <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            ) : errored ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            ) : null}
            {state.message}
          </p>
        ) : null}
      </form>

      <aside className="ink-card grid content-start gap-3 p-5">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">CSV 列说明</h2>
        <p className="font-ui text-sm leading-6 text-[var(--ink-soft)]">
          至少需要一列 <code className="rounded bg-muted px-1">title</code>（或{" "}
          <code className="rounded bg-muted px-1">canonical_title</code>）。其它可选列：
        </p>
        <ul className="grid gap-1 font-ui text-sm text-[var(--ink-soft)]">
          <li><code className="rounded bg-muted px-1">media_type</code> — book / movie</li>
          <li><code className="rounded bg-muted px-1">status</code> — 想读/在读等状态码</li>
          <li><code className="rounded bg-muted px-1">year</code>、<code className="rounded bg-muted px-1">cover_url</code>、<code className="rounded bg-muted px-1">rating_x10</code></li>
          <li><code className="rounded bg-muted px-1">country</code> / <code className="rounded bg-muted px-1">countries</code> — 关联到阅读地图（逗号分隔）</li>
        </ul>
        <p className="font-ui text-xs text-[var(--ink-faint)]">
          Goodreads 导出的 CSV 可直接上传；缺失封面会在库里按书名自动补一张。
        </p>
      </aside>
    </div>
  );
}
