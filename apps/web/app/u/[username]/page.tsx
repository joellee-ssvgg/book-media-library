import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicProfile } from "@/lib/public-pages/data";
import { slugifyTitle } from "@/lib/public-pages/slug";
import type { PublicEntryCard, PublicProfileData } from "@/schemas/public-pages";

export const revalidate = 60;

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    want_to_read: "想读",
    reading: "在读",
    finished: "读完",
    abandoned: "放弃",
    want_to_watch: "想看",
    watching: "在看",
    watched: "看完",
  };

  return labels[status] ?? status;
}

function mediaLabel(mediaType: "book" | "movie") {
  return mediaType === "book" ? "书" : "电影";
}

function ratingLabel(ratingX10?: number) {
  return ratingX10 ? `${(ratingX10 / 10).toFixed(1)} 分` : "未公开评分";
}

function displayName(data: Extract<PublicProfileData, { status: "active" }>) {
  return data.profile.display_name ?? data.profile.username;
}

function workHref(entry: PublicEntryCard) {
  return `/w/${entry.work_id}/${slugifyTitle(entry.title)}`;
}

function EntryCard({ entry, featured = false }: { entry: PublicEntryCard; featured?: boolean }) {
  return (
    <a
      className={`grid gap-3 border border-[#d8d2c4] bg-[#fffdf8] p-4 text-[#1f2423] ${featured ? "md:grid-cols-[92px_1fr]" : ""}`}
      href={workHref(entry)}
    >
      {featured ? (
        <div className="aspect-[2/3] border border-[#d8d2c4] bg-[#efe8d8]">
          {entry.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="h-full w-full object-cover" src={entry.cover_url} />
          ) : null}
        </div>
      ) : null}
      <div className="grid content-start gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[#6c675f]">
          {mediaLabel(entry.media_type)} · {statusLabel(entry.status)}
        </p>
        <h3 className="text-lg font-semibold">{entry.title}</h3>
        <p className="text-sm text-[#5f665f]">
          {entry.year ?? "未知年份"} · {ratingLabel(entry.rating_x10)}
        </p>
        {entry.review ? <p className="text-sm leading-6 text-[#3f4945]">{entry.review}</p> : null}
      </div>
    </a>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#d8d2c4] bg-[#fffdf8] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[#6c675f]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const data = await getPublicProfile(username);

  if (data.status !== "active") {
    return {
      title: "公开主页不可用 · 书影计划",
    };
  }

  const name = displayName(data);

  return {
    title: `${name} · 书影计划`,
    description: data.profile.bio ?? `${name} 的公开书影主页`,
    openGraph: {
      title: `${name} · 书影计划`,
      description: data.profile.bio ?? `${name} 的公开书影主页`,
      images: [`/u/${data.profile.username}/opengraph-image`],
    },
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const data = await getPublicProfile(username);

  if (data.status !== "active") {
    notFound();
  }

  const name = displayName(data);
  const averageRating = data.stats.average_rating_x10
    ? `${(data.stats.average_rating_x10 / 10).toFixed(1)}`
    : "—";

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d2c4] pb-4">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center overflow-hidden rounded-full border border-[#d8d2c4] bg-[#e9e2d4] text-xl font-semibold text-[#315f53]">
              {data.profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-full w-full object-cover" src={data.profile.avatar_url} />
              ) : (
                name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">
                @{data.profile.username}
              </p>
              <h1 className="mt-1 text-3xl font-semibold">{name}</h1>
            </div>
          </div>
          <Link className="text-sm font-medium text-[#315f53]" href="/">
            书影计划
          </Link>
        </header>

        {data.profile.bio ? (
          <p className="max-w-3xl text-lg leading-8 text-[#3f4945]">{data.profile.bio}</p>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4">
          <StatBlock label="公开条目" value={data.stats.public_entries} />
          <StatBlock label="完成" value={data.stats.completed} />
          <StatBlock label="短评" value={data.stats.reviewed} />
          <StatBlock label="均分" value={averageRating} />
        </section>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">精选 Top-3</h2>
            <p className="text-sm text-[#5f665f]">
              {data.stats.books} 本书 · {data.stats.movies} 部电影
            </p>
          </div>
          {data.top3.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {data.top3.map((entry) => (
                <EntryCard entry={entry} featured key={entry.entry_id} />
              ))}
            </div>
          ) : (
            <p className="border border-[#d8d2c4] bg-[#fffdf8] p-5 text-sm text-[#5f665f]">
              暂无公开精选。
            </p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <section className="grid content-start gap-4">
            <h2 className="text-xl font-semibold">最近完成</h2>
            <div className="grid gap-3">
              {data.recent_finished.length ? (
                data.recent_finished.map((entry) => (
                  <EntryCard entry={entry} key={entry.entry_id} />
                ))
              ) : (
                <p className="border border-[#d8d2c4] bg-[#fffdf8] p-5 text-sm text-[#5f665f]">
                  暂无公开完成记录。
                </p>
              )}
            </div>
          </section>

          <section className="grid content-start gap-4">
            <h2 className="text-xl font-semibold">公开短评</h2>
            <div className="grid gap-3">
              {data.public_reviews.length ? (
                data.public_reviews.map((entry) => (
                  <EntryCard entry={entry} key={entry.entry_id} />
                ))
              ) : (
                <p className="border border-[#d8d2c4] bg-[#fffdf8] p-5 text-sm text-[#5f665f]">
                  暂无公开短评。
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
