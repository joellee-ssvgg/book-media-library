"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Film } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { loadLibraryMovies, logWatch } from "@/actions/watch-events";
import { cn } from "@/lib/utils";

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function LogWatchModal({ open, onOpenChange, defaultDate, onLogged, openToken }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>登记观影</DialogTitle>
        <DialogDescription>从库里选一部电影，记下看的日期（可以补登过去）。</DialogDescription>
        {/* key=openToken：每次打开都重新挂载 → 表单状态自然重置（无需在 effect 里同步 setState） */}
        <LogWatchForm key={openToken} defaultDate={defaultDate} onClose={() => onOpenChange(false)} onLogged={onLogged} />
      </DialogContent>
    </Dialog>
  );
}

function LogWatchForm({ defaultDate, onClose, onLogged }) {
  const [movies, setMovies] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(defaultDate || todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    loadLibraryMovies()
      .then((res) => {
        if (alive) setMovies(res.movies ?? []);
      })
      .catch(() => {
        if (alive) setMovies([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return movies ?? [];
    return (movies ?? []).filter((m) => m.title.toLowerCase().includes(q));
  }, [movies, query]);

  async function save() {
    if (!selected || !date) return;
    setSaving(true);
    setError("");
    const res = await logWatch({ workId: selected.workId, entryId: selected.entryId, watchedOn: date, note });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    if (onLogged) onLogged();
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索电影…"
          className="h-10 rounded-md border border-border bg-transparent px-3 font-ui text-sm outline-none focus:border-primary"
        />
        <div className="max-h-52 overflow-y-auto rounded-md border border-border">
          {movies === null ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (movies ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center font-ui text-sm text-muted-foreground">
              库里还没有电影。
              <Link href="/library/films" className="ml-1 text-primary no-underline">
                去影视库添加
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-6 text-center font-ui text-sm text-muted-foreground">没找到匹配的电影。</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.workId}
                type="button"
                onClick={() => setSelected(m)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent",
                  selected?.workId === m.workId && "bg-accent"
                )}
              >
                {m.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.coverUrl} alt="" className="h-12 w-8 shrink-0 rounded-sm object-cover" />
                ) : (
                  <span className="grid h-12 w-8 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground">
                    <Film className="size-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-ui text-sm text-[var(--ink)]">{m.title}</span>
                  {m.year ? <span className="font-ui text-xs text-muted-foreground">{m.year}</span> : null}
                </span>
                {selected?.workId === m.workId ? <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} /> : null}
              </button>
            ))
          )}
        </div>
      </div>

      <label className="grid gap-1.5">
        <span className="font-ui text-sm text-muted-foreground">观影日期</span>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-md border border-border bg-transparent px-3 font-ui text-sm outline-none focus:border-primary"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="font-ui text-sm text-muted-foreground">备注（可选）</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="一句话观后感…"
          className="h-10 rounded-md border border-border bg-transparent px-3 font-ui text-sm outline-none focus:border-primary"
        />
      </label>

      {error ? <p className="font-ui text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onClose} className="font-ui text-sm text-muted-foreground hover:text-[var(--ink)]">
          取消
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !selected || !date}
          className="ink-button inline-flex h-10 items-center gap-2 px-5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          登记
        </button>
      </div>
    </div>
  );
}
