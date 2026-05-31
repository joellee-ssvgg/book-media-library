"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteEntry } from "@/actions/entry-status";

// 两步内联确认的删除按钮：点「删除」→ 出现「确认 / 取消」→ 确认才软删。
export function DeleteEntryButton({ entryId, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function doDelete() {
    setPending(true);
    setError(false);
    const res = await deleteEntry(entryId);
    setPending(false);
    if (res.error) {
      setError(true);
      return;
    }
    setConfirming(false);
    if (onDeleted) onDeleted();
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 font-ui text-xs">
        <button
          type="button"
          onClick={doDelete}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--danger)] px-2 py-1 font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" strokeWidth={1.8} />}
          确认删除
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-[var(--ink)]"
        >
          取消
        </button>
        {error ? <span className="text-[var(--danger)]">失败</span> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="从库中删除"
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-ui text-xs text-muted-foreground transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
    >
      <Trash2 className="size-3.5" strokeWidth={1.8} />
      删除
    </button>
  );
}
