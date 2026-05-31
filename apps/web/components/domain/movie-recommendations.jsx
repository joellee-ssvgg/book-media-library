"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Check, Loader2 } from "lucide-react";
import { loadMovieRecommendationsAction, addRecommendedMovieAction } from "@/actions/recommendations";
import { BookCover } from "@/components/domain/visual-system";
import { cn } from "@/lib/utils";

function Poster({ title, posterUrl, index }) {
  if (posterUrl) {
    return (
      <div className="aspect-[2/3] w-full overflow-hidden rounded-md border border-border bg-muted shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.05]"
          loading="lazy"
        />
      </div>
    );
  }
  const variants = ["navy", "blue", "forest", "red", "gold", "cream"];
  return <BookCover title={title} variant={variants[index % variants.length]} className="aspect-[2/3] w-full" />;
}

export function MovieRecommendations() {
  const router = useRouter();
  const [items, setItems] = useState(null); // null = 加载中
  const [addingId, setAddingId] = useState(null);
  const [added, setAdded] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    loadMovieRecommendationsAction()
      .then((res) => {
        if (alive) setItems(res?.status === "ok" ? res.items : []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 加载中或确无推荐：不渲染（避免在没有种子时闪现空区块）
  if (items === null || items.length === 0) {
    return null;
  }

  async function want(tmdbId) {
    setAddingId(tmdbId);
    try {
      const res = await addRecommendedMovieAction(tmdbId);
      if (res?.status === "created") {
        setAdded((prev) => new Set(prev).add(tmdbId));
        router.refresh();
      }
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section className="mt-14">
      <div className="flex items-end gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-primary">
          <Sparkles className="size-5" strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <p className="ink-eyebrow">FOR YOU</p>
          <h2 className="font-display text-2xl font-semibold leading-tight text-[var(--ink)]">为你推荐 · 影视</h2>
        </div>
      </div>
      <p className="ink-subtitle mt-2 text-sm">根据你库里的电影，TMDB 觉得你可能也会想看这些。</p>

      <div className="ink-rise-stagger mt-6 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-8">
        {items.map((item, index) => {
          const isAdded = added.has(item.tmdbId);
          const isAdding = addingId === item.tmdbId;
          return (
            <article key={item.tmdbId} className="group min-w-0">
              <Poster title={item.title} posterUrl={item.posterUrl} index={index} />
              <h3 className="mt-3 truncate font-display text-base font-semibold text-[var(--ink)]" title={item.title}>
                {item.title}
              </h3>
              <p className="font-ui text-sm text-muted-foreground">影视{item.year ? ` · ${item.year}` : ""}</p>
              {item.because.length ? (
                <p className="mt-0.5 truncate font-ui text-xs text-[var(--ink-faint)]" title={`因为《${item.because.join("》《")}》`}>
                  因为《{item.because.join("》《")}》
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => want(item.tmdbId)}
                disabled={isAdding || isAdded}
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-ui text-xs font-medium transition-colors disabled:opacity-70",
                  isAdded
                    ? "border-primary/40 bg-accent text-primary"
                    : "border-border text-primary hover:bg-accent"
                )}
              >
                {isAdding ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : isAdded ? (
                  <Check className="size-3.5" strokeWidth={2} />
                ) : (
                  <Plus className="size-3.5" strokeWidth={2} />
                )}
                {isAdded ? "已加入想看" : "想看"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
