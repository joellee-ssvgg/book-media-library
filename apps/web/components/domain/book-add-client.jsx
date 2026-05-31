"use client";
import { useActionState } from "react";
import { addBookEntryAction } from "@/actions/book-add";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import { initialAddBookEntryActionState } from "@/schemas/book-add";
import { Input } from "@/components/ui/input";
import { BookCover } from "@/components/domain/visual-system";
import { Search, Check } from "lucide-react";

const SELECT_CLASS =
  "font-ui h-11 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function CandidateForm({ candidate }) {
    const [state, formAction, pending] = useActionState(addBookEntryAction, initialAddBookEntryActionState);
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
              <BookCover title={candidate.title} variant="cream" className="h-full w-full" />
            )}
          </div>
          <div className="grid min-w-0 flex-1 content-start gap-3">
            <div>
              <p className="font-ui text-xs uppercase tracking-[0.16em] text-[var(--ink-faint)]">{candidate.provider}</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-[var(--ink)]">{candidate.title}</h3>
              <p className="mt-1 font-ui text-sm text-[var(--ink-soft)]">
                {candidate.creators.join(" / ") || "未知作者"}
                {candidate.releaseYear ? ` · ${candidate.releaseYear}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 font-ui text-sm font-medium text-[var(--ink)]">
                初始状态
                <select className={`${SELECT_CLASS} w-36`} defaultValue="want_to_read" name="status">
                  <option value="want_to_read">想读</option>
                  <option value="reading">在读</option>
                  <option value="finished">读过</option>
                  <option value="abandoned">放弃</option>
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

export function BookAddClient({ query, candidates, notices }) {
    return (
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="grid content-start gap-4">
          <form className="ink-card grid gap-3 p-5" action="/add/book" method="get">
            <label className="font-ui text-sm font-medium text-[var(--ink)]" htmlFor="query">
              书名搜索
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input id="query" name="q" defaultValue={query} placeholder="The Pragmatic Programmer" className="pl-9" />
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
              输入书名开始搜索。
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
