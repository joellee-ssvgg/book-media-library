"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { setEntryStatus } from "@/actions/entry-status";
import { cn } from "@/lib/utils";

const BOOK_STATUSES = [
  { value: "want_to_read", label: "想读" },
  { value: "reading", label: "在读" },
  { value: "finished", label: "读过" },
  { value: "abandoned", label: "放弃" },
];

const MOVIE_STATUSES = [
  { value: "want_to_watch", label: "想看" },
  { value: "watching", label: "在看" },
  { value: "watched", label: "看过" },
  { value: "abandoned", label: "放弃" },
];

function statusLabelOf(options, value) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function StatusToggle({ entry, onChanged }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef(null);

  const options = entry.media_type === "movie" ? MOVIE_STATUSES : BOOK_STATUSES;

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleSelect = async (value) => {
    setOpen(false);
    if (value === entry.status) return;
    setPending(true);
    setError(false);
    const result = await setEntryStatus(entry.entry_id, value);
    setPending(false);
    if (result.error) {
      setError(true);
      return;
    }
    // 库列表是客户端加载的，router.refresh() 刷不到它 —— 用 onChanged 重新拉数据
    if (onChanged) onChanged();
    else router.refresh();
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        title={error ? "切换失败，请重试" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-ui text-sm transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60",
          error ? "border-[var(--danger)] text-[var(--danger)]" : "border-border text-muted-foreground"
        )}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          statusLabelOf(options, entry.status)
        )}
        <ChevronDown className="size-3.5" strokeWidth={1.8} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-28 overflow-hidden rounded-md border border-border bg-[var(--paper)] shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left font-ui text-sm transition-colors hover:bg-accent",
                option.value === entry.status ? "text-primary" : "text-[var(--ink)]"
              )}
            >
              {option.value === entry.status ? (
                <Check className="size-3.5 shrink-0" strokeWidth={2} />
              ) : (
                <span className="size-3.5 shrink-0" />
              )}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
