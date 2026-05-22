"use client";

import { useActionState } from "react";

import { addMovieEntryAction } from "@/actions/movie-add";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import {
  initialAddMovieEntryActionState,
  type MovieCandidateView,
  type ProviderSearchNotice,
} from "@/schemas/movie-add";

type MovieAddClientProps = {
  query: string;
  candidates: MovieCandidateView[];
  notices: ProviderSearchNotice[];
};

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

function CandidateForm({ candidate }: { candidate: MovieCandidateView }) {
  const [state, formAction, pending] = useActionState(
    addMovieEntryAction,
    initialAddMovieEntryActionState,
  );

  return (
    <form action={formAction} className="grid gap-4 border border-[#d8d2c4] bg-[#fffdf8] p-4">
      <input name="provider" type="hidden" value={candidate.provider} />
      <input name="externalId" type="hidden" value={candidate.externalId} />

      <div className="grid gap-3 md:grid-cols-[96px_1fr]">
        <div className="aspect-[2/3] border border-[#d8d2c4] bg-[#efe8d8]">
          {candidate.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="h-full w-full object-cover" src={candidate.coverUrl} />
          ) : null}
        </div>

        <div className="grid content-start gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#6c675f]">
              {candidate.provider}
            </p>
            <h3 className="mt-1 text-lg font-semibold">{candidate.title}</h3>
            <p className="mt-1 text-sm text-[#5f665f]">
              {candidate.releaseYear ? `${candidate.releaseYear}` : "未知年份"}
              {candidate.runtimeMinutes ? ` · ${candidate.runtimeMinutes} 分钟` : ""}
            </p>
            {candidate.description ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#5f665f]">
                {candidate.description}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-[180px_140px_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-medium">
              初始状态
              <select
                className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
                defaultValue="want_to_watch"
                name="status"
              >
                <option value="want_to_watch">想看</option>
                <option value="watching">在看</option>
                <option value="watched">看过</option>
                <option value="abandoned">弃看</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              评分
              <select
                className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
                defaultValue=""
                name="ratingX10"
              >
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

          {state.message ? <p className="text-sm text-[#3f4945]">{state.message}</p> : null}

          {state.status === "created" ? (
            <dl className="grid gap-1 font-mono text-xs text-[#3f4945]">
              <div className="grid gap-1 md:grid-cols-[90px_1fr]">
                <dt>entry_id</dt>
                <dd>{state.entryId}</dd>
              </div>
              <div className="grid gap-1 md:grid-cols-[90px_1fr]">
                <dt>work_id</dt>
                <dd>{state.workId}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export function MovieAddClient({ query, candidates, notices }: MovieAddClientProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="grid content-start gap-5 border border-[#d8d2c4] bg-[#fffdf8] p-5">
        <form className="grid gap-3" method="get">
          <label className="text-sm font-medium" htmlFor="query">
            电影搜索
          </label>
          <input
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            defaultValue={query}
            id="query"
            name="q"
            placeholder="Inception"
          />
          <button
            className="h-10 border border-[#315f53] px-4 text-sm font-medium text-[#1f3d35]"
            type="submit"
          >
            搜索
          </button>
        </form>

        {notices.length ? (
          <div className="grid gap-2 border border-[#ead6ab] bg-[#fff8e8] p-3 text-xs text-[#5f665f]">
            {notices.map((notice) => (
              <p key={`${notice.provider}:${notice.message}`}>
                {notice.provider}: {notice.message}
              </p>
            ))}
          </div>
        ) : null}
      </aside>

      <section className="grid content-start gap-4">
        {query && candidates.length === 0 ? (
          <div className="border border-[#d8d2c4] bg-[#fffdf8] p-5 text-sm text-[#5f665f]">
            没有搜索结果。
          </div>
        ) : null}

        {candidates.map((candidate) => (
          <CandidateForm
            candidate={candidate}
            key={`${candidate.provider}:${candidate.externalId}`}
          />
        ))}
      </section>
    </div>
  );
}
