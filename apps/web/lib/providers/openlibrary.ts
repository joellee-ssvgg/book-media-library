import { err, ok } from "./result";
import {
  asInteger,
  asRecord,
  asRecordArray,
  asStringArray,
  firstText,
  requestJson,
} from "./utils";
import type {
  CanonicalCandidate,
  CanonicalCredit,
  CanonicalRecord,
  MediaProvider,
  ProviderEnvironment,
} from "./types";

function coverUrl(coverId: number | undefined) {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;
}

function openLibrarySourceUrl(externalId: string) {
  if (externalId.startsWith("/")) {
    return `https://openlibrary.org${externalId}`;
  }

  return `https://openlibrary.org/works/${externalId}`;
}

function normalizeOpenLibraryCandidate(raw: Record<string, unknown>): CanonicalCandidate {
  const key = firstText(raw.key) ?? firstText(raw.cover_edition_key) ?? "unknown";
  const isbn = asStringArray(raw.isbn);
  const title = firstText(raw.title, raw.title_suggest) ?? "Untitled";
  const authors = asStringArray(raw.author_name);
  const externalIds = [
    {
      source: "openlibrary" as const,
      externalId: key,
      sourceUrl: openLibrarySourceUrl(key),
    },
    ...isbn.map((externalId) => ({
      source: "isbn" as const,
      externalId,
    })),
  ];

  return {
    provider: "openlibrary",
    mediaType: "book",
    externalId: key,
    title,
    releaseYear: asInteger(raw.first_publish_year),
    coverUrl: coverUrl(asInteger(raw.cover_i)),
    creators: authors,
    externalIds,
    raw,
  };
}

function creditsFromAuthors(authors: string[]): CanonicalCredit[] {
  return authors.map((name, index) => ({
    role: "author",
    name,
    billingOrder: index + 1,
  }));
}

export function createOpenLibraryProvider(environment: ProviderEnvironment = {}): MediaProvider {
  return {
    id: "openlibrary",
    mediaTypes: ["book"],
    rateLimit: {
      requests: 100,
      intervalSeconds: 60,
    },
    async search(query) {
      const text = query.text.trim();

      if (!text) {
        return err("invalid_query", "Open Library search query is empty.");
      }

      const url = new URL("https://openlibrary.org/search.json");
      url.searchParams.set("q", text);
      url.searchParams.set("limit", String(query.limit ?? 10));

      const result = await requestJson(url, environment.fetch);

      if (!result.ok) {
        return result;
      }

      const payload = asRecord(result.value);
      const docs = asRecordArray(payload?.docs);

      return ok(docs.map(normalizeOpenLibraryCandidate));
    },
    async fetch(externalId) {
      const normalizedId = externalId.trim();

      if (!normalizedId) {
        return err("invalid_query", "Open Library external id is empty.");
      }

      const path = normalizedId.startsWith("/") ? `${normalizedId}.json` : `/works/${normalizedId}.json`;
      const result = await requestJson(new URL(`https://openlibrary.org${path}`), environment.fetch);

      if (!result.ok) {
        return result;
      }

      const raw = asRecord(result.value) ?? {};
      const candidate = normalizeOpenLibraryCandidate({
        ...raw,
        key: firstText(raw.key) ?? normalizedId,
      });

      return ok({
        ...candidate,
        credits: creditsFromAuthors(candidate.creators),
      } satisfies CanonicalRecord);
    },
  };
}

export const openLibraryProvider = createOpenLibraryProvider();
