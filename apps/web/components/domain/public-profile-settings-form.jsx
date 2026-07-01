"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePublicProfileSettingsAction } from "@/actions/public-profile-settings";
import { OfflineSubmitButton } from "@/components/domain/offline-submit-button";
import { AvatarUploader } from "@/components/domain/avatar-uploader";
import { Top3Picker } from "@/components/domain/top3-picker";
import { initialPublicProfileSettingsActionState } from "@/schemas/public-pages";
import { Globe2, Info, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

const DISPLAY_NAME_MAX = 30;
const BIO_MAX = 200;
const USERNAME_MAX = 20;

function fieldError(errors) {
  if (!errors?.length) {
    return null;
  }
  return <p className="font-ui text-xs text-[var(--danger)]">{errors[0]}</p>;
}

export function PublicProfileSettingsForm({ initial = {}, entryOptions = [] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePublicProfileSettingsAction, initialPublicProfileSettingsActionState);
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [username, setUsername] = useState(initial.username ?? "");

  const refreshedFor = useRef(null);
  useEffect(() => {
    if (state.status === "updated" && refreshedFor.current !== state) {
      refreshedFor.current = state;
      router.refresh();
    }
  }, [state, router]);

  const topEntryIds = initial.topEntryIds ?? [];
  const [visibility, setVisibility] = useState(initial.visibility === "private" ? "private" : "public");
  const avatarInitial = (displayName || username || "阅").trim().charAt(0).toUpperCase() || "阅";
  const profileHref = username ? `/u/${username}` : "/u";

  return (
    <form action={formAction} className="mt-8 grid gap-6">
      <section className="ink-card p-5">
        <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">主页可见性</h2>
        <input type="hidden" name="publicVisibility" value={visibility} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setVisibility("public")}
            aria-pressed={visibility === "public"}
            className={cn(
              "flex min-h-16 items-center gap-4 rounded-md px-5 py-4 text-left transition-colors",
              visibility === "public" ? "ink-button" : "ink-button-outline"
            )}
          >
            <Globe2 className="size-6 shrink-0" strokeWidth={1.6} />
            <span>
              <span className="block font-display text-xl font-semibold">公开</span>
              <span className="font-ui text-sm opacity-85">任何人都可以看到你的主页</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setVisibility("private")}
            aria-pressed={visibility === "private"}
            className={cn(
              "flex min-h-16 items-center gap-4 rounded-md px-5 py-4 text-left transition-colors",
              visibility === "private" ? "ink-button" : "ink-button-outline"
            )}
          >
            <LockKeyhole className="size-6 shrink-0" strokeWidth={1.6} />
            <span>
              <span className="block font-display text-xl font-semibold">私密（仅我）</span>
              <span className="font-ui text-sm opacity-85">仅自己可见</span>
            </span>
          </button>
        </div>
        <p className="mt-3 font-ui text-sm text-muted-foreground">你仍可以正常记录，切换为公开后才展示你的精选内容。</p>
        {fieldError(state.fieldErrors?.publicVisibility)}
      </section>

      <section className="ink-card p-5">
        <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">个人名片</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-[160px_1fr]">
          <AvatarUploader initialSrc={initial.avatarUrl} initial={avatarInitial} />
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="font-ui text-sm text-muted-foreground">显示名称</span>
              <span className="grid grid-cols-[1fr_auto] items-center rounded-md border border-input bg-card px-3">
                <input
                  className="h-11 min-w-0 bg-transparent font-ui text-sm outline-none"
                  name="displayName"
                  value={displayName}
                  maxLength={DISPLAY_NAME_MAX}
                  placeholder="给自己起个展示名"
                  onChange={(event) => setDisplayName(event.target.value)}
                />
                <span className="font-ui text-xs text-muted-foreground">{displayName.length} / {DISPLAY_NAME_MAX}</span>
              </span>
              {fieldError(state.fieldErrors?.displayName)}
            </label>

            <label className="grid gap-1">
              <span className="font-ui text-sm text-muted-foreground">用户名（公开主页地址 /u/{username || "你的用户名"}）</span>
              <span className="grid grid-cols-[auto_1fr_auto] items-center rounded-md border border-input bg-card px-3">
                <span className="font-ui text-sm text-muted-foreground">@</span>
                <input
                  className="h-11 min-w-0 bg-transparent font-ui text-sm outline-none"
                  name="username"
                  value={username}
                  maxLength={USERNAME_MAX}
                  placeholder="lowercase_name"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                />
                <span className="font-ui text-xs text-muted-foreground">{username.length} / {USERNAME_MAX}</span>
              </span>
              <span className="font-ui text-xs text-muted-foreground">3–20 位小写字母、数字或下划线。修改后旧地址将失效。</span>
              {fieldError(state.fieldErrors?.username)}
            </label>

            <label className="grid gap-1">
              <span className="font-ui text-sm text-muted-foreground">一句话介绍</span>
              <span className="grid grid-cols-[1fr_auto] items-center rounded-md border border-input bg-card px-3">
                <input
                  className="h-11 min-w-0 bg-transparent font-ui text-sm outline-none"
                  name="bio"
                  value={bio}
                  maxLength={BIO_MAX}
                  placeholder="记录书与影，思考与生活。"
                  onChange={(event) => setBio(event.target.value)}
                />
                <span className="font-ui text-xs text-muted-foreground">{bio.length} / {BIO_MAX}</span>
              </span>
              {fieldError(state.fieldErrors?.bio)}
            </label>
          </div>
        </div>
      </section>

      <section className="ink-card p-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">主页精选</h2>
          <p className="font-ui text-sm text-muted-foreground">从你的库里挑 3 个最想展示的记录。</p>
        </div>
        <div className="mt-5">
          <Top3Picker options={entryOptions} initialSelectedIds={topEntryIds} />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/20 bg-accent/60 p-3 text-sm text-[var(--ink-soft)]">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>公开展示：标题、封面、评分、短评、完成时间。不会公开私密笔记、草稿和仅自己可见的内容。</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-5">
        <OfflineSubmitButton pending={pending} pendingLabel="保存中" className="ink-button h-12 px-8 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
          保存公开主页
        </OfflineSubmitButton>
        <Link href={profileHref} className="font-ui text-sm font-medium text-primary no-underline hover:underline">
          查看公开主页 ↗
        </Link>
        {state.message ? (
          <p className={`font-ui text-sm ${state.status === "updated" ? "text-primary" : "text-[var(--ink-soft)]"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}

