"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/domain/visual-system";

const STATUS_LABELS = {
  want_to_read: "想读",
  reading: "在读",
  finished: "读过",
  abandoned: "放弃",
};

const coverVariants = ["navy", "blue", "cream", "gold", "forest", "red"];

export function BookCard({ entry, index }) {
  const variant = coverVariants[index % coverVariants.length];
  const coverUrl = entry.cover_url;
  const statusLabel = STATUS_LABELS[entry.status] || entry.status;

  return (
    <Link
      href={`/library`}
      className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
    >
      {coverUrl ? (
        <div className="size-10 shrink-0 overflow-hidden rounded-sm border border-border bg-muted shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <BookCover
          title={entry.title}
          variant={variant}
          className="size-10 shrink-0 text-[8px]"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-ui truncate text-sm font-medium text-[var(--ink)]">
          {entry.title}
        </p>
        {statusLabel && (
          <span className="font-ui text-xs text-[var(--ink-soft)]">{statusLabel}</span>
        )}
      </div>
    </Link>
  );
}
