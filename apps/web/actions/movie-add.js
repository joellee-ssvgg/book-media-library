"use server";
import { canonicalizeProviderRecord } from "@/lib/providers/canonicalize";
import { createTmdbMovieProvider } from "@/lib/providers/tmdb";
import { createActionSupabase } from "@/lib/supabase/server";
import { addMovieEntryFormSchema, } from "@/schemas/movie-add";
const movieProvider = createTmdbMovieProvider();
function toFieldErrors(result) {
    return result.success ? undefined : result.error.flatten().fieldErrors;
}
export async function addMovieEntryAction(_previousState, formData) {
    const parsed = addMovieEntryFormSchema.safeParse({
        accessToken: formData.get("accessToken"),
        provider: formData.get("provider"),
        externalId: formData.get("externalId"),
        status: formData.get("status"),
        ratingX10: formData.get("ratingX10"),
    });
    if (!parsed.success) {
        return {
            status: "validation_error",
            message: "电影添加表单未通过校验。",
            fieldErrors: toFieldErrors(parsed),
        };
    }
    const recordResult = await movieProvider.fetch(parsed.data.externalId);
    if (!recordResult.ok) {
        return {
            status: "provider_error",
            message: recordResult.error.message,
        };
    }
    const record = recordResult.value;
    const draft = canonicalizeProviderRecord(record);
    const supabase = await createActionSupabase(parsed.data.accessToken);
    if ("error" in supabase) {
        return {
            status: "config_error",
            message: supabase.error,
        };
    }
    const { data, error } = await supabase.client.rpc("task15_create_movie_entry_from_provider", {
        input_provider: "tmdb",
        input_external_id: parsed.data.externalId,
        input_title: draft.work.canonicalTitle,
        input_status: parsed.data.status,
        input_rating_x10: parsed.data.ratingX10 ? Number(parsed.data.ratingX10) : null,
        input_year: draft.work.firstReleaseYear ?? null,
        input_original_title: draft.work.originalTitle ?? null,
        input_language: draft.work.originalLanguage ?? null,
        input_description: draft.work.description ?? null,
        input_cover_url: draft.work.coverUrl ?? null,
        input_runtime_minutes: record.runtimeMinutes ?? null,
        input_external_ids: draft.externalIds.map((externalId) => ({
            source: externalId.source,
            external_id: externalId.externalId,
            source_url: externalId.sourceUrl,
        })),
    });
    if (error) {
        return {
            status: "db_error",
            message: error.message,
        };
    }
    if (!data) {
        return {
            status: "db_error",
            message: "task15_create_movie_entry_from_provider 没有返回结果。",
        };
    }
    if (data.work_id && ((draft.subjects?.length ?? 0) > 0 || (draft.genres?.length ?? 0) > 0)) {
        await supabase.client.rpc("task32_enrich_work_metadata", {
            input_work_id: data.work_id,
            input_subjects: draft.subjects ?? [],
            input_genres: draft.genres ?? [],
        });
    }
    return {
        status: "created",
        message: data.status === "created" ? "电影条目已添加。" : "这个作品已经在你的库里。",
        workId: data.work_id,
        editionId: data.edition_id,
        entryId: data.entry_id,
    };
}
