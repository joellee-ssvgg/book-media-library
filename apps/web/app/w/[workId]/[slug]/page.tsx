import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicWork } from "@/lib/public-pages/data";
import { isUuid } from "@/lib/public-pages/slug";
import type { PublicWorkData } from "@/schemas/public-pages";

export const revalidate = 60;

type PublicWorkPageProps = {
  params: Promise<{ workId: string; slug: string }>;
};

function mediaLabel(mediaType: "book" | "movie") {
  return mediaType === "book" ? "书籍" : "电影";
}

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

function ratingLabel(ratingX10?: number) {
  return ratingX10 ? `${(ratingX10 / 10).toFixed(1)} 分` : "未公开评分";
}

function activeWork(data: PublicWorkData) {
  if (data.status !== "active") {
    notFound();
  }

  return data;
}

export async function generateMetadata({ params }: PublicWorkPageProps): Promise<Metadata> {
  const { workId, slug } = await params;

  if (!isUuid(workId)) {
    return {
      title: "作品不可用 · 书影计划",
    };
  }

  const data = await getPublicWork(workId, slug);

  if (data.status !== "active") {
    return {
      title: "作品不可用 · 书影计划",
    };
  }

  const title = `${data.work.title} · 书影计划`;

  return {
    title,
    description: data.work.description ?? `${data.work.title} 的公开作品页`,
    openGraph: {
      title,
      description: data.work.description ?? `${data.work.title} 的公开作品页`,
      images: [`/w/${data.work.work_id}/${slug}/opengraph-image`],
    },
  };
}

export default async function PublicWorkPage({ params }: PublicWorkPageProps) {
  const { workId, slug } = await params;

  if (!isUuid(workId)) {
    notFound();
  }

  const data = activeWork(await getPublicWork(workId, slug));
  const averageRating = data.stats.average_rating_x10
    ? `${(data.stats.average_rating_x10 / 10).toFixed(1)}`
    : "—";

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto grid min-h-screen w-full max-w-6xl content-start gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d2c4] pb-4">
          <div>
            <p className="text-sm text-[#6c675f]">{mediaLabel(data.work.media_type)}</p>
            <h1 className="mt-2 max-w-4xl text-3xl font-semibold leading-tight">{data.work.title}</h1>
            {data.work.original_title ? (
              <p className="mt-2 text-base text-[#5f665f]">{data.work.original_title}</p>
            ) : null}
          </div>
          <Link className="text-sm font-medium text-[#315f53]" href="/">
            书影计划
          </Link>
        </header>

        <section className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className="aspect-[2/3] border border-[#d8d2c4] bg-[#efe8d8]">
            {data.edition?.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-full w-full object-cover" src={data.edition.cover_url} />
            ) : null}
          </div>

          <div className="grid content-start gap-5">
            <div className="grid gap-3 border border-[#d8d2c4] bg-[#fffdf8] p-5 md:grid-cols-4">
              <div>
                <p className="text-sm text-[#6c675f]">公开条目</p>
                <p className="mt-2 text-2xl font-semibold">{data.stats.public_entries}</p>
              </div>
              <div>
                <p className="text-sm text-[#6c675f]">完成</p>
                <p className="mt-2 text-2xl font-semibold">{data.stats.completed}</p>
              </div>
              <div>
                <p className="text-sm text-[#6c675f]">短评</p>
                <p className="mt-2 text-2xl font-semibold">{data.stats.reviewed}</p>
              </div>
              <div>
                <p className="text-sm text-[#6c675f]">均分</p>
                <p className="mt-2 text-2xl font-semibold">{averageRating}</p>
              </div>
            </div>

            <div className="grid gap-2 text-sm leading-6 text-[#5f665f]">
              {data.work.year ? <p>年份：{data.work.year}</p> : null}
              {data.work.original_language ? <p>原始语言：{data.work.original_language}</p> : null}
              {data.edition?.page_count ? <p>页数：{data.edition.page_count}</p> : null}
              {data.edition?.runtime_minutes ? <p>片长：{data.edition.runtime_minutes} 分钟</p> : null}
            </div>

            {data.work.description ? (
              <p className="max-w-3xl text-base leading-7 text-[#3f4945]">{data.work.description}</p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">公开短评</h2>
          {data.recent_reviews.length ? (
            <div className="grid gap-3">
              {data.recent_reviews.map((review) => (
                <article className="border border-[#d8d2c4] bg-[#fffdf8] p-5" key={review.entry_id}>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#5f665f]">
                    <p>
                      {review.author_username ? (
                        <a className="font-medium text-[#315f53]" href={`/u/${review.author_username}`}>
                          {review.author_name}
                        </a>
                      ) : (
                        <span>{review.author_name}</span>
                      )}
                      <span> · {statusLabel(review.status)}</span>
                    </p>
                    <p>{ratingLabel(review.rating_x10)}</p>
                  </div>
                  {review.review ? (
                    <p className="mt-3 text-base leading-7 text-[#3f4945]">{review.review}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="border border-[#d8d2c4] bg-[#fffdf8] p-5 text-sm text-[#5f665f]">
              暂无公开短评。
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
