"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Check, Loader2 } from "lucide-react";
import { loadBookRecommendationsAction, addRecommendedBookAction } from "@/actions/recommendations";
import { BookCover } from "@/components/domain/visual-system";
import { CoverImage } from "@/components/domain/cover-image";
import { cn } from "@/lib/utils";

function Cover({ title, coverUrl, index }) {
  if (coverUrl) {
    return (
      <CoverImage
        src={coverUrl}
        sizes="(max-width: 768px) 40vw, 180px"
        className="aspect-[2/3] w-full rounded-md border border-border bg-muted shadow-sm"
        imageClassName="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.05]"
      />
    );
  }
  const variants = ["cream", "navy", "blue", "gold", "forest", "red"];
  return <BookCover title={title} variant={variants[index % variants.length]} className="aspect-[2/3] w-full" />;
}

export function BookRecommendations() {
  const router = useRouter();
  const [items, setItems] = useState(null); // null = 加载中
  const [addingId, setAddingId] = useState(null);
  const [added, setAdded] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    loadBookRecommendationsAction()
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

  // 加载中或确无推荐：不渲染（避免空区块闪现）
  if (items === null || items.length === 0) {
    return null;
  }

  async function want(olKey) {
    setAddingId(olKey);
    try {
      const res = await addRecommendedBookAction(olKey);
      if (res?.status === "created") {
        setAdded((prev) => new Set(prev).add(olKey));
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
          <h2 className="font-display text-2xl font-semibold leading-tight text-[var(--ink)]">为你推荐 · 图书</h2>
        </div>
      </div>
      <p className="ink-subtitle mt-2 text-sm">根据你库里偏好的类型，从 OpenLibrary 挑的、你还没有的新书。</p>

      <div className="ink-rise-stagger mt-6 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-8">
        {items.map((item, index) => {
          const isAdded = added.has(item.olKey);
          const isAdding = addingId === item.olKey;
          return (
            <article key={item.olKey} className="group min-w-0">
              <Cover title={item.title} coverUrl={item.coverUrl} index={index} />
              <h3 className="mt-3 truncate font-display text-base font-semibold text-[var(--ink)]" title={item.title}>
                {item.title}
              </h3>
              {item.author ? <p className="truncate font-ui text-sm text-muted-foreground">{item.author}</p> : null}
              {item.because.length ? (
                <p className="mt-0.5 truncate font-ui text-xs text-[var(--ink-faint)]" title={`偏好：${item.because.join(" · ")}`}>
                  {item.because.join(" · ")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => want(item.olKey)}
                disabled={isAdding || isAdded}
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-ui text-xs font-medium transition-colors disabled:opacity-70",
                  isAdded ? "border-primary/40 bg-accent text-primary" : "border-border text-primary hover:bg-accent"
                )}
              >
                {isAdding ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : isAdded ? (
                  <Check className="size-3.5" strokeWidth={2} />
                ) : (
                  <Plus className="size-3.5" strokeWidth={2} />
                )}
                {isAdded ? "已加入想读" : "想读"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
