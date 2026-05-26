"use client";

import { useActionState, useEffect, useMemo, startTransition } from "react";
import { loadLibraryDashboardAction } from "@/actions/library-dashboard";
import { initialLibraryDashboardActionState } from "@/schemas/library-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Film, Sparkles, RefreshCw, CalendarDays, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  want_to_read: "想读",
  reading: "在读",
  finished: "读完",
  abandoned: "放弃",
  want_to_watch: "想看",
  watching: "在看",
  watched: "看完",
};

function mediaLabel(mediaType) {
  return mediaType === "book" ? "书" : "电影";
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

function CoverThumb({ url, mediaType, size = "md" }) {
  const sizes = {
    sm: "w-12 h-[72px]",
    md: "w-16 h-24",
    lg: "w-24 h-36",
  };
  const Icon = mediaType === "movie" ? Film : BookOpen;
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-md bg-[#E7E8E7] flex items-center justify-center",
        sizes[size]
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon className="size-5 text-[#394A56]/40" />
      )}
    </div>
  );
}

function InProgressCard({ items, mediaType }) {
  const filtered = mediaType
    ? items.filter((item) => item.media_type === mediaType)
    : items;
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#22303F]">进行中</h2>
          {filtered.length > 0 ? (
            <span className="text-xs text-[#394A56]/60">{filtered.length} 个</span>
          ) : null}
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-[#394A56]/60 py-4">暂无进行中的{mediaType ? mediaLabel(mediaType) : "条目"}。</p>
        ) : (
          <ul className="space-y-3">
            {filtered.slice(0, 4).map((item) => (
              <li key={item.entry_id} className="flex gap-3">
                <CoverThumb url={item.cover_url} mediaType={item.media_type} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#22303F] truncate">{item.title}</p>
                  <p className="text-xs text-[#394A56]/60 mt-0.5">
                    {mediaLabel(item.media_type)} · {statusLabel(item.status)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityList({ items, title, emptyText }) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-base font-semibold text-[#22303F] mb-4">{title}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-[#394A56]/60 py-4">{emptyText}</p>
        ) : (
          <ul className="space-y-3">
            {items.slice(0, 5).map((item) => {
              const rating = ratingDisplay(item.rating_x10);
              return (
                <li key={item.entry_id} className="flex items-baseline justify-between gap-3 border-b border-[#E7E8E7] last:border-0 pb-2 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#22303F] truncate">{item.title}</p>
                    <p className="text-xs text-[#394A56]/60 mt-0.5">
                      {mediaLabel(item.media_type)} · {statusLabel(item.status)}
                    </p>
                  </div>
                  {rating ? (
                    <span className="text-sm font-semibold text-[#2C6485]">{rating}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function YearSummaryInline({ yearRing }) {
  const percent = Math.min(100, Math.round((yearRing.completed_this_year / yearRing.goal) * 100));
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="size-4 text-[#2C6485]" />
          <h2 className="text-base font-semibold text-[#22303F]">年度目标</h2>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#22303F]">{yearRing.completed_this_year}</span>
          <span className="text-sm text-[#394A56]/60">/ {yearRing.goal}</span>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#E7E8E7]">
          <div
            className="h-full rounded-full bg-[#2C6485] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#394A56]/60">{percent}% 已完成</p>
      </CardContent>
    </Card>
  );
}

function MonthlyTraceMini() {
  const cells = Array.from({ length: 35 }).map((_, i) => i);
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="size-4 text-[#2C6485]" />
          <h2 className="text-base font-semibold text-[#22303F]">最近活跃</h2>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((i) => (
            <span
              key={i}
              className={cn(
                "aspect-square rounded-sm",
                i % 7 === 3 || i % 5 === 0 ? "bg-[#8FBFDA]" : "bg-[#E7E8E7]"
              )}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-[#394A56]/60">最近 5 周记录</p>
      </CardContent>
    </Card>
  );
}

function NextPickCard({ seedRecommendations, mediaType }) {
  const filtered = mediaType
    ? seedRecommendations.filter((item) => item.media_type === mediaType)
    : seedRecommendations;
  const pick = filtered[0];
  if (!pick) return null;
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="size-4 text-[#2C6485]" />
          <h2 className="text-base font-semibold text-[#22303F]">下一本推荐</h2>
        </div>
        <a href={pick.href} className="block group">
          <p className="text-base font-medium text-[#22303F] group-hover:text-[#2C6485] transition-colors">
            {pick.title}
          </p>
          <p className="mt-1 text-xs text-[#394A56]/60">
            {pick.year} · {pick.provider} · {mediaLabel(pick.media_type)}
          </p>
          <p className="mt-2 text-xs text-[#394A56]/70">{pick.subtitle}</p>
        </a>
      </CardContent>
    </Card>
  );
}

function SyncStrip({ pending, message, onReload }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#E7E8E7] bg-white px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("size-2 rounded-full", pending ? "bg-[#8FBFDA] animate-pulse" : "bg-[#2C6485]")} />
        <span className="text-xs text-[#394A56] truncate">
          {pending ? "正在同步…" : message || "已就绪"}
        </span>
      </div>
      <button
        type="button"
        onClick={onReload}
        disabled={pending}
        className="text-xs text-[#2C6485] hover:underline disabled:opacity-50 inline-flex items-center gap-1"
      >
        <RefreshCw className="size-3" />
        刷新
      </button>
    </div>
  );
}

function EmptyStarter({ mediaType }) {
  const isMovie = mediaType === "movie";
  return (
    <EmptyState
      icon={isMovie ? Film : BookOpen}
      title={isMovie ? "还没有添加电影" : "还没有添加图书"}
      description={isMovie ? "添加你看过的第一部电影开始建立影视库。" : "添加你看过的第一本书开始建立图书库。"}
    />
  );
}

function LibraryCard({ entry }) {
  const rating = ratingDisplay(entry.rating_x10);
  return (
    <article className="flex gap-4 rounded-lg border border-[#E7E8E7] bg-white p-4 hover:shadow-sm transition-shadow">
      <CoverThumb url={entry.cover_url} mediaType={entry.media_type} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-[#394A56]/60">
          {mediaLabel(entry.media_type)} · {statusLabel(entry.status)}
        </p>
        <h3 className="mt-1 text-base font-semibold text-[#22303F] truncate">{entry.title}</h3>
        <p className="mt-1 text-sm text-[#394A56]/70">
          {entry.year ?? "未知年份"}
          {rating ? <span className="ml-2 text-[#2C6485] font-medium">★ {rating}</span> : null}
        </p>
        <p className="mt-2 text-xs text-[#394A56]/50">
          更新于 {shortDate(entry.updated_at)}
        </p>
      </div>
    </article>
  );
}

function DashboardView({ data, mediaType }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <InProgressCard items={data.dashboard.continue_reading} mediaType={mediaType} />
        <ActivityList
          items={data.dashboard.recent_finished}
          title="最近完成"
          emptyText="还没有完成的条目。完成一本书或一部电影后会出现在这里。"
        />
        <ActivityList
          items={data.dashboard.stalled}
          title="停滞条目"
          emptyText="没有超过 14 天未更新的进行中条目。"
        />
      </div>
      <div className="space-y-4">
        <YearSummaryInline yearRing={data.dashboard.year_ring} />
        <MonthlyTraceMini />
        <NextPickCard seedRecommendations={data.seed_recommendations} mediaType={mediaType} />
      </div>
    </div>
  );
}

function LibraryView({ data, mediaType }) {
  const filtered = useMemo(() => {
    if (!mediaType) return data.library;
    return data.library.filter((entry) => entry.media_type === mediaType);
  }, [data.library, mediaType]);

  if (data.use_seed || filtered.length === 0) {
    return <EmptyStarter mediaType={mediaType} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#394A56]/70">
          共 {filtered.length} 个条目
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((entry) => (
          <LibraryCard entry={entry} key={entry.entry_id} />
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

export function LibraryDashboardClient({ mode, mediaType }) {
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
    <div className="space-y-4">
      <SyncStrip pending={pending} message={state.message} onReload={handleReload} />
      {isInitialLoading ? (
        <DashboardSkeleton />
      ) : mode === "dashboard" ? (
        <DashboardView data={data} mediaType={mediaType} />
      ) : (
        <LibraryView data={data} mediaType={mediaType} />
      )}
    </div>
  );
}
