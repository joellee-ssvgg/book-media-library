import { createGoogleBooksProvider } from "@/lib/providers/googlebooks";
import { createOpenLibraryProvider } from "@/lib/providers/openlibrary";
import { createProviderSearchCache, searchProviderWithCache } from "@/lib/providers/cache";
import { getProviderSearchOrder } from "@/lib/providers/canonicalize";
import type { CanonicalCandidate, MediaProvider, SearchQuery } from "@/lib/providers/types";
import type { BookCandidateView, ProviderSearchNotice } from "@/schemas/book-add";

const providerMap: Record<"openlibrary" | "googlebooks", MediaProvider> = {
  openlibrary: createOpenLibraryProvider(),
  googlebooks: createGoogleBooksProvider(),
};

function toBookCandidate(candidate: CanonicalCandidate): BookCandidateView {
  return {
    provider: candidate.provider as "openlibrary" | "googlebooks",
    externalId: candidate.externalId,
    title: candidate.title,
    creators: candidate.creators,
    releaseYear: candidate.releaseYear,
    coverUrl: candidate.coverUrl,
  };
}

export async function searchBookCandidates(text: string): Promise<{
  candidates: BookCandidateView[];
  notices: ProviderSearchNotice[];
}> {
  const queryText = text.trim();

  if (!queryText) {
    return { candidates: [], notices: [] };
  }

  const query: SearchQuery = {
    mediaType: "book",
    text: queryText,
    limit: 5,
  };
  const cache = createProviderSearchCache();
  const providerIds = getProviderSearchOrder(query).filter(
    (providerId): providerId is "openlibrary" | "googlebooks" =>
      providerId === "openlibrary" || providerId === "googlebooks",
  );

  const results = await Promise.all(
    providerIds.map(async (providerId) => ({
      providerId,
      result: await searchProviderWithCache(providerMap[providerId], query, cache),
    })),
  );

  const candidates: BookCandidateView[] = [];
  const notices: ProviderSearchNotice[] = [];
  const seen = new Set<string>();

  for (const { providerId, result } of results) {
    if (!result.ok) {
      notices.push({ provider: providerId, message: result.error.message });
      continue;
    }

    for (const candidate of result.value) {
      const key = `${candidate.provider}:${candidate.externalId}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push(toBookCandidate(candidate));
    }
  }

  return {
    candidates: candidates.slice(0, 10),
    notices,
  };
}
