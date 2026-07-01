"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe2, LockKeyhole, MoreHorizontal, Link2, Trash2, Loader2, Check } from "lucide-react";
import { BookCover } from "@/components/domain/visual-system";
import { CoverImage } from "@/components/domain/cover-image";
import { deleteList } from "@/actions/lists";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "all", label: "全部" },
  { key: "public", label: "公开" },
  { key: "private", label: "私密" },
];

const VARIANTS = ["cream", "navy", "blue", "gold"];

function isPublic(v) {
  return v === "public" || v === "unlisted";
}

function ListCard({ list }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setMenuOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function copyShare(e) {
    e.stopPropagation();
    navigator.clipboard?.writeText(`${window.location.origin}/l/${list.id}`);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setMenuOpen(false);
    }, 1200);
  }

  async function doDelete(e) {
    e.stopPropagation();
    setBusy(true);
    const res = await deleteList(list.id);
    setBusy(false);
    if (!res.error) {
      setMenuOpen(false);
      router.refresh();
    }
  }

  const pub = isPublic(list.visibility);
  const covers = list.covers.length ? list.covers : ["", "", "", ""];

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/lists/${list.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/lists/${list.id}`);
      }}
      className="ink-card ink-card-hover block cursor-pointer p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl font-semibold text-[var(--ink)]">{list.title}</h2>
          <p className="truncate font-ui text-sm text-[var(--ink-soft)]">
            {list.count} 个条目{list.description ? ` · ${list.description}` : ""}
          </p>
        </div>
        <span className="font-ui inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
          {pub ? <Globe2 className="size-3.5" /> : <LockKeyhole className="size-3.5" />}
          {pub ? "公开" : "私密"}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3">
        {covers.slice(0, 4).map((cover, index) =>
          cover ? (
            <CoverImage
              key={index}
              src={cover}
              sizes="120px"
              className="aspect-[2/3] w-full rounded-md border border-border bg-muted"
            />
          ) : (
            <BookCover key={index} className="aspect-[2/3] w-full opacity-70" title="" variant={VARIANTS[index % VARIANTS.length]} />
          )
        )}
      </div>

      <div className="relative mt-3 flex justify-end" ref={ref}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
            setConfirming(false);
          }}
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="更多"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {menuOpen ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-full right-0 z-50 mb-1 w-40 overflow-hidden rounded-md border border-border bg-[var(--paper)] py-1 shadow-lg"
          >
            {pub ? (
              <button
                type="button"
                onClick={copyShare}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-ui text-sm text-[var(--ink)] transition-colors hover:bg-accent"
              >
                {copied ? <Check className="size-3.5 text-primary" strokeWidth={2.5} /> : <Link2 className="size-3.5" />}
                {copied ? "已复制" : "复制分享链接"}
              </button>
            ) : null}
            {confirming ? (
              <button
                type="button"
                onClick={doDelete}
                disabled={busy}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-ui text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                确认删除
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-ui text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-[var(--danger)]"
              >
                <Trash2 className="size-3.5" />
                删除清单
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ListsClient({ lists }) {
  const [tab, setTab] = useState("all");
  const filtered = lists.filter((l) =>
    tab === "all" ? true : tab === "public" ? isPublic(l.visibility) : !isPublic(l.visibility)
  );

  return (
    <div className="mt-8">
      <nav className="media-tabs" aria-label="清单筛选">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn("media-tab", tab === t.key && "media-tab-active")}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto hidden font-ui text-sm text-muted-foreground sm:block">共 {filtered.length} 个</span>
      </nav>

      {filtered.length === 0 ? (
        <p className="py-12 text-center font-ui text-sm text-muted-foreground">这个分类下还没有清单。</p>
      ) : (
        <section className="ink-rise-stagger mt-6 grid gap-6 lg:grid-cols-3">
          {filtered.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </section>
      )}
    </div>
  );
}
