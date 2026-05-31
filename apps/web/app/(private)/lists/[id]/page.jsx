import { notFound } from "next/navigation";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";
import { ListDetailClient } from "@/components/domain/list-detail-client";

async function loadListDetail(id) {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    throw new Error(supabase.error);
  }

  const { data: list, error } = await supabase
    .from("lists")
    .select("id, title, description, visibility_scope")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!list) {
    return null;
  }

  const { data: itemRows } = await supabase
    .from("list_items")
    .select("id, work_id, note, position, works(canonical_title, media_type, first_release_year, editions(cover_url))")
    .eq("list_id", id)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const items = (itemRows ?? []).map((row) => ({
    itemId: row.id,
    workId: row.work_id,
    title: row.works?.canonical_title ?? "未命名作品",
    mediaType: row.works?.media_type ?? "book",
    year: row.works?.first_release_year ?? null,
    coverUrl: (row.works?.editions ?? []).find((edition) => edition?.cover_url)?.cover_url ?? "",
    note: row.note ?? "",
    position: row.position,
  }));

  return {
    list: {
      id: list.id,
      title: list.title,
      description: list.description ?? "",
      visibility: list.visibility_scope,
    },
    items,
  };
}

export default async function ListDetailPage({ params }) {
  const { id } = await params;
  const data = await loadListDetail(id);
  if (!data) {
    notFound();
  }

  return (
    <div className="page-frame">
      <ListDetailClient list={data.list} items={data.items} />
    </div>
  );
}
