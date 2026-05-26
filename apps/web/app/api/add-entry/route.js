import { createCookieSupabaseClient } from "@/lib/supabase/auth";
import { canonicalizeProviderRecord } from "@/lib/providers/canonicalize";
import { createGoogleBooksProvider } from "@/lib/providers/googlebooks";
import { createOpenLibraryProvider } from "@/lib/providers/openlibrary";
import { createTmdbMovieProvider } from "@/lib/providers/tmdb";

const providers = {
  googlebooks: createGoogleBooksProvider(),
  openlibrary: createOpenLibraryProvider(),
  tmdb: createTmdbMovieProvider(),
};

export async function POST(request) {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return Response.json({ error: supabase.error }, { status: 503 });
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, externalId, type } = body;

  if (!provider || !externalId || !type) {
    return Response.json({ error: "缺少参数" }, { status: 400 });
  }

  const providerImpl = providers[provider];
  if (!providerImpl) {
    return Response.json({ error: "不支持的 provider" }, { status: 400 });
  }

  const recordResult = await providerImpl.fetch(externalId);
  if (!recordResult.ok) {
    return Response.json({ error: recordResult.error.message }, { status: 502 });
  }

  const record = recordResult.value;
  const draft = canonicalizeProviderRecord(record);
  const externalIds = draft.externalIds.map((e) => ({
    source: e.source,
    external_id: e.externalId,
    source_url: e.sourceUrl,
  }));

  let rpcName, rpcArgs;

  if (type === "movie") {
    rpcName = "task15_create_movie_entry_from_provider";
    rpcArgs = {
      input_provider: provider,
      input_external_id: externalId,
      input_title: draft.work.canonicalTitle,
      input_status: "want_to_watch",
      input_rating_x10: null,
      input_year: draft.work.firstReleaseYear ?? null,
      input_original_title: draft.work.originalTitle ?? null,
      input_language: draft.work.originalLanguage ?? null,
      input_description: draft.work.description ?? null,
      input_cover_url: draft.work.coverUrl ?? null,
      input_runtime_minutes: record.runtimeMinutes ?? null,
      input_external_ids: externalIds,
    };
  } else {
    rpcName = "task14_create_book_entry_from_provider";
    rpcArgs = {
      input_provider: provider,
      input_external_id: externalId,
      input_title: draft.work.canonicalTitle,
      input_status: "want_to_read",
      input_year: draft.work.firstReleaseYear ?? null,
      input_original_title: draft.work.originalTitle ?? null,
      input_language: draft.work.originalLanguage ?? null,
      input_description: draft.work.description ?? null,
      input_cover_url: draft.work.coverUrl ?? null,
      input_external_ids: externalIds,
    };
  }

  const { data, error } = await supabase.rpc(rpcName, rpcArgs);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, data });
}
