import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { buttonVariants } from "@/components/ui/button";
import { BookOpen, Clapperboard, Plus, Star } from "lucide-react";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";
import { ListsClient } from "@/components/domain/lists-client";

async function loadLists() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    throw new Error(supabase.error);
  }

  const { data: lists, error } = await supabase
    .from("lists")
    .select("id, title, description, visibility_scope, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  if (!lists || lists.length === 0) {
    return [];
  }

  const { data: items } = await supabase
    .from("list_items")
    .select("list_id, position, works(editions(cover_url))")
    .in("list_id", lists.map((l) => l.id))
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const byList = new Map();
  for (const item of items ?? []) {
    const arr = byList.get(item.list_id) ?? [];
    arr.push(item);
    byList.set(item.list_id, arr);
  }

  return lists.map((list) => {
    const its = byList.get(list.id) ?? [];
    return {
      id: list.id,
      title: list.title,
      description: list.description ?? "",
      visibility: list.visibility_scope,
      count: its.length,
      covers: its.slice(0, 4).map((it) => (it.works?.editions ?? []).find((e) => e?.cover_url)?.cover_url ?? ""),
    };
  });
}

function TemplateCard({ icon: Icon, title, desc }) {
  return (
    <Link
      href={`/lists/new?title=${encodeURIComponent(title)}`}
      className="ink-button-outline grid grid-cols-[36px_1fr] items-center gap-3 p-3 no-underline"
    >
      <Icon className="size-6 text-primary" strokeWidth={1.6} />
      <span>
        <span className="block font-display text-lg font-semibold text-[var(--ink)]">{title}</span>
        <span className="font-ui text-sm text-muted-foreground">{desc}</span>
      </span>
    </Link>
  );
}

export default async function ListsPage() {
  const lists = await loadLists();

  return (
    <div className="page-frame">
      <SectionHeader
        eyebrow="LISTS"
        title="我的清单"
        action={
          <Link href="/lists/new" className={buttonVariants({ size: "lg" })}>
            <Plus className="size-4" />
            新建清单
          </Link>
        }
      />
      <p className="ink-subtitle mt-3 text-lg">创建策展集合，整理你的阅读和观影。</p>

      <section className="ink-card mt-8 p-5">
        <h2 className="mb-4 font-display text-2xl font-semibold text-[var(--ink)]">起步模板</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <TemplateCard icon={BookOpen} title="年度想读" desc="规划你的年度书单" />
          <TemplateCard icon={Clapperboard} title="推荐电影" desc="分享你喜欢的电影" />
          <TemplateCard icon={Star} title="私人收藏" desc="珍藏你最爱的作品" />
        </div>
        {lists.length === 0 ? (
          <p className="ink-subtitle mt-5 text-sm">还没有清单。选个模板，或点右上角「新建清单」从零开始，再去库里把作品加进来。</p>
        ) : null}
      </section>

      {lists.length > 0 ? <ListsClient lists={lists} /> : null}
    </div>
  );
}
