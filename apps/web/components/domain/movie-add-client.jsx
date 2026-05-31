"use client";
import { useActionState } from "react";
import { addMovieEntryAction } from "@/actions/movie-add";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import { initialAddMovieEntryActionState } from "@/schemas/movie-add";
import { Input } from "@/components/ui/input";
import { BookCover } from "@/components/domain/visual-system";
import { Search, Check } from "lucide-react";

const SELECT_CLASS =
  "font-ui h-11 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const ratingOptions = [
    { value: "", label: "不评分" },
    { value: "50", label: "5.0" },
    { value: "45", label: "4.5" },
    { value: "40", label: "4.0" },
    { value: "35", label: "3.5" },
    { value: "30", label: "3.0" },
    { value: "25", label: "2.5" },
    { value: "20", label: "2.0" },
    { value: "15", label: "1.5" },
    { value: "10", label: "1.0" },
    { value: "5", label: "0.5" },
];

function CandidateForm({ candidate }) {
    const [state, formAction, pending] = useActionState(addMovieEntryAction, initialAddMovieEntryActionState);
    const added = state.status === "created";
    return (
      <form action={formAction} className="ink-card p-4">
        <input name="provider" type="hidden" value={candidate.provider} />
        <input name="externalId" type="hidden" value={candidate.externalId} />
        <div className="flex gap-4">
          <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-sm border border-border bg-muted shadow-sm">
            {candidate.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-full w-full object-cover" src={candidate.coverUrl} />
            ) : (
              <BookCover title={candidate.title} variant="blue" className="h-full w-full" />
            )}
          </div>
          <div className="grid min-w-0 flex-1 content-start gap-3">
            <div>
              <p className="font-ui text-xs uppercase tracking-[0.16em] text-[var(--ink-faint)]">{candidate.provider}</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-[var(--ink)]">{candidate.title}</h3>
              <p className="mt-1 font-ui text-sm text-[var(--ink-soft)]">
                {candidate.releaseYear ? `${candidate.releaseYear}` : "未知年份"}
                {candidate.runtimeMinutes ? ` · ${candidate.runtimeMinutes} 分钟` : ""}
              </p>
              {candidate.description ? (
                <p className="mt-2 line-clamp-3 font-ui text-sm leading-6 text-[var(--ink-soft)]">
                  {candidate.description}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 font-ui text-sm font-medium text-[var(--ink)]">
                初始状态
                <select className={`${SELECT_CLASS} w-36`} defaultValue="want_to_watch" name="status">
                  <option value="want_to_watch">想看</option>
                  <option value="watching">在看</option>
                  <option value="watched">看过</option>
                  <option value="abandoned">放弃</option>
                </select>
              </label>
              <label className="grid gap-1 font-ui text-sm font-medium text-[var(--ink)]">
                评分
                <select className={`${SELECT_CLASS} w-28`} defaultValue="" name="ratingX10">
                  {ratingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <OfflineSubmitButton pending={pending} pendingLabel="添加中">
                添加到我的库
              </OfflineSubmitButton>
            </div>
            {added ? (
              <p className="inline-flex items-center gap-1.5 font-ui text-sm font-medium text-primary">
                <Check className="size-4" strokeWidth={2} />已添加到你的库
              </p>
            ) : state.message ? (
              <p className="font-ui text-sm text-[var(--ink-soft)]">{state.message}</p>
            ) : null}
          </div>
        </div>
      </form>
    );
}

export function MovieAddClient({ query, candidates, notices }) {
    return (
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="grid content-start gap-4">
          <form className="ink-card grid gap-3 p-5" action="/add/movie" method="get">
            <label className="font-ui text-sm font-medium text-[var(--ink)]" htmlFor="query">
              电影搜索
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input id="query" name="q" defaultValue={query} placeholder="Inception" className="pl-9" />
            </div>
            <button type="submit" className="ink-button h-10 px-4 text-sm font-medium">
              搜索
            </button>
          </form>
          {notices.length ? (
            <div className="ink-card grid gap-2 p-4 font-ui text-xs text-[var(--ink-soft)]">
              {notices.map((notice) => (
                <p key={`${notice.provider}:${notice.message}`}>
                  {notice.provider}: {notice.message}
                </p>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="grid content-start gap-4">
          {!query ? (
            <div className="ink-card p-8 text-center font-ui text-sm text-[var(--ink-soft)]">
              输入电影名开始搜索。
            </div>
          ) : candidates.length === 0 ? (
            <div className="ink-card p-8 text-center font-ui text-sm text-[var(--ink-soft)]">
              没有搜索结果。
            </div>
          ) : (
            candidates.map((candidate) => (
              <CandidateForm candidate={candidate} key={`${candidate.provider}:${candidate.externalId}`} />
            ))
          )}
        </section>
      </div>
    );
}
