import { createProviderSearchCache, searchProviderWithCache } from "@/lib/providers/cache";
import { getProviderSearchOrder } from "@/lib/providers/canonicalize";
import { createTmdbMovieProvider } from "@/lib/providers/tmdb";
const providerMap = {
    tmdb: createTmdbMovieProvider(),
};
function toMovieCandidate(candidate) {
    return {
        provider: "tmdb",
        externalId: candidate.externalId,
        title: candidate.title,
        releaseYear: candidate.releaseYear,
        coverUrl: candidate.coverUrl,
        runtimeMinutes: candidate.runtimeMinutes,
        description: candidate.description,
    };
}
export async function searchMovieCandidates(text) {
    const queryText = text.trim();
    if (!queryText) {
        return { candidates: [], notices: [] };
    }
    const query = {
        mediaType: "movie",
        text: queryText,
        limit: 10,
    };
    const cache = createProviderSearchCache();
    const providerIds = getProviderSearchOrder(query).filter((providerId) => providerId === "tmdb");
    const results = await Promise.all(providerIds.map(async (providerId) => ({
        providerId,
        result: await searchProviderWithCache(providerMap[providerId], query, cache),
    })));
    const candidates = [];
    const notices = [];
    const seen = new Set();
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
            candidates.push(toMovieCandidate(candidate));
        }
    }
    return {
        candidates: candidates.slice(0, 10),
        notices,
    };
}
