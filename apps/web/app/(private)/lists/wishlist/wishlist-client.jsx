"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dices, Loader2, Play, BookOpen, Film } from "lucide-react";
import { setEntryStatus } from "@/actions/entry-status";
import { BookCover } from "@/components/domain/visual-system";
import { genreLabel } from "@/lib/recommendations/genres";
import { rankSimilar } from "@/lib/recommendations/similarity";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "book", label: "图书" },
  { key: "movie", label: "影视" },
];

const STATUS_LABEL = {
  want_to_read: "想读",
  reading: "在读",
  finished: "已读",
  abandoned: "弃读",
  want_to_watch: "想看",
  watching: "在看",
  watched: "看过",
};

const COVER_VARIANTS = ["cream", "navy", "blue", "gold", "forest", "red"];

function mediaLabel(mediaType) {
  return mediaType === "movie" ? "影视" : "图书";
}

function startLabel(mediaType) {
  return mediaType === "movie" ? "开始观看" : "开始阅读";
}

function Cover({ item, index, className }) {
  if (item.coverUrl) {
    return (
      <div className={cn("overflow-hidden rounded-md border border-border bg-muted shadow-sm", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.coverUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.05]"
        />
      </div>
    );
  }
  return (
    <BookCover
      title={item.title}
      variant={COVER_VARIANTS[index % COVER_VARIANTS.length]}
      className={cn("aspect-[2/3]", className)}
    />
  );
}

export function WishlistClient({ items, corpus = [] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [genre, setGenre] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const [pending, setPending] = useState(null);

  const mediaFiltered = useMemo(
    () =>
      items.filter((item) =>
        filter === "all" ? true : filter === "book" ? item.mediaType === "book" : item.mediaType === "movie"
      ),
    [items, filter]
  );

  const availableGenres = useMemo(() => {
    const counts = new Map();
    for (const item of mediaFiltered) {
      for (const g of item.genres ?? []) {
        counts.set(g, (counts.get(g) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [mediaFiltered]);

  const filtered = useMemo(
    () => (genre ? mediaFiltered.filter((item) => item.genres?.includes(genre)) : mediaFiltered),
    [mediaFiltered, genre]
  );

  const indexById = useMemo(() => new Map(items.map((item, index) => [item.entryId, index])), [items]);
  const picked = filtered.find((item) => item.entryId === pickedId) ?? null;

  const similar = useMemo(() => {
    if (!picked) return [];
    // 同媒介：书只推书、影视只推影视
    const sameMedia = corpus.filter((item) => item.mediaType === picked.mediaType);
    return rankSimilar(
      { workId: picked.workId, genres: picked.genres, subjects: picked.subjects },
      sameMedia,
      { limit: 6 }
    );
  }, [picked, corpus]);

  function roll() {
    if (filtered.length === 0) return;
    const pool = filtered.length > 1 ? filtered.filter((item) => item.entryId !== pickedId) : filtered;
    const next = pool[Math.floor(Math.random() * pool.length)];
    setPickedId(next.entryId);
  }

  async function start(item) {
    setPending(item.entryId);
    const next = item.mediaType === "movie" ? "watching" : "reading";
    await setEntryStatus(item.entryId, next);
    setPending(null);
    if (pickedId === item.entryId) setPickedId(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="ink-card grid place-items-center gap-4 px-6 py-16 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-accent text-primary">
          <Dices className="size-8" strokeWidth={1.6} />
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">还没有想读 / 想看的条目</h2>
          <p className="ink-subtitle mt-2 text-sm">
            在图书库或影视库里把条目状态改为「想读 / 想看」，它们就会汇总到这里。
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/library" className="ink-button inline-flex h-10 items-center gap-2 px-5 text-sm font-medium no-underline">
            <BookOpen className="size-4" />
            去图书库
          </Link>
          <Link href="/library/films" className="ink-button-outline inline-flex h-10 items-center gap-2 px-5 text-sm font-medium no-underline">
            <Film className="size-4" />
            去影视库
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      {/* 骰子决策区 */}
      <section className="ink-card relative overflow-hidden p-6 md:p-7">
        <div className="ink-wash right-0 top-0 h-32 w-64 opacity-60" aria-hidden="true" />
        {picked ? (
          <div className="relative z-10">
            <div className="grid items-center gap-5 sm:grid-cols-[96px_1fr_auto]">
            <Cover item={picked} index={indexById.get(picked.entryId) ?? 0} className="w-24 sm:w-24" />
            <div className="min-w-0">
              <p className="ink-eyebrow">为你抽中</p>
              <h2 className="mt-1 truncate font-display text-2xl font-semibold text-[var(--ink)]">{picked.title}</h2>
              <p className="font-ui text-sm text-muted-foreground">
                {mediaLabel(picked.mediaType)}
                {picked.year ? ` · ${picked.year}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <button
                type="button"
                onClick={() => start(picked)}
                disabled={pending === picked.entryId}
                className="ink-button inline-flex h-10 items-center gap-2 px-5 text-sm font-medium disabled:opacity-60"
              >
                {pending === picked.entryId ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                {startLabel(picked.mediaType)}
              </button>
              <button
                type="button"
                onClick={roll}
                disabled={filtered.length < 2}
                className="ink-button-outline inline-flex h-10 items-center gap-2 px-5 text-sm font-medium disabled:opacity-50"
              >
                <Dices className="size-4" />
                换一个
              </button>
            </div>
            </div>
            {/* 更像这本：库内按规范类型 + 自由标签重合度排序 */}
            {similar.length > 0 ? (
              <div className="mt-6 border-t border-border/60 pt-5">
                <p className="ink-eyebrow">更像这本</p>
                <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-x-4 gap-y-5">
                  {similar.map((s, index) => (
                    <div key={s.workId} className="min-w-0">
                      <Cover item={s} index={index} className="aspect-[2/3] w-full" />
                      <h4 className="mt-2 truncate font-display text-sm font-semibold text-[var(--ink)]" title={s.title}>
                        {s.title}
                      </h4>
                      <p className="font-ui text-[11px] text-muted-foreground">{STATUS_LABEL[s.status] ?? mediaLabel(s.mediaType)}</p>
                      {s.sharedGenres.length ? (
                        <p className="truncate font-ui text-[11px] text-[var(--ink-faint)]">
                          {s.sharedGenres.slice(0, 2).map(genreLabel).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">下一个读什么？</h2>
              <p className="ink-subtitle mt-2 text-sm">
                在 {filtered.length} 个{filter === "movie" ? "想看" : filter === "book" ? "想读" : "想读 / 想看"}里，让骰子替你挑一个。
              </p>
            </div>
            <button
              type="button"
              onClick={roll}
              disabled={filtered.length === 0}
              className="ink-button inline-flex h-12 items-center gap-2 px-7 text-base font-medium disabled:opacity-50"
            >
              <Dices className="size-5" />
              掷骰子
            </button>
          </div>
        )}
      </section>

      {/* 筛选 */}
      <nav className="media-tabs" aria-label="想读想看筛选">
        {FILTERS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setFilter(tab.key);
              setGenre(null);
              setPickedId(null);
            }}
            className={cn("media-tab", filter === tab.key && "media-tab-active")}
            type="button"
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto hidden font-ui text-sm text-muted-foreground sm:block">共 {filtered.length} 个</span>
      </nav>

      {availableGenres.length > 0 ? (
        <div className="-mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setGenre(null);
              setPickedId(null);
            }}
            className={cn(
              "rounded-full border px-3 py-1 font-ui text-xs transition-colors",
              genre === null ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground hover:text-[var(--ink)]"
            )}
          >
            全部类型
          </button>
          {availableGenres.map(([id, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setGenre(id);
                setPickedId(null);
              }}
              className={cn(
                "rounded-full border px-3 py-1 font-ui text-xs transition-colors",
                genre === id ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground hover:text-[var(--ink)]"
              )}
            >
              {genreLabel(id)}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* 列表 */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center font-ui text-sm text-muted-foreground">这个分类下还没有想读 / 想看的条目。</p>
      ) : (
        <div className="ink-rise-stagger grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-6 gap-y-8">
          {filtered.map((item) => {
            const index = indexById.get(item.entryId) ?? 0;
            const isPicked = item.entryId === pickedId;
            return (
              <article
                key={item.entryId}
                className={cn("group min-w-0 rounded-md", isPicked && "ring-2 ring-primary ring-offset-2 ring-offset-[var(--paper)]")}
              >
                <Cover item={item} index={index} className="aspect-[2/3] w-full" />
                <h3 className="mt-3 truncate font-display text-base font-semibold text-[var(--ink)]">{item.title}</h3>
                <p className="font-ui text-sm text-muted-foreground">
                  {mediaLabel(item.mediaType)}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
                {item.genres?.length ? (
                  <p className="truncate font-ui text-xs text-[var(--ink-faint)]">
                    {item.genres.slice(0, 2).map(genreLabel).join(" · ")}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => start(item)}
                  disabled={pending === item.entryId}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-ui text-xs font-medium text-primary transition-colors hover:bg-accent disabled:opacity-60"
                >
                  {pending === item.entryId ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" strokeWidth={1.8} />}
                  {startLabel(item.mediaType)}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
