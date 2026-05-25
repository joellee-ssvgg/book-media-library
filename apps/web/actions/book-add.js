"use server";
import { createGoogleBooksProvider } from "@/lib/providers/googlebooks";
import { createOpenLibraryProvider } from "@/lib/providers/openlibrary";
import { canonicalizeProviderRecord } from "@/lib/providers/canonicalize";
import { createActionSupabase } from "@/lib/supabase/server";
import { addBookEntryFormSchema, } from "@/schemas/book-add";
const bookProviders = {
    openlibrary: createOpenLibraryProvider(),
    googlebooks: createGoogleBooksProvider(),
};
function toFieldErrors(result) {
    return result.success ? undefined : result.error.flatten().fieldErrors;
}
export async function addBookEntryAction(_previousState, formData) {
    const parsed = addBookEntryFormSchema.safeParse({
        accessToken: formData.get("accessToken"),
        provider: formData.get("provider"),
        externalId: formData.get("externalId"),
        status: formData.get("status"),
    });
    if (!parsed.success) {
        return {
            status: "validation_error",
            message: "书籍添加表单未通过校验。",
            fieldErrors: toFieldErrors(parsed),
        };
    }
    const provider = bookProviders[parsed.data.provider];
    const recordResult = await provider.fetch(parsed.data.externalId);
    if (!recordResult.ok) {
        return {
            status: "provider_error",
            message: recordResult.error.message,
        };
    }
    const draft = canonicalizeProviderRecord(recordResult.value);
    const supabase = await createActionSupabase(parsed.data.accessToken);
    if ("error" in supabase) {
        return {
            status: "config_error",
            message: supabase.error,
        };
    }
    const { data, error } = await supabase.client.rpc("task14_create_book_entry_from_provider", {
        input_provider: parsed.data.provider,
        input_external_id: parsed.data.externalId,
        input_title: draft.work.canonicalTitle,
        input_status: parsed.data.status,
        input_year: draft.work.firstReleaseYear ?? null,
        input_original_title: draft.work.originalTitle ?? null,
        input_language: draft.work.originalLanguage ?? null,
        input_description: draft.work.description ?? null,
        input_cover_url: draft.work.coverUrl ?? null,
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
            message: "task14_create_book_entry_from_provider 没有返回结果。",
        };
    }
    return {
        status: "created",
        message: data.status === "created" ? "书籍条目已添加。" : "这个作品已经在你的库里。",
        workId: data.work_id,
        editionId: data.edition_id,
        entryId: data.entry_id,
    };
}
