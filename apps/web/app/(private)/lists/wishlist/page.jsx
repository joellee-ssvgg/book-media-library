import { SectionHeader } from "@/components/ui/section-header";
import { WishlistClient } from "./wishlist-client";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

const WANT_STATUSES = ["want_to_read", "want_to_watch"];

function mapRow(row) {
  const meta = row.works?.metadata_json ?? {};
  return {
    entryId: row.id,
    workId: row.works?.id ?? null,
    status: row.status,
    title: row.works?.canonical_title ?? "未命名作品",
    mediaType: row.works?.media_type ?? "book",
    year: row.works?.first_release_year ?? null,
    coverUrl: row.editions?.cover_url ?? "",
    genres: Array.isArray(meta.genres) ? meta.genres : [],
    subjects: Array.isArray(meta.subjects) ? meta.subjects : [],
  };
}

// 一次拉全部条目：想读想看用于骰子；全部（去重 workId）作为「更像这本」的语料库。
async function loadWishlistData() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { items: [], corpus: [] };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { items: [], corpus: [] };
  }

  const { data } = await supabase
    .from("user_entries")
    .select("id, status, works(id, canonical_title, media_type, first_release_year, metadata_json), editions(cover_url)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []).map(mapRow).filter((r) => r.workId);
  const items = rows.filter((r) => WANT_STATUSES.includes(r.status));

  const seen = new Set();
  const corpus = [];
  for (const r of rows) {
    if (seen.has(r.workId)) continue;
    seen.add(r.workId);
    corpus.push(r);
  }

  return { items, corpus };
}

export default async function WishlistPage() {
  const { items, corpus } = await loadWishlistData();

  return (
    <div className="page-frame">
      <SectionHeader eyebrow="LISTS" title="想读想看" />
      <p className="ink-subtitle mt-2 mb-6 text-sm">
        把想读的书和想看的影视放在一起。不知道下一个看什么时，让骰子替你决定。
      </p>
      <WishlistClient items={items} corpus={corpus} />
    </div>
  );
}
