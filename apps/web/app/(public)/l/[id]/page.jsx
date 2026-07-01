import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverImage } from "@/components/domain/cover-image";
import { getPublicList } from "@/lib/public-pages/data";
import { slugifyTitle } from "@/lib/public-pages/slug";

export const revalidate = 60;

function mediaLabel(mediaType) {
  return mediaType === "book" ? "书" : "电影";
}

function ownerName(list) {
  return list.owner_display_name ?? list.owner_username ?? "阅迹用户";
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await getPublicList(id);
  if (data.status !== "ok") {
    return { title: "清单不可用 · 阅迹" };
  }
  return {
    title: `${data.list.title} · 阅迹`,
    description: data.list.description ?? `${ownerName(data.list)} 的公开清单`,
  };
}

function ItemCard({ item }) {
  return (
    <a
      className="grid gap-3 border border-[var(--line)] bg-[hsl(var(--card))] p-3 text-[var(--ink)] no-underline"
      href={`/w/${item.work_id}/${slugifyTitle(item.title)}`}
    >
      <div className="aspect-[2/3] overflow-hidden border border-[var(--line)] bg-[var(--paper-deep)]">
        {item.cover_url ? (
          <CoverImage src={item.cover_url} sizes="(max-width: 768px) 45vw, 240px" className="h-full w-full" />
        ) : null}
      </div>
      <div className="grid content-start gap-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</h3>
        <p className="text-xs text-[var(--ink-faint)]">
          {mediaLabel(item.media_type)}
          {item.year ? ` · ${item.year}` : ""}
        </p>
        {item.note ? <p className="text-xs leading-5 text-[var(--ink-soft)]">{item.note}</p> : null}
      </div>
    </a>
  );
}

export default async function PublicListPage({ params }) {
  const { id } = await params;
  const data = await getPublicList(id);

  if (data.status === "private") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--paper)] px-6 text-[var(--ink)]">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-faint)]">LIST</p>
          <h1 className="mt-2 text-2xl font-semibold">这个清单是私密的</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">清单作者还没有公开它。</p>
        </div>
      </div>
    );
  }
  if (data.status !== "ok") {
    notFound();
  }

  const { list, items } = data;

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <main className="mx-auto grid min-h-screen w-full max-w-6xl content-start gap-8 px-6 py-10">
        <header className="border-b border-[var(--line)] pb-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-faint)]">阅迹清单</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{list.title}</h1>
          {list.description ? <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">{list.description}</p> : null}
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            by{" "}
            {list.owner_username ? (
              <a className="font-medium text-[var(--blue)]" href={`/u/${list.owner_username}`}>
                {ownerName(list)}
              </a>
            ) : (
              ownerName(list)
            )}{" "}
            · {items.length} 个条目
          </p>
        </header>

        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--ink-soft)]">这个清单还没有条目。</p>
        ) : (
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => (
              <ItemCard key={item.work_id} item={item} />
            ))}
          </section>
        )}

        <footer className="border-t border-[var(--line)] pt-5 text-sm text-[var(--ink-faint)]">
          由 <Link className="font-medium text-[var(--blue)]" href="/">阅迹</Link> 整理
        </footer>
      </main>
    </div>
  );
}
