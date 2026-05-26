import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { ListPlus, Plus } from "lucide-react";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

async function loadLists() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    throw new Error(supabase.error);
  }

  const { data, error } = await supabase
    .from("lists")
    .select("id, title, description, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export default async function ListsPage() {
  const lists = await loadLists();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <SectionHeader
        eyebrow="LISTS"
        title="我的清单"
        action={
          <Link href="/lists/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4" />新建清单
          </Link>
        }
      />
      <div className="mt-8">
        {lists.length === 0 ? (
          <EmptyState
            icon={ListPlus}
            title="还没有创建清单"
            description="创建你的第一个策展集合，整理你最喜欢的书和电影。"
            action={
              <Link href="/lists/new" className={buttonVariants({ size: "sm", variant: "outline" })}>
                <Plus className="size-4" />新建清单
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {lists.map((list) => (
              <Link key={list.id} href={`/lists/${list.id}`} className="block no-underline">
                <Card className="h-full transition-colors hover:border-primary/40">
                  <h2 className="text-base font-semibold text-foreground">{list.title}</h2>
                  {list.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{list.description}</p>
                  ) : null}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
