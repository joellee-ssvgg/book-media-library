import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListPlus } from "lucide-react";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

async function loadList(id) {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    throw new Error(supabase.error);
  }

  const { data, error } = await supabase
    .from("lists")
    .select("id, title, description")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export default async function ListDetailPage({ params }) {
  const { id } = await params;
  const list = await loadList(id);

  if (!list) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <SectionHeader eyebrow="LIST" title={list.title} />
      <div className="mt-8">
        <EmptyState
          icon={ListPlus}
          title="清单暂无条目"
          description={list.description ?? "返回库中将作品加入这个清单。"}
        />
      </div>
    </div>
  );
}
