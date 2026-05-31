import Link from "next/link";
import { BookCover, ProfileAvatar, StatLine } from "@/components/domain/visual-system";
import { PublicProfileSettingsForm } from "@/components/domain/public-profile-settings-form";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

const COVER_VARIANTS = ["navy", "blue", "cream"];

function avatarInitial(displayLabel) {
  const first = displayLabel.trim().charAt(0).toUpperCase();
  return first || "阅";
}

async function loadPublicProfileSettings() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, bio, avatar_url, public_visibility, public_top3")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const baseCount = () =>
    supabase.from("user_entries").select("id", { count: "exact", head: true }).is("deleted_at", null);
  const [readResult, watchedResult, reviewResult] = await Promise.all([
    baseCount().eq("status", "finished"),
    baseCount().eq("status", "watched"),
    baseCount().not("review", "is", null),
  ]);

  const top3List = Array.isArray(profile.public_top3) ? profile.public_top3 : [];
  const top3Ids = top3List
    .slice()
    .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((item) => item?.entry_id)
    .filter(Boolean);

  const { data: entryRows } = await supabase
    .from("user_entries")
    .select("id, status, works(canonical_title, media_type)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  const entryOptions = (entryRows ?? []).map((row) => ({
    entryId: row.id,
    title: row.works?.canonical_title ?? "未命名作品",
    mediaType: row.works?.media_type ?? "book",
    status: row.status,
  }));
  const titleById = new Map(entryOptions.map((option) => [option.entryId, option.title]));
  const top3Works = top3Ids.map((entryId) => ({ entryId, title: titleById.get(entryId) ?? "未命名作品" }));

  return {
    displayName: profile.display_name ?? "",
    username: profile.username,
    bio: profile.bio ?? "",
    avatarUrl: profile.avatar_url ?? "",
    visibility: profile.public_visibility ?? "public",
    top3Ids,
    top3Works,
    entryOptions,
    stats: {
      read: readResult.count ?? 0,
      watched: watchedResult.count ?? 0,
      reviews: reviewResult.count ?? 0,
    },
  };
}

export default async function PublicSettingsPage() {
  const data = await loadPublicProfileSettings();

  const displayLabel = (data?.displayName || data?.username || "阅迹用户").trim();
  const username = data?.username ?? "";
  const bio = data?.bio?.trim() || "还没有写下一句话介绍。";
  const avatarUrl = data?.avatarUrl || "";
  const profileHref = username ? `/u/${username}` : "/u";
  const stats = data?.stats ?? { read: 0, watched: 0, reviews: 0 };
  const top3Works = data?.top3Works ?? [];

  return (
    <div className="page-frame">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_520px]">
        <main className="min-w-0">
          <p className="ink-eyebrow">PUBLIC PROFILE</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">编辑我的主页</h1>
          <p className="ink-subtitle mt-3 text-lg">布置你的阅迹门面。公开展示你的精选记录、评分和短评。</p>

          <nav className="media-tabs mt-8" aria-label="公开主页设置分区">
            <span className="media-tab media-tab-active">公开主页</span>
            <span className="media-tab">个人资料</span>
            <span className="media-tab">隐私</span>
            <span className="media-tab">数据导出</span>
          </nav>

          <PublicProfileSettingsForm
            initial={{
              displayName: data?.displayName ?? "",
              username,
              bio: data?.bio ?? "",
              avatarUrl: data?.avatarUrl ?? "",
              visibility: data?.visibility ?? "public",
              topEntryIds: data?.top3Ids ?? [],
            }}
            entryOptions={data?.entryOptions ?? []}
          />
        </main>

        <aside className="ink-card p-6">
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">公开主页预览</h2>
          <p className="ink-subtitle mt-1 text-sm">你看到的，将是他人看到的。</p>

          <div className="mt-6 overflow-hidden rounded-md border border-border bg-card">
            <div className="relative h-28 overflow-hidden bg-accent">
              <div className="ink-wash absolute inset-0" aria-hidden="true" />
            </div>
            <div className="relative z-10 px-7 pb-7">
              <div className="-mt-12 flex items-end gap-5">
                <ProfileAvatar src={avatarUrl || undefined} initial={avatarInitial(displayLabel)} alt="头像" className="size-24 border-4 border-card text-5xl" />
                <div className="min-w-0 pb-2">
                  <h3 className="truncate font-display text-3xl font-semibold text-[var(--ink)]">{displayLabel}</h3>
                  <p className="font-ui text-muted-foreground">@{username}</p>
                </div>
              </div>
              <p className="mt-6 text-[var(--ink-soft)]">{bio}</p>
              <div className="mt-6">
                <StatLine
                  items={[
                    { label: "读过", value: String(stats.read), unit: "本" },
                    { label: "看过", value: String(stats.watched), unit: "部" },
                    { label: "写过", value: String(stats.reviews), unit: "条" },
                  ]}
                />
              </div>
              <div className="mt-7 border-t border-border pt-6">
                <h4 className="font-display text-xl font-semibold text-[var(--ink)]">主页精选</h4>
                {top3Works.length > 0 ? (
                  <div className="mt-4 grid grid-cols-3 gap-5">
                    {top3Works.map((work, index) => (
                      <article key={work.entryId}>
                        <BookCover
                          title={work.title}
                          variant={COVER_VARIANTS[index % COVER_VARIANTS.length]}
                          className="aspect-[2/3] w-full"
                        />
                        <p className="mt-3 truncate font-ui text-sm text-[var(--ink)]">{work.title}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-md border border-dashed border-border bg-[var(--paper-deep)] p-4 font-ui text-sm text-muted-foreground">
                    还没有设置主页精选。在左侧「主页精选」填入想展示的记录。
                  </p>
                )}
                <Link href={profileHref} className="mt-7 inline-flex font-ui text-sm font-medium text-primary no-underline">
                  查看完整主页 ↗
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
