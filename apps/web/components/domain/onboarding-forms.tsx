"use client";

import { useActionState } from "react";

import {
  completeOnboardingAction,
  enqueueOnboardingImportAction,
} from "@/actions/onboarding";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import {
  initialImportActionState,
  initialOnboardingActionState,
} from "@/schemas/onboarding";

function fieldError(errors: string[] | undefined) {
  if (!errors?.length) {
    return null;
  }

  return <p className="mt-1 text-xs text-[#9a3412]">{errors[0]}</p>;
}

export function OnboardingForms() {
  const [profileState, profileAction, profilePending] = useActionState(
    completeOnboardingAction,
    initialOnboardingActionState,
  );
  const [importState, importAction, importPending] = useActionState(
    enqueueOnboardingImportAction,
    initialImportActionState,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <form action={profileAction} className="grid gap-5 border border-[#d8d2c4] bg-[#fffdf8] p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">Step 1</p>
          <h2 className="mt-1 text-xl font-semibold">注册资料与 60 秒首次成功</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="username">
              username
            </label>
            <input
              className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
              id="username"
              name="username"
              placeholder="demo01"
            />
            {fieldError(profileState.fieldErrors?.username)}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="displayName">
              显示名
            </label>
            <input
              className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
              id="displayName"
              name="displayName"
              placeholder="Demo"
            />
            {fieldError(profileState.fieldErrors?.displayName)}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="avatarUrl">
              头像 URL
            </label>
            <input
              className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
              id="avatarUrl"
              name="avatarUrl"
              placeholder="https://..."
            />
            {fieldError(profileState.fieldErrors?.avatarUrl)}
          </div>
        </div>

        <div className="grid gap-3 border-l-2 border-[#315f53] bg-[#eef4f1] px-4 py-3">
          <p className="text-sm font-medium">选 3 项起步，可留空直接跳过</p>
          {[1, 2, 3].map((index) => (
            <div className="grid gap-3 md:grid-cols-[120px_1fr_150px]" key={index}>
              <select
                className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
                defaultValue="book"
                name={`favoriteMediaType${index}`}
              >
                <option value="book">书</option>
                <option value="movie">电影</option>
              </select>
              <input
                className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
                name={`favoriteTitle${index}`}
                placeholder={index === 1 ? "The Pragmatic Programmer" : "标题"}
              />
              <input
                className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
                name={`favoriteStatus${index}`}
                placeholder="finished / watched"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <OfflineSubmitButton pending={profilePending} pendingLabel="保存中">
            完成 onboarding
          </OfflineSubmitButton>
          {profileState.message ? (
            <p className="pt-2 text-sm text-[#3f4945]">{profileState.message}</p>
          ) : null}
        </div>

        {profileState.status === "completed" ? (
          <dl className="grid gap-2 border border-[#b9d2c9] bg-[#f3faf7] p-4 font-mono text-xs">
            <div className="grid gap-1 md:grid-cols-[140px_1fr]">
              <dt>profile_id</dt>
              <dd>{profileState.profileId}</dd>
            </div>
            <div className="grid gap-1 md:grid-cols-[140px_1fr]">
              <dt>username</dt>
              <dd>{profileState.username}</dd>
            </div>
            <div className="grid gap-1 md:grid-cols-[140px_1fr]">
              <dt>created_count</dt>
              <dd>{profileState.createdCount}</dd>
            </div>
          </dl>
        ) : null}
      </form>

      <form action={importAction} className="grid content-start gap-5 border border-[#d8d2c4] bg-[#fffdf8] p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">Step 2</p>
          <h2 className="mt-1 text-xl font-semibold">上传 CSV / MSPF 异步导入</h2>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="importSource">
            文件格式
          </label>
          <select
            className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]"
            defaultValue="mspf"
            id="importSource"
            name="importSource"
          >
            <option value="mspf">MSPF v1.0.0 JSON</option>
            <option value="csv">通用 CSV</option>
          </select>
          {fieldError(importState.fieldErrors?.importSource)}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="historyFile">
            历史数据文件
          </label>
          <input
            className="border border-[#c9c2b3] bg-white px-3 py-2 text-sm outline-none file:mr-3 file:border-0 file:bg-[#e5efe9] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#1f3d35] focus:border-[#315f53]"
            id="historyFile"
            name="historyFile"
            type="file"
          />
        </div>

        <div className="border border-[#ead6ab] bg-[#fff8e8] p-3 text-xs leading-6 text-[#5f665f]">
          CSV 需要列：canonical_title 或 title；可选 media_type、status、year、external_source、external_id、rating_x10、favorite。
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <OfflineSubmitButton pending={importPending} pendingLabel="入队中">
            创建导入 job
          </OfflineSubmitButton>
          {importState.message ? (
            <p className="pt-2 text-sm text-[#3f4945]">{importState.message}</p>
          ) : null}
        </div>

        {importState.status === "queued" ? (
          <dl className="grid gap-2 border border-[#b9d2c9] bg-[#f3faf7] p-4 font-mono text-xs">
            <div className="grid gap-1 md:grid-cols-[110px_1fr]">
              <dt>job_id</dt>
              <dd>{importState.jobId}</dd>
            </div>
            <div className="grid gap-1 md:grid-cols-[110px_1fr]">
              <dt>source</dt>
              <dd>{importState.source}</dd>
            </div>
          </dl>
        ) : null}
      </form>
    </div>
  );
}
