"use client";

import { useState, useRef, useEffect } from "react";
import { Bookmark, Check, Plus, Loader2 } from "lucide-react";
import {
  loadListsForWork,
  addWorkToList,
  removeWorkFromList,
  quickCreateListWithWork,
} from "@/actions/lists";
import { cn } from "@/lib/utils";

export function AddToListButton({ workId, entryId, onChanged }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState([]);
  const [busy, setBusy] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function togglePanel() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      const res = await loadListsForWork(workId);
      setLists(res.lists ?? []);
      setLoading(false);
    }
  }

  async function toggle(list) {
    setBusy(list.id);
    const res = list.contains
      ? await removeWorkFromList(list.id, workId)
      : await addWorkToList(list.id, { entryId, workId });
    setBusy(null);
    if (!res.error) {
      setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, contains: !l.contains } : l)));
      if (onChanged) onChanged();
    }
  }

  async function create() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    const res = await quickCreateListWithWork(title, { entryId, workId });
    setCreating(false);
    if (!res.error) {
      setLists((prev) => [{ id: res.listId, title: res.title, visibility: "private", contains: true }, ...prev]);
      setNewTitle("");
      if (onChanged) onChanged();
    }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={togglePanel}
        title="加入清单"
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-ui text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bookmark className="size-3.5" strokeWidth={1.8} />
        清单
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border border-border bg-[var(--paper)] shadow-lg">
          <div className="border-b border-border px-3 py-2 font-ui text-xs text-muted-foreground">加入清单</div>
          <div className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : lists.length === 0 ? (
              <p className="px-3 py-3 font-ui text-xs text-muted-foreground">还没有清单，下面新建一个。</p>
            ) : (
              lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => toggle(list)}
                  disabled={busy === list.id}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-ui text-sm transition-colors hover:bg-accent disabled:opacity-60"
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      list.contains ? "border-primary bg-primary text-white" : "border-border"
                    )}
                  >
                    {busy === list.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : list.contains ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span className="truncate text-[var(--ink)]">{list.title}</span>
                </button>
              ))
            )}
          </div>
          <div className="flex items-center gap-1.5 border-t border-border p-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="新建清单…"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 font-ui text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={create}
              disabled={creating || !newTitle.trim()}
              className="inline-flex shrink-0 items-center rounded-md border border-border px-2 py-1 text-primary transition-colors hover:bg-accent disabled:opacity-50"
            >
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" strokeWidth={2} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
