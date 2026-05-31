"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Film, X, Loader2 } from "lucide-react";
import { loadWatchMonth, removeWatchEvent, loadWatchStats } from "@/actions/watch-events";
import { LogWatchModal } from "./log-watch-modal";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

// Monday-first grid: leading blanks + each day-of-month.
function buildCalendarCells(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const leadingBlanks = (firstWeekday + 6) % 7;
  return [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function PosterCell({ event, count }) {
  return (
    <>
      {/* 格子内：方形缩略（会裁切，仅占位） */}
      <span className="absolute inset-1 overflow-hidden rounded-lg shadow-sm">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-[var(--paper-deep)] p-1 text-center">
            <span className="line-clamp-3 font-display text-[10px] font-semibold leading-tight text-[var(--ink)]">{event.title}</span>
          </span>
        )}
        {count > 1 ? (
          <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-[var(--ink)]/85 font-ui text-[10px] font-semibold text-white">
            {count}
          </span>
        ) : null}
      </span>

      {/* 悬停：浮出完整不裁切的 2:3 海报 */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 z-40 w-[150%] -translate-x-1/2 -translate-y-1/2 scale-90 overflow-hidden rounded-lg opacity-0 shadow-2xl ring-1 ring-[var(--ink)]/10 transition-all duration-200 ease-out group-hover:scale-100 group-hover:opacity-100">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverUrl} alt={event.title} className="block aspect-[2/3] w-full object-cover" loading="lazy" />
        ) : (
          <span className="grid aspect-[2/3] w-full place-items-center bg-[var(--paper-deep)] p-2 text-center">
            <span className="font-display text-xs font-semibold leading-tight text-[var(--ink)]">{event.title}</span>
          </span>
        )}
      </span>
    </>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-accent">
      <span className="font-ui text-sm text-[var(--ink)]">{label}</span>
      <span className="font-display text-xl font-semibold tabular-nums text-[var(--ink)]">
        {value}
        <span className="ml-0.5 font-ui text-xs font-normal text-muted-foreground">部</span>
      </span>
    </div>
  );
}

export function MovieCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({ key: "", events: [], summary: { count: 0, movies: 0 } });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [stats, setStats] = useState({ thisYear: 0, thisMonth: 0, total: 0, movies: 0 });
  const [logToken, setLogToken] = useState(0);

  // 用 key 派生 loading（避免在 effect 里同步 setState）；reloadToken 用于增删后强制重拉。
  const key = `${year}-${month}-${reloadToken}`;
  useEffect(() => {
    let alive = true;
    loadWatchMonth(year, month)
      .then((res) => {
        if (alive) setState({ key, ...res });
      })
      .catch(() => {
        if (alive) setState({ key, events: [], summary: { count: 0, movies: 0 } });
      });
    return () => {
      alive = false;
    };
  }, [year, month, key]);

  // 年度统计：挂载 + 每次增删后重拉（不随查看的月份变）
  useEffect(() => {
    let alive = true;
    loadWatchStats()
      .then((s) => {
        if (alive) setStats(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  const loaded = state.key === key;
  const loading = !loaded;
  const data = loaded ? state : { events: [], summary: { count: 0, movies: 0 } };
  const refresh = () => setReloadToken((t) => t + 1);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of data.events) {
      const arr = map.get(ev.day) ?? [];
      arr.push(ev);
      map.set(ev.day, arr);
    }
    return map;
  }, [data.events]);

  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const todayDay = now.getDate();

  function goMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  function openLog(dateStr) {
    setModalDate(dateStr);
    setModalOpen(true);
    setLogToken((t) => t + 1);
  }

  function openDay(day) {
    openLog(`${year}-${pad(month)}-${pad(day)}`);
  }

  async function remove(id) {
    setRemoving(id);
    const res = await removeWatchEvent(id);
    setRemoving(null);
    if (!res.error) refresh();
  }

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,40rem)_18rem] lg:items-start lg:justify-center">
        {/* 左：月历 + 本月观影清单 */}
        <div className="ink-rise-stagger grid min-w-0 gap-6">
          {/* 月历卡 */}
          <section className="ink-card p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => goMonth(-1)} className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent" aria-label="上个月">
              <ChevronLeft className="size-5" />
            </button>
            <h2 className="min-w-28 text-center font-display text-xl font-semibold text-[var(--ink)]">
              {year} 年 {month} 月
            </h2>
            <button type="button" onClick={() => goMonth(1)} className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent" aria-label="下个月">
              <ChevronRight className="size-5" />
            </button>
            {!isCurrentMonth ? (
              <button
                type="button"
                onClick={() => {
                  setYear(now.getFullYear());
                  setMonth(now.getMonth() + 1);
                }}
                className="ml-1 font-ui text-sm text-primary"
              >
                回到本月
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => openLog(isCurrentMonth ? `${year}-${pad(month)}-${pad(todayDay)}` : `${year}-${pad(month)}-01`)}
            className="ink-button inline-flex h-9 items-center gap-1.5 px-4 text-sm font-medium"
          >
            <Plus className="size-4" />
            登记观影
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center font-ui text-xs text-muted-foreground">
              {w}
            </div>
          ))}
          {cells.map((day, index) => {
            if (day === null) return <div key={`b-${index}`} />;
            const dayEvents = eventsByDay.get(day) ?? [];
            const hasEvents = dayEvents.length > 0;
            const isToday = isCurrentMonth && day === todayDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => openDay(day)}
                className={cn(
                  "group relative aspect-square w-full rounded-lg transition-colors",
                  hasEvents ? "" : "bg-muted/60 hover:bg-accent",
                  isToday && "ring-2 ring-primary ring-offset-1 ring-offset-[var(--paper)]"
                )}
              >
                {hasEvents ? <PosterCell event={dayEvents[0]} count={dayEvents.length} /> : null}
                <span
                  className={cn(
                    "absolute font-ui",
                    hasEvents
                      ? "bottom-0.5 left-1 z-10 rounded bg-[var(--ink)]/70 px-1 text-[10px] font-medium text-white"
                      : "inset-0 grid place-items-center text-sm text-muted-foreground"
                  )}
                >
                  {day}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 本月观影清单（可删） */}
      {data.events.length > 0 ? (
        <section className="ink-card p-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-[var(--ink)]">本月观影</h3>
          <ul className="grid gap-3">
            {data.events.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3">
                {ev.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ev.coverUrl} alt="" className="h-12 w-8 shrink-0 rounded-sm object-cover" />
                ) : (
                  <span className="grid h-12 w-8 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground">
                    <Film className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-ui text-sm text-[var(--ink)]">{ev.title}</p>
                  <p className="font-ui text-xs text-muted-foreground">
                    {ev.watchedOn.slice(5).replace("-", " / ")}
                    {ev.note ? ` · ${ev.note}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(ev.id)}
                  disabled={removing === ev.id}
                  title="移除这条记录"
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-40"
                >
                  {removing === ev.id ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : !loading ? (
        <p className="py-8 text-center font-ui text-sm text-muted-foreground">这个月还没有观影记录。点上面「登记观影」或日历格子添加。</p>
      ) : null}
        </div>

        {/* 右：年度统计（仿阅读地图侧栏格式） */}
        <aside className="ink-card ink-rise overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3.5">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">年度统计</h2>
            <p className="font-ui text-xs text-[var(--ink-soft)]">{now.getFullYear()} 年 · 观影足迹</p>
          </div>
          <div className="grid gap-0.5 p-2">
            <StatRow label="今年看过" value={stats.thisYear} />
            <StatRow label="本月看过" value={stats.thisMonth} />
            <StatRow label="累计看过" value={stats.total} />
            <StatRow label="不同影片" value={stats.movies} />
          </div>
        </aside>
      </div>

      <LogWatchModal open={modalOpen} onOpenChange={setModalOpen} defaultDate={modalDate} onLogged={refresh} openToken={logToken} />
    </div>
  );
}
