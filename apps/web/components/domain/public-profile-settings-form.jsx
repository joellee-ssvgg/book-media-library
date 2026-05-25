"use client";
import { useActionState } from "react";
import { updatePublicProfileSettingsAction } from "@/actions/public-profile-settings";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import { initialPublicProfileSettingsActionState } from "@/schemas/public-pages";
const topEntryFields = ["topEntryId1", "topEntryId2", "topEntryId3"];
function fieldError(errors) {
    if (!errors?.length) {
        return null;
    }
    return <p className="text-xs text-[#9a3412]">{errors[0]}</p>;
}
export function PublicProfileSettingsForm() {
    const [state, formAction, pending] = useActionState(updatePublicProfileSettingsAction, initialPublicProfileSettingsActionState);
    return (<form action={formAction} className="grid gap-5 border border-[#d8d2c4] bg-[#fffdf8] p-5">
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="publicVisibility">
          主页可见性
        </label>
        <select className="h-10 border border-[#c9c2b3] bg-white px-3 text-sm outline-none focus:border-[#315f53]" defaultValue="public" id="publicVisibility" name="publicVisibility">
          <option value="public">public</option>
          <option value="unlisted">unlisted</option>
          <option value="private">private</option>
          <option value="followers">followers</option>
        </select>
        {fieldError(state.fieldErrors?.publicVisibility)}
      </div>

      <div className="grid gap-3 border-l-2 border-[#315f53] bg-[#eef4f1] px-4 py-3">
        <p className="text-sm font-medium">Top-3 entry_id</p>
        {topEntryFields.map((fieldName, index) => (<div className="grid gap-2" key={fieldName}>
            <label className="sr-only" htmlFor={fieldName}>
              Top entry {index + 1}
            </label>
            <input className="h-10 border border-[#c9c2b3] bg-white px-3 font-mono text-xs outline-none focus:border-[#315f53]" id={fieldName} name={fieldName} placeholder="00000000-0000-0000-0000-000000000000"/>
            {fieldError(state.fieldErrors?.[fieldName])}
          </div>))}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <OfflineSubmitButton pending={pending} pendingLabel="保存中">
          保存公开主页
        </OfflineSubmitButton>
        {state.message ? <p className="pt-2 text-sm text-[#3f4945]">{state.message}</p> : null}
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-[#315f53]">
        <a href="/library">查看我的库</a>
        <a href="/dashboard">Dashboard</a>
      </div>
    </form>);
}
