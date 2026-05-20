"use client";

import { useActionState } from "react";

import { createManualWorkAction } from "@/actions/manual-work";
import { initialManualWorkActionState } from "@/schemas/manual-work";

function fieldError(errors: string[] | undefined) {
  if (!errors?.length) {
    return null;
  }

  return <p className="mt-1 text-xs text-[#9a3412]">{errors[0]}</p>;
}

export function ManualWorkForm() {
  const [state, formAction, pending] = useActionState(
    createManualWorkAction,
    initialManualWorkActionState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="accessToken">
          Supabase access token
        </label>
        <textarea
          className="min-h-24 resize-y border border-[#c9c2b3] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[#315f53]"
          id="accessToken"
          name="accessToken"
          spellCheck={false}
        />
        {fieldError(state.fieldErrors?.accessToken)}
      </div>

      <div className="grid gap-4 md:grid-cols-[160px_1fr_120px]">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="mediaType">
            类型
          </label>
          <select
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            defaultValue="book"
            id="mediaType"
            name="mediaType"
          >
            <option value="book">书</option>
            <option value="movie">电影</option>
          </select>
          {fieldError(state.fieldErrors?.mediaType)}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="title">
            标准标题
          </label>
          <input
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            id="title"
            name="title"
            placeholder="沙丘"
          />
          {fieldError(state.fieldErrors?.title)}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="year">
            年份
          </label>
          <input
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            id="year"
            inputMode="numeric"
            name="year"
            placeholder="1965"
          />
          {fieldError(state.fieldErrors?.year)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="originalTitle">
            原始标题
          </label>
          <input
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            id="originalTitle"
            name="originalTitle"
            placeholder="Dune"
          />
          {fieldError(state.fieldErrors?.originalTitle)}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="originalLanguage">
            原始语言
          </label>
          <input
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            id="originalLanguage"
            name="originalLanguage"
            placeholder="en"
          />
          {fieldError(state.fieldErrors?.originalLanguage)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="externalSource">
            外部来源
          </label>
          <input
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            id="externalSource"
            name="externalSource"
            placeholder="douban"
          />
          {fieldError(state.fieldErrors?.externalSource)}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="externalId">
            外部 ID
          </label>
          <input
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            id="externalId"
            name="externalId"
            placeholder="1234567"
          />
          {fieldError(state.fieldErrors?.externalId)}
        </div>
      </div>

      <div className="grid gap-3 border-l-2 border-[#315f53] bg-[#eef4f1] px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input className="size-4 accent-[#315f53]" name="dedupOverride" type="checkbox" />
          跳过重复候选
        </label>
        <textarea
          className="min-h-20 resize-y border border-[#c9c2b3] bg-white px-3 py-2 text-sm outline-none focus:border-[#315f53]"
          name="dedupSkippedReason"
          placeholder="确认是另一个条目"
        />
        {fieldError(state.fieldErrors?.dedupSkippedReason)}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="h-10 bg-[#1f3d35] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "提交中" : "创建作品"}
        </button>

        {state.message ? (
          <p className="text-sm text-[#3f4945]">{state.message}</p>
        ) : null}
      </div>

      {state.status === "created" ? (
        <div className="border border-[#b9d2c9] bg-[#f3faf7] p-4 text-sm">
          <p className="font-medium">已创建</p>
          <dl className="mt-3 grid gap-2 font-mono text-xs text-[#3f4945]">
            <div className="grid gap-1 md:grid-cols-[140px_1fr]">
              <dt>work_id</dt>
              <dd>{state.workId}</dd>
            </div>
            <div className="grid gap-1 md:grid-cols-[140px_1fr]">
              <dt>default_edition_id</dt>
              <dd>{state.defaultEditionId}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {state.status === "duplicate_found" && state.candidates?.length ? (
        <div className="border border-[#e0b56f] bg-[#fff8e8] p-4">
          <p className="text-sm font-medium">可能重复</p>
          <ul className="mt-3 grid gap-2 text-sm">
            {state.candidates.map((candidate) => (
              <li
                className="grid gap-1 border border-[#ead6ab] bg-white px-3 py-2 md:grid-cols-[1fr_80px_80px]"
                key={candidate.work_id}
              >
                <span>{candidate.canonical_title}</span>
                <span>{candidate.first_release_year ?? "未知"}</span>
                <span>{candidate.similarity_score}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
