"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, BookMarked } from "lucide-react";
import { getEntryReadingProgress, logReadingPages } from "@/actions/reading-pages";

export function LogReadingModal({ open, onOpenChange, entry }) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState("");
  const [totalPages, setTotalPages] = useState("");
  // prev holds the loaded baseline tagged with its entry id so we can derive the
  // loading state without calling setState synchronously inside the effect.
  const [prev, setPrev] = useState(null); // { entryId, current_page, total_pages }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !entry?.entry_id) return;
    let cancelled = false;
    getEntryReadingProgress(entry.entry_id).then((result) => {
      if (cancelled) return;
      const data = result.data ?? {};
      setPrev({ entryId: entry.entry_id, ...data });
      setCurrentPage(data.current_page != null ? String(data.current_page) : "");
      setTotalPages(data.total_pages != null ? String(data.total_pages) : "");
    });
    return () => {
      cancelled = true;
    };
  }, [open, entry?.entry_id]);

  const handleOpenChange = (next) => {
    if (!next) {
      setPrev(null);
      setError(null);
      setCurrentPage("");
      setTotalPages("");
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await logReadingPages(entry.entry_id, currentPage, totalPages || null);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    handleOpenChange(false);
    router.refresh();
  };

  const loadingPrev = open && (!prev || prev.entryId !== entry?.entry_id);
  const prevPage = prev?.current_page ?? 0;
  const pagesDelta = currentPage ? Math.max(0, Number(currentPage) - prevPage) : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>记录阅读</DialogTitle>
        <DialogDescription className="truncate">
          {entry?.title ? `《${entry.title}》` : "记录你的阅读进度"}
        </DialogDescription>

        {loadingPrev ? (
          <div className="flex items-center justify-center py-8 text-[var(--ink-soft)]">
            <Loader2 className="size-5 animate-spin" strokeWidth={1.5} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-[var(--paper-deep)] px-3 py-2 font-ui text-xs text-[var(--ink-soft)]">
              <BookMarked className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
              {prevPage > 0 ? `上次读到第 ${prevPage} 页` : "还没有记录，从你现在读到的页码开始"}
            </div>

            <label className="block">
              <span className="font-ui text-sm text-[var(--ink)]">读到第几页</span>
              <Input
                type="number"
                min="1"
                inputMode="numeric"
                value={currentPage}
                onChange={(e) => setCurrentPage(e.target.value)}
                placeholder="当前页码"
                autoFocus
                required
                className="mt-1"
              />
            </label>

            <label className="block">
              <span className="font-ui text-sm text-[var(--ink)]">总页数（选填）</span>
              <Input
                type="number"
                min="1"
                inputMode="numeric"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                placeholder="这本书一共多少页"
                className="mt-1"
              />
            </label>

            {pagesDelta > 0 && (
              <p className="font-ui text-sm text-primary">本次新增 {pagesDelta} 页</p>
            )}
            {error && <p className="font-ui text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                取消
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting || !currentPage}>
                {submitting ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : "保存"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
