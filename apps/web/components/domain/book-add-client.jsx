"use client";
import { useActionState } from "react";
import { addBookEntryAction } from "@/actions/book-add";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import { initialAddBookEntryActionState, } from "@/schemas/book-add";
function CandidateForm({ candidate }) {
    const [state, formAction, pending] = useActionState(addBookEntryAction, initialAddBookEntryActionState);
    return (<form action={formAction} className="grid gap-4 border border-[#d8d2c4] bg-[#fffdf8] p-4">
      <input name="provider" type="hidden" value={candidate.provider}/>
      <input name="externalId" type="hidden" value={candidate.externalId}/>

      <div className="grid gap-3 md:grid-cols-[96px_1fr]">
        <div className="aspect-[2/3] border border-[#d8d2c4] bg-[#efe8d8]">
          {candidate.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" src={candidate.coverUrl}/>) : null}
        </div>

        <div className="grid content-start gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#6c675f]">
              {candidate.provider}
            </p>
            <h3 className="mt-1 text-lg font-semibold">{candidate.title}</h3>
            <p className="mt-1 text-sm text-[#5f665f]">
              {candidate.creators.join(" / ") || "未知作者"}
              {candidate.releaseYear ? ` · ${candidate.releaseYear}` : ""}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[180px_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-medium">
              初始状态
              <select className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]" defaultValue="want_to_read" name="status">
                <option value="want_to_read">想读</option>
                <option value="reading">在读</option>
                <option value="finished">读完</option>
                <option value="abandoned">弃读</option>
              </select>
            </label>

            <OfflineSubmitButton pending={pending} pendingLabel="添加中">
              添加到我的库
            </OfflineSubmitButton>
          </div>

          {state.message ? <p className="text-sm text-[#3f4945]">{state.message}</p> : null}

          {state.status === "created" ? (<dl className="grid gap-1 font-mono text-xs text-[#3f4945]">
              <div className="grid gap-1 md:grid-cols-[90px_1fr]">
                <dt>entry_id</dt>
                <dd>{state.entryId}</dd>
              </div>
              <div className="grid gap-1 md:grid-cols-[90px_1fr]">
                <dt>work_id</dt>
                <dd>{state.workId}</dd>
              </div>
            </dl>) : null}
        </div>
      </div>
    </form>);
}
export function BookAddClient({ query, candidates, notices }) {
    return (<div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="grid content-start gap-5 border border-[#d8d2c4] bg-[#fffdf8] p-5">
        <form className="grid gap-3" action="/add/book" method="get">
          <label className="text-sm font-medium" htmlFor="query">
            书名搜索
          </label>
          <input className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]" defaultValue={query} id="query" name="q" placeholder="The Pragmatic Programmer"/>
          <button className="h-10 border border-[#315f53] px-4 text-sm font-medium text-[#1f3d35]" type="submit">
            搜索
          </button>
        </form>

        {notices.length ? (<div className="grid gap-2 border border-[#ead6ab] bg-[#fff8e8] p-3 text-xs text-[#5f665f]">
            {notices.map((notice) => (<p key={`${notice.provider}:${notice.message}`}>
                {notice.provider}: {notice.message}
              </p>))}
          </div>) : null}
      </aside>

      <section className="grid content-start gap-4">
        {query && candidates.length === 0 ? (<div className="border border-[#d8d2c4] bg-[#fffdf8] p-5 text-sm text-[#5f665f]">
            没有搜索结果。
          </div>) : null}

        {candidates.map((candidate) => (<CandidateForm candidate={candidate} key={`${candidate.provider}:${candidate.externalId}`}/>))}
      </section>
    </div>);
}
