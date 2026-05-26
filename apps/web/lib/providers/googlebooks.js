import { err, ok } from "./result";
import { asRecord, asRecordArray, asStringArray, firstText, parseYear, requestJson } from "./utils";
import { loadWorkspaceEnv } from "@/lib/workspace-env";
function googleBooksApiKey(environment) {
    loadWorkspaceEnv();
    return environment.googleBooksApiKey ?? process.env.GOOGLE_BOOKS_API_KEY;
}
function isbnExternalIds(industryIdentifiers) {
    return industryIdentifiers.flatMap((identifier) => {
        const externalId = firstText(identifier.identifier);
        if (!externalId) {
            return [];
        }
        return [
            {
                source: "isbn",
                externalId,
            },
        ];
    });
}
function normalizeGoogleBooksCandidate(raw) {
    const volumeInfo = asRecord(raw.volumeInfo) ?? {};
    const externalId = firstText(raw.id) ?? firstText(volumeInfo.id) ?? "unknown";
    const title = firstText(volumeInfo.title, raw.title) ?? "Untitled";
    const authors = asStringArray(volumeInfo.authors);
    const imageLinks = asRecord(volumeInfo.imageLinks) ?? {};
    const industryIdentifiers = asRecordArray(volumeInfo.industryIdentifiers);
    return {
        provider: "googlebooks",
        mediaType: "book",
        externalId,
        title,
        releaseYear: parseYear(volumeInfo.publishedDate),
        description: firstText(volumeInfo.description),
        coverUrl: firstText(imageLinks.thumbnail, imageLinks.smallThumbnail),
        language: firstText(volumeInfo.language),
        creators: authors,
        externalIds: [
            {
                source: "googlebooks",
                externalId,
                sourceUrl: `https://books.google.com/books?id=${encodeURIComponent(externalId)}`,
            },
            ...isbnExternalIds(industryIdentifiers),
        ],
        raw,
    };
}
function creditsFromAuthors(authors) {
    return authors.map((name, index) => ({
        role: "author",
        name,
        billingOrder: index + 1,
    }));
}
export function createGoogleBooksProvider(environment = {}) {
    return {
        id: "googlebooks",
        mediaTypes: ["book"],
        rateLimit: {
            requests: 1000,
            intervalSeconds: 86400,
        },
        async search(query) {
            const apiKey = googleBooksApiKey(environment);
            const text = query.text.trim();
            if (!apiKey) {
                return err("missing_config", "GOOGLE_BOOKS_API_KEY is required for Google Books provider.");
            }
            if (!text) {
                return err("invalid_query", "Google Books search query is empty.");
            }
            const url = new URL("https://www.googleapis.com/books/v1/volumes");
            url.searchParams.set("q", text);
            url.searchParams.set("maxResults", String(query.limit ?? 10));
            url.searchParams.set("key", apiKey);
            const result = await requestJson(url, environment.fetch);
            if (!result.ok) {
                return result;
            }
            const payload = asRecord(result.value);
            const items = asRecordArray(payload?.items);
            return ok(items.map(normalizeGoogleBooksCandidate));
        },
        async fetch(externalId) {
            const apiKey = googleBooksApiKey(environment);
            const normalizedId = externalId.trim();
            if (!apiKey) {
                return err("missing_config", "GOOGLE_BOOKS_API_KEY is required for Google Books provider.");
            }
            if (!normalizedId) {
                return err("invalid_query", "Google Books external id is empty.");
            }
            const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(normalizedId)}`);
            url.searchParams.set("key", apiKey);
            const result = await requestJson(url, environment.fetch);
            if (!result.ok) {
                return result;
            }
            const raw = asRecord(result.value) ?? {};
            const candidate = normalizeGoogleBooksCandidate(raw);
            return ok({
                ...candidate,
                credits: creditsFromAuthors(candidate.creators),
            });
        },
    };
}
export const googleBooksProvider = createGoogleBooksProvider();
