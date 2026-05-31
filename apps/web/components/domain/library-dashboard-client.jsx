"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, startTransition } from "react";
import { loadLibraryDashboardAction } from "@/actions/library-dashboard";
import { loadRecentActivity } from "@/actions/activity";
import { loadNextPicks } from "@/actions/dashboard-picks";
import { fetchReadingTraces } from "@/actions/reading-traces";
import { initialLibraryDashboardActionState } from "@/schemas/library-dashboard";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronLeft, ChevronRight, Clapperboard, Clock3, PencilLine, RefreshCw, Search } from "lucide-react";
import { BookCover, PanelTitle, StatLine } from "@/components/domain/visual-system";
import { LogReadingModal } from "@/components/domain/log-reading-modal";
import { StatusToggle } from "@/components/domain/status-toggle";
import { DeleteEntryButton } from "@/components/domain/delete-entry-button";
import { AddToListButton } from "@/components/domain/add-to-list-button";
import { fetchCoverByTitle } from "@/lib/covers/fetch-cover";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  want_to_read: "想读",
  reading: "在读",
  finished: "读过",
  abandoned: "放弃",
  want_to_watch: "想看",
  watching: "在看",
  watched: "看过",
};

const coverVariants = ["navy", "blue", "cream", "gold", "forest", "red"];

const ACTIVITY_ICONS = { book: BookOpen, movie: Clapperboard, read: Clock3, note: PencilLine };

function mediaLabel(mediaType) {
  return mediaType === "movie" ? "影视" : "图书";
}

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

function ratingDisplay(ratingX10) {
  if (!ratingX10) return null;
  return (ratingX10 / 10).toFixed(1);
}

function shortDate(value) {
  if (!value) return "未记录";
  return value.slice(0, 10);
}

function coverVariant(index) {
  return coverVariants[index % coverVariants.length];
}

function CoverThumb({ entry, title, variant = "navy", className }) {
  const explicitCover = entry?.cover_url;
  const coverTitle = entry?.title ?? title;
  const mediaType = entry?.media_type;
  const [fetchedCover, setFetchedCover] = useState(null);

  // When the entry has no stored cover, look one up by title from the providers.
  useEffect(() => {
    if (explicitCover || !coverTitle) return;
    let cancelled = false;
    fetchCoverByTitle(coverTitle, mediaType).then((url) => {
      if (!cancelled && url) setFetchedCover(url);
    });
    return () => {
      cancelled = true;
    };
  }, [explicitCover, coverTitle, mediaType]);

  const coverUrl = explicitCover || fetchedCover;
  if (coverUrl) {
    return (
      <div className={cn("shrink-0 overflow-hidden rounded-sm border border-border bg-muted shadow-sm", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.05]"
        />
      </div>
    );
  }

  return <BookCover title={coverTitle} variant={variant} className={cn("shrink-0", className)} />;
}

function SyncStrip({ pending, message, onReload }) {
  return (
    <div className="ink-card-soft flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <RefreshCw className={cn("size-5 text-muted-foreground", pending && "animate-spin")} strokeWidth={1.5} />
        <span className="font-ui truncate text-sm text-[var(--ink-soft)]">
          {pending ? "正在同步你的阅迹记录。" : message || "当前显示同步推荐。同步后会显示你的真实记录。"}
        </span>
      </div>
      <button
        type="button"
        onClick={onReload}
        disabled={pending}
        className="font-ui shrink-0 text-sm font-medium text-primary hover:underline disabled:opacity-50"
      >
        同步
      </button>
    </div>
  );
}

function ContinueCard({ items, recommendations, mediaType }) {
  const filtered = mediaType ? items.filter((item) => item.media_type === mediaType) : items;
  const suggestion = recommendations.find((item) => !mediaType || item.media_type === mediaType) ?? recommendations[0];
  const current = filtered[0] ?? suggestion;
  const isSuggestion = !filtered[0];

  if (!current) {
    return (
      <EmptyState
        icon={BookOpen}
        title="今天还没有继续项"
        description="从图书库或影视库添加一个条目，或在「想读 / 想看」里挑一个，这里就会显示。"
      />
    );
  }

  const progress = isSuggestion ? 0 : Math.max(12, Math.min(92, current.progress_percent ?? 58));
  const coverEntry =
    filtered[0] ?? (current.cover_url ? { cover_url: current.cover_url, title: current.title, media_type: current.media_type } : undefined);

  return (
    <section className="ink-card relative overflow-hidden p-0">
      {/* 氛围底：暖+冷两团柔光，营造「书在发光」的沉浸感 */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 -top-8 h-64 w-80 rounded-full bg-[radial-gradient(circle,hsl(38_64%_66%/0.22),transparent_70%)] blur-2xl" />
        <div className="absolute -right-10 top-0 h-56 w-80 rounded-full bg-[radial-gradient(circle,hsl(207_58%_68%/0.3),transparent_70%)] blur-2xl" />
      </div>
      <div className="relative z-10 p-6 md:p-7">
        <PanelTitle title={isSuggestion ? "从这个开始" : "今天继续"} suffix="CONTINUE" />
        <div className="mt-6 grid items-start gap-7 sm:grid-cols-[176px_1fr]">
          <div className="relative w-44 shrink-0">
            {/* 封面下方的暗色光晕 = 漂浮的厚重投影 */}
            <div aria-hidden className="absolute inset-x-2 -bottom-1 top-5 rounded-xl bg-[hsl(212_45%_20%/0.42)] blur-2xl" />
            <CoverThumb entry={coverEntry} title={current.title} variant="navy" className="relative aspect-[2/3] w-44" />
          </div>
          <div className="min-w-0 py-1">
            <h3 className="font-display text-4xl font-semibold leading-[1.05] text-[var(--ink)] md:text-5xl">{current.title}</h3>
            <p className="mt-3 font-ui text-sm text-[var(--ink-soft)]">
              {statusLabel(current.status)}
              {isSuggestion ? "" : (
                <span className="ml-1.5 font-display text-base font-semibold text-[var(--blue-deep)]">{progress}%</span>
              )}
            </p>
            {isSuggestion ? null : (
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[hsl(var(--muted))] shadow-[inset_0_1px_2px_hsl(212_30%_30%/0.12)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--blue),var(--sky))]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <p className="mt-4 font-ui text-sm text-muted-foreground">
              {isSuggestion ? current.subtitle ?? "在你的清单里等你翻开。" : `更新于 ${shortDate(current.updated_at)}`}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
            {isSuggestion ? (
              <>
                <Link href={current.href} className="ink-button inline-flex h-10 items-center gap-2 px-5 text-sm font-medium no-underline">
                  查看详情
                  <ChevronRight className="size-4" />
                </Link>
                <Link href="/lists/wishlist" className="ink-button-outline inline-flex h-10 items-center gap-2 px-5 text-sm font-medium no-underline">
                  更多想读想看
                </Link>
              </>
            ) : (
              <>
                <Link href="/library" className="ink-button inline-flex h-10 items-center gap-2 px-5 text-sm font-medium no-underline">
                  <PencilLine className="size-4" />
                  继续记录
                </Link>
                <Link href="/lists/wishlist" className="ink-button-outline inline-flex h-10 items-center gap-2 px-5 text-sm font-medium no-underline">
                  想读想看
                  <ChevronRight className="size-4" />
                </Link>
              </>
            )}
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ActivityTimeline() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    loadRecentActivity()
      .then((res) => {
        if (alive) setItems(res.items ?? []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="ink-card p-5">
      <PanelTitle title="最近留下的痕迹" suffix="ACTIVITY" />
      {items === null ? (
        <div className="mt-5 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-md bg-accent/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-5 font-ui text-sm text-muted-foreground">
          还没有留下痕迹。去库里加本书、记录阅读，或写条短评，这里就会出现。
        </p>
      ) : (
        <ol className="mt-5 space-y-4">
          {items.map((item) => {
            const Icon = ACTIVITY_ICONS[item.kind] ?? BookOpen;
            return (
              <li className="grid grid-cols-[28px_44px_1fr_auto] items-center gap-3" key={item.id}>
                <span className="size-2 rounded-full border border-primary bg-background" />
                <span className="grid size-11 place-items-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[var(--ink)]">{item.text}</p>
                  <p className="font-ui text-xs text-muted-foreground">{item.time}</p>
                </div>
                <span className="font-ui rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">{item.tag}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

const TRACE_LEVELS = [
  { min: 1, bg: "#d6e8f7", text: "var(--ink)" },
  { min: 10, bg: "#8bb9e6", text: "var(--ink)" },
  { min: 30, bg: "#4a8ec9", text: "#fff" },
  { min: 60, bg: "#1a5f9e", text: "#fff" },
];

function traceStyle(pages) {
  if (!pages || pages <= 0) return null;
  let level = TRACE_LEVELS[0];
  for (const candidate of TRACE_LEVELS) {
    if (pages >= candidate.min) level = candidate;
  }
  return { backgroundColor: level.bg, color: level.text };
}

function buildCalendarCells(year, month) {
  // Monday-first grid: leading blanks + each day-of-month.
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const leadingBlanks = (firstWeekday + 6) % 7;
  return [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
}

function TraceCalendar() {
  // `view` drives the fetch (null = current month, resolved server-side in the
  // profile's tz). `traces` is the RPC response and is the sole render source,
  // so the component never computes dates client-side (no hydration mismatch).
  const [view, setView] = useState(null);
  const [traces, setTraces] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchReadingTraces(view?.year ?? null, view?.month ?? null).then((result) => {
      if (!cancelled && result.data) setTraces(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [view]);

  // Loading until the loaded data matches the requested month.
  const loading =
    !traces || (view && (traces.year !== view.year || traces.month !== view.month));

  const goMonth = (delta) => {
    const base = view ?? (traces ? { year: traces.year, month: traces.month } : null);
    if (!base) return;
    const next = new Date(base.year, base.month - 1 + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() + 1 });
  };

  if (!traces) {
    return (
      <section className="ink-card p-5">
        <PanelTitle title="本月痕迹" suffix="TRACES" />
        <Skeleton className="mt-4 h-64 w-full" />
      </section>
    );
  }

  const cells = buildCalendarCells(traces.year, traces.month);
  // `today` is non-null only when the displayed month is the current month.
  const isCurrentMonth = traces.today != null;

  return (
    <section className="ink-card p-5">
      <PanelTitle title="本月痕迹" suffix="TRACES" />
      <div className="mt-4 flex items-center justify-between px-2 font-display text-2xl font-semibold text-[var(--ink)]">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          aria-label="上个月"
          className="grid size-8 place-items-center rounded-md text-primary/70 transition-colors hover:bg-accent hover:text-primary"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span>{traces.year}年{traces.month}月</span>
        <button
          type="button"
          onClick={() => goMonth(1)}
          disabled={isCurrentMonth}
          aria-label="下个月"
          className="grid size-8 place-items-center rounded-md text-primary/70 transition-colors hover:bg-accent hover:text-primary disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div
        className={cn(
          "mt-4 grid grid-cols-7 border-l border-t border-border text-center font-ui text-sm transition-opacity",
          loading && "opacity-50"
        )}
      >
        {["一", "二", "三", "四", "五", "六", "日"].map((label) => (
          <span className="border-b border-r border-border py-2 text-muted-foreground" key={label}>
            {label}
          </span>
        ))}
        {cells.map((day, index) => {
          if (day === null) {
            return <span className="border-b border-r border-border py-2" key={`blank-${index}`} />;
          }
          const pages = traces.days?.[day] ?? 0;
          const style = traceStyle(pages);
          const isToday = day === traces.today;
          return (
            <span
              key={day}
              style={style ?? undefined}
              title={pages > 0 ? `${traces.month}月${day}日 · ${pages} 页` : `${traces.month}月${day}日`}
              className={cn(
                "border-b border-r border-border py-2 text-[var(--ink)]",
                isToday && "font-semibold ring-1 ring-inset ring-primary"
              )}
            >
              {day}
            </span>
          );
        })}
      </div>
      <p className="mt-4 font-ui text-sm text-muted-foreground">
        本月 {traces.total_pages ?? 0} 页 · 颜色越深，读得越多
      </p>
    </section>
  );
}

function YearSummary({ data }) {
  const library = data.library ?? [];
  const readCount = library.filter((item) => item.media_type === "book" && item.status === "finished").length;
  const watchedCount = library.filter((item) => item.media_type === "movie" && item.status === "watched").length;
  const writtenCount = library.filter((item) => item.rating_x10 || item.review).length;
  const read = readCount;
  const watched = watchedCount;
  const written = writtenCount;
  const completed = data.dashboard.year_ring.completed_this_year || 0;
  const goal = data.dashboard.year_ring.goal || 24;

  return (
    <section className="ink-card p-5">
      <PanelTitle title="今年留下的记录" suffix="THIS YEAR" />
      <div className="mt-5">
        <StatLine
          items={[
            { label: "读过", value: read, unit: "本" },
            { label: "看过", value: watched, unit: "部" },
            { label: "写过", value: written, unit: "条" },
          ]}
        />
      </div>
      <div className="mt-5 border-t border-border pt-4 font-ui text-sm text-muted-foreground">
        年度目标 <span className="font-display text-2xl font-semibold text-[var(--ink)]">{completed}</span>
        /{goal}
      </div>
    </section>
  );
}

function NextPickCard({ recommendations, mediaType }) {
  const pick = recommendations.find((item) => !mediaType || item.media_type === mediaType) ?? recommendations[0];
  if (!pick) return null;

  const isMovie = pick.media_type === "movie";

  return (
    <section className="ink-card p-5">
      <PanelTitle title={isMovie ? "下一部看这个？" : "下一本读这个？"} />
      <Link href={pick.href} className="mt-5 grid grid-cols-[84px_1fr] gap-4 no-underline">
        {pick.cover_url ? (
          <div className="aspect-[2/3] w-20 overflow-hidden rounded-sm border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pick.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        ) : (
          <BookCover title={pick.title} variant={isMovie ? "blue" : "navy"} className="aspect-[2/3] w-20" />
        )}
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-semibold leading-tight text-[var(--ink)]">{pick.title}</h3>
          <p className="mt-1 font-ui text-sm text-[var(--ink-soft)]">
            {pick.year ? `${pick.year} · ` : ""}
            {pick.provider}
          </p>
          <p className="ink-subtitle mt-2 text-sm">{pick.subtitle || "从一个条目开始，建立你的阅迹轨迹。"}</p>
          <span className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-medium text-primary">
            查看详情
            <ChevronRight className="size-4" />
          </span>
        </div>
      </Link>
    </section>
  );
}

function DashboardView({ data, mediaType }) {
  const [picks, setPicks] = useState([]);

  useEffect(() => {
    let alive = true;
    loadNextPicks()
      .then((res) => {
        if (alive) setPicks(res.picks ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]">
      <div className="ink-rise-stagger space-y-6">
        <ContinueCard items={data.dashboard.continue_reading} recommendations={picks} mediaType={mediaType} />
        <ActivityTimeline />
      </div>
      <aside className="ink-rise-stagger space-y-6">
        <TraceCalendar />
        <YearSummary data={data} />
        <NextPickCard recommendations={picks} mediaType={mediaType} />
      </aside>
    </div>
  );
}

function LibraryCard({ entry, index, onChanged }) {
  const rating = ratingDisplay(entry.rating_x10);
  const [logOpen, setLogOpen] = useState(false);
  const canLogReading = entry.media_type === "book" && entry.status === "reading";

  return (
    <article className="group min-w-0">
      <CoverThumb entry={entry} variant={coverVariant(index)} className="aspect-[2/3] w-full" />
      <h3 className="mt-3 truncate font-display text-base font-semibold text-[var(--ink)]">{entry.title}</h3>
      <div className="mt-1 flex items-center gap-2 font-ui text-sm text-muted-foreground">
        <span>{mediaLabel(entry.media_type)}</span>
        <span aria-hidden="true">·</span>
        <StatusToggle entry={entry} onChanged={onChanged} />
      </div>
      <p className="font-ui text-sm text-[var(--ink-soft)]">
        {entry.year ?? "未知年份"}
        {rating ? <span className="gold-star ml-2">★ {rating}</span> : null}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canLogReading && (
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-ui text-xs font-medium text-primary transition-colors hover:bg-accent"
          >
            <PencilLine className="size-3.5" strokeWidth={1.8} />
            记录阅读
          </button>
        )}
        <AddToListButton workId={entry.work_id} entryId={entry.entry_id} onChanged={onChanged} />
        <DeleteEntryButton entryId={entry.entry_id} onDeleted={onChanged} />
      </div>
      {canLogReading && <LogReadingModal open={logOpen} onOpenChange={setLogOpen} entry={entry} />}
    </article>
  );
}

function StarterPanel({ mediaType, onAddWork }) {
  const isMovie = mediaType === "movie";
  return (
    <section className="ink-card grid items-center gap-6 p-7 md:grid-cols-[180px_1fr]">
      <div className="mx-auto grid size-36 place-items-center rounded-full bg-accent">
        <BookCover title={isMovie ? "FILM" : "BOOK"} variant={isMovie ? "blue" : "cream"} className="aspect-[2/3] w-24" />
      </div>
      <div>
        <h2 className="font-display text-3xl font-semibold text-[var(--ink)]">
          {isMovie ? "影库还在等第一部电影" : "书架还在等第一本书"}
        </h2>
        <p className="ink-subtitle mt-3">搜索添加，或导入你已有的记录。</p>
        <div className="mt-6 flex flex-wrap gap-4">
          {onAddWork ? (
            <button
              type="button"
              onClick={onAddWork}
              className="ink-button inline-flex h-11 items-center gap-2 px-6 text-sm font-medium"
            >
              <Search className="size-4" />
              {isMovie ? "搜索添加电影" : "搜索添加书籍"}
            </button>
          ) : (
            <Link href={isMovie ? "/add/movie" : "/add/book"} className="ink-button inline-flex h-11 items-center gap-2 px-6 text-sm font-medium no-underline">
              <Search className="size-4" />
              {isMovie ? "搜索添加电影" : "搜索添加书籍"}
            </Link>
          )}
          <Link href="/add/import" className="ink-button-outline inline-flex h-11 items-center px-6 text-sm font-medium no-underline">
            导入记录
          </Link>
        </div>
      </div>
    </section>
  );
}

function LibraryView({ data, mediaType, status, onAddWork, onChanged }) {
  // 先按媒介过滤（决定是否显示空库引导），再按状态过滤（决定网格内容）
  const mediaFiltered = useMemo(() => {
    if (!mediaType) return data.library;
    return data.library.filter((entry) => entry.media_type === mediaType);
  }, [data.library, mediaType]);

  const filtered = useMemo(
    () => (status ? mediaFiltered.filter((entry) => entry.status === status) : mediaFiltered),
    [mediaFiltered, status]
  );

  if (mediaFiltered.length === 0) {
    return <StarterPanel mediaType={mediaType} onAddWork={onAddWork} />;
  }

  return (
    <div className="space-y-6">
      <p className="font-ui text-sm text-[var(--ink-soft)]">共 {filtered.length} 个条目</p>
      {filtered.length === 0 ? (
        <p className="py-12 text-center font-ui text-sm text-muted-foreground">这个状态下还没有条目。</p>
      ) : (
        <div className="ink-rise-stagger grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-6 gap-y-8">
          {filtered.map((entry, index) => (
            <LibraryCard entry={entry} index={index} key={entry.entry_id} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]">
      <div className="space-y-5">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    </div>
  );
}

export function LibraryDashboardClient({ mode, mediaType, status, onAddWork }) {
  const [state, formAction, pending] = useActionState(
    loadLibraryDashboardAction,
    initialLibraryDashboardActionState
  );
  const data = state.data;

  useEffect(() => {
    if (state.status === "idle") {
      startTransition(() => {
        formAction(new FormData());
      });
    }
  }, [state.status, formAction]);

  const handleReload = () => {
    startTransition(() => {
      formAction(new FormData());
    });
  };

  const isInitialLoading = pending && state.status === "idle";

  return (
    <div className="space-y-6">
      <SyncStrip pending={pending} message={state.message} onReload={handleReload} />
      {isInitialLoading ? (
        <DashboardSkeleton />
      ) : mode === "dashboard" ? (
        <DashboardView data={data} mediaType={mediaType} />
      ) : (
        <LibraryView data={data} mediaType={mediaType} status={status} onAddWork={onAddWork} onChanged={handleReload} />
      )}
    </div>
  );
}
