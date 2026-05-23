"use client";

import { useActionState } from "react";

import { loadLibraryDashboardAction } from "@/actions/library-dashboard";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import {
  initialLibraryDashboardActionState,
  type DashboardEntryView,
  type LibraryDashboardData,
  type LibraryEntryView,
  type SeedRecommendationView,
  type StalledEntryView,
} from "@/schemas/library-dashboard";

type LibraryDashboardClientProps = {
  mode: "library" | "dashboard";
};

function mediaLabel(mediaType: "book" | "movie") {
  return mediaType === "book" ? "书" : "电影";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    want_to_read: "想读",
    reading: "在读",
    finished: "读完",
    abandoned: "放弃",
    want_to_watch: "想看",
    watching: "在看",
    watched: "看完",
  };

  return labels[status] ?? status;
}

function ratingLabel(ratingX10?: number) {
  return ratingX10 ? `${(ratingX10 / 10).toFixed(1)} 分` : "未评分";
}

function shortDate(value?: string) {
  if (!value) {
    return "未记录";
  }

  return value.slice(0, 10);
}

function LibraryLoader({
  message,
  pending,
  formAction,
}: {
  message?: string;
  pending: boolean;
  formAction: (payload: FormData) => void;
}) {
  return (
    <form action={formAction} className="grid gap-4 border border-[#d8d2c4] bg-[#fffdf8] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <OfflineSubmitButton pending={pending} pendingLabel="加载中">
          加载我的库
        </OfflineSubmitButton>
        {message ? <p className="text-sm text-[#3f4945]">{message}</p> : null}
      </div>
    </form>
  );
}

function SeedRecommendations({ items }: { items: SeedRecommendationView[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <a
          className="grid gap-2 border border-[#d8d2c4] bg-[#fffdf8] p-4 text-[#1f2423]"
          href={item.href}
          key={`${item.media_type}:${item.title}`}
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[#6c675f]">
            {mediaLabel(item.media_type)} · {item.provider}
          </p>
          <h3 className="text-lg font-semibold">{item.title}</h3>
          <p className="text-sm text-[#5f665f]">
            {item.year} · {item.subtitle}
          </p>
        </a>
      ))}
    </div>
  );
}

function LibraryCard({ entry }: { entry: LibraryEntryView }) {
  return (
    <article className="grid gap-3 border border-[#d8d2c4] bg-[#fffdf8] p-4 md:grid-cols-[72px_1fr]">
      <div className="aspect-[2/3] border border-[#d8d2c4] bg-[#efe8d8]">
        {entry.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-full w-full object-cover" src={entry.cover_url} />
        ) : null}
      </div>
      <div className="grid gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#6c675f]">
            {mediaLabel(entry.media_type)} · {statusLabel(entry.status)}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{entry.title}</h3>
          <p className="text-sm text-[#5f665f]">
            {entry.year ?? "未知年份"} · {ratingLabel(entry.rating_x10)}
          </p>
        </div>
        <dl className="grid gap-1 text-xs text-[#5f665f] sm:grid-cols-2">
          <div>
            <dt className="font-medium text-[#3f4945]">可见性</dt>
            <dd>{entry.visibility_scope}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#3f4945]">更新</dt>
            <dd>{shortDate(entry.updated_at)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function DashboardList({
  title,
  items,
  empty,
}: {
  title: string;
  items: DashboardEntryView[];
  empty: string;
}) {
  return (
    <section className="grid gap-3 border border-[#d8d2c4] bg-[#fffdf8] p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <div className="grid gap-1 border-t border-[#ebe5d7] pt-3" key={item.entry_id}>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-[#5f665f]">
                {mediaLabel(item.media_type)} · {statusLabel(item.status)} ·{" "}
                {ratingLabel(item.rating_x10)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#5f665f]">{empty}</p>
      )}
    </section>
  );
}

function StalledList({ items }: { items: StalledEntryView[] }) {
  return (
    <section className="grid gap-3 border border-[#d8d2c4] bg-[#fffdf8] p-5">
      <h2 className="text-base font-semibold">停滞条目</h2>
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <div className="grid gap-1 border-t border-[#ebe5d7] pt-3" key={item.entry_id}>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-[#5f665f]">
                {mediaLabel(item.media_type)} · {statusLabel(item.status)} · 上次更新{" "}
                {shortDate(item.updated_at)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#5f665f]">没有超过 14 天未更新的在读 / 在看条目。</p>
      )}
    </section>
  );
}

function DashboardView({ data }: { data: LibraryDashboardData }) {
  const yearRing = data.dashboard.year_ring;
  const percent = Math.min(100, Math.round((yearRing.completed_this_year / yearRing.goal) * 100));

  return (
    <div className="grid gap-5">
      {data.use_seed ? (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">P0 seed 推荐</h2>
          <SeedRecommendations items={data.seed_recommendations} />
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <DashboardList
          empty="没有正在阅读或观看的条目。"
          items={data.dashboard.continue_reading}
          title="继续阅读 / 观看"
        />
        <DashboardList
          empty="还没有完成记录。"
          items={data.dashboard.recent_finished}
          title="最近完成"
        />
        <StalledList items={data.dashboard.stalled} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <section className="min-h-48 border border-dashed border-[#c9c2b3] bg-[#fffdf8] p-5">
          <h2 className="text-base font-semibold">热力图占位</h2>
          <div className="mt-5 grid grid-cols-12 gap-1">
            {Array.from({ length: 84 }).map((_, index) => (
              <span
                className="aspect-square border border-[#e6dfd1] bg-[#f1eadc]"
                key={index}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-[#5f665f]">{data.dashboard.heatmap_placeholder.reason}</p>
        </section>

        <section className="grid place-items-center border border-[#d8d2c4] bg-[#fffdf8] p-5 text-center">
          <div>
            <p className="text-sm text-[#6c675f]">年度环</p>
            <div className="mt-4 grid size-36 place-items-center rounded-full border-[14px] border-[#315f53] bg-[#eef4f1]">
              <div>
                <p className="text-3xl font-semibold">{yearRing.completed_this_year}</p>
                <p className="text-xs text-[#5f665f]">/ {yearRing.goal}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-[#5f665f]">{percent}% completed</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function LibraryView({ data }: { data: LibraryDashboardData }) {
  if (data.use_seed) {
    return (
      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">P0 seed 推荐</h2>
          <p className="mt-1 text-sm text-[#5f665f]">
            当前账号没有真实条目；添加第一本书或电影后这里会切换为真实库。
          </p>
        </div>
        <SeedRecommendations items={data.seed_recommendations} />
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">真实条目</h2>
        <p className="text-sm text-[#5f665f]">{data.entry_count} items</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.library.map((entry) => (
          <LibraryCard entry={entry} key={entry.entry_id} />
        ))}
      </div>
    </section>
  );
}

export function LibraryDashboardClient({ mode }: LibraryDashboardClientProps) {
  const [state, formAction, pending] = useActionState(
    loadLibraryDashboardAction,
    initialLibraryDashboardActionState,
  );
  const data = state.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="grid content-start gap-5">
        <LibraryLoader
          formAction={formAction}
          message={state.message}
          pending={pending}
        />
        <div className="grid gap-2 border border-[#d8d2c4] bg-[#fffdf8] p-5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[#6c675f]">真实条目</span>
            <strong>{data.entry_count}</strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[#6c675f]">当前模式</span>
            <strong>{data.use_seed ? "Seed" : "真实库"}</strong>
          </div>
          <div className="flex flex-wrap gap-3 pt-2 text-[#315f53]">
            <a href="/add/book">添加书籍</a>
            <a href="/add/movie">添加电影</a>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        {mode === "dashboard" ? <DashboardView data={data} /> : <LibraryView data={data} />}
      </main>
    </div>
  );
}
