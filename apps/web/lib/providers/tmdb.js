import { err, ok } from "./result";
import { asInteger, asRecord, asRecordArray, firstText, parseYear, requestJson } from "./utils";
import { loadWorkspaceEnv } from "@/lib/workspace-env";
import { TMDB_GENRE_TO_CANONICAL, getGenre } from "@/lib/recommendations/genres";

// TMDB 详情返回 genres:[{id,name}]，搜索结果返回 genre_ids:[number]。
function tmdbSubjects(raw) {
    if (Array.isArray(raw?.genres)) {
        const names = raw.genres.map((g) => (g && typeof g.name === "string" ? g.name : null)).filter(Boolean);
        if (names.length) return names;
    }
    if (Array.isArray(raw?.genre_ids)) {
        return raw.genre_ids.map((id) => getGenre(TMDB_GENRE_TO_CANONICAL[id])?.en).filter(Boolean);
    }
    return [];
}
function tmdbApiKey(environment) {
    loadWorkspaceEnv();
    return environment.tmdbApiKey ?? process.env.TMDB_API_KEY;
}
// TMDB v4 read access tokens are JWTs (eyJ...) and must go in an Authorization
// Bearer header; legacy v3 keys are hex strings passed as an api_key query param.
function tmdbAuth(url, apiKey) {
    if (typeof apiKey === "string" && apiKey.startsWith("eyJ")) {
        return { Authorization: `Bearer ${apiKey}` };
    }
    url.searchParams.set("api_key", apiKey);
    return {};
}
function posterUrl(path) {
    return path ? `https://image.tmdb.org/t/p/w500${path}` : undefined;
}
function tmdbSourceUrl(externalId) {
    return `https://www.themoviedb.org/movie/${encodeURIComponent(externalId)}`;
}
function normalizeTmdbMovie(raw) {
    const id = asInteger(raw.id)?.toString() ?? firstText(raw.id) ?? "unknown";
    const title = firstText(raw.title, raw.name, raw.original_title) ?? "Untitled";
    return {
        provider: "tmdb",
        mediaType: "movie",
        externalId: id,
        title,
        originalTitle: firstText(raw.original_title),
        releaseYear: parseYear(raw.release_date),
        description: firstText(raw.overview),
        coverUrl: posterUrl(firstText(raw.poster_path)),
        language: firstText(raw.original_language),
        runtimeMinutes: asInteger(raw.runtime),
        subjects: tmdbSubjects(raw),
        creators: [],
        externalIds: [
            {
                source: "tmdb",
                externalId: id,
                sourceUrl: tmdbSourceUrl(id),
            },
        ],
        raw,
    };
}
export function createTmdbMovieProvider(environment = {}) {
    return {
        id: "tmdb",
        mediaTypes: ["movie"],
        rateLimit: {
            requests: 40,
            intervalSeconds: 10,
        },
        async search(query) {
            const apiKey = tmdbApiKey(environment);
            const text = query.text.trim();
            if (!apiKey) {
                return err("missing_config", "TMDB_API_KEY is required for TMDB provider.");
            }
            if (!text) {
                return err("invalid_query", "TMDB search query is empty.");
            }
            const url = new URL("https://api.themoviedb.org/3/search/movie");
            url.searchParams.set("query", text);
            url.searchParams.set("include_adult", "false");
            if (query.language) {
                url.searchParams.set("language", query.language);
            }
            const authHeaders = tmdbAuth(url, apiKey);
            const result = await requestJson(url, environment.fetch, 8000, authHeaders);
            if (!result.ok) {
                return result;
            }
            const payload = asRecord(result.value);
            const results = asRecordArray(payload?.results);
            return ok(results.slice(0, query.limit ?? 10).map(normalizeTmdbMovie));
        },
        async fetch(externalId) {
            const apiKey = tmdbApiKey(environment);
            const normalizedId = externalId.trim();
            if (!apiKey) {
                return err("missing_config", "TMDB_API_KEY is required for TMDB provider.");
            }
            if (!normalizedId) {
                return err("invalid_query", "TMDB external id is empty.");
            }
            const url = new URL(`https://api.themoviedb.org/3/movie/${encodeURIComponent(normalizedId)}`);
            const authHeaders = tmdbAuth(url, apiKey);
            const result = await requestJson(url, environment.fetch, 8000, authHeaders);
            if (!result.ok) {
                return result;
            }
            const candidate = normalizeTmdbMovie(asRecord(result.value) ?? {});
            return ok({
                ...candidate,
                credits: [],
            });
        },
        // TMDB /movie/{id}/recommendations — "看过这部的人也喜欢"。返回带评分/热度的候选，
        // 供推荐板块跨多个种子聚合排序。
        async recommendations(externalId) {
            const apiKey = tmdbApiKey(environment);
            const normalizedId = externalId.trim();
            if (!apiKey) {
                return err("missing_config", "TMDB_API_KEY is required for TMDB provider.");
            }
            if (!normalizedId) {
                return err("invalid_query", "TMDB external id is empty.");
            }
            const url = new URL(`https://api.themoviedb.org/3/movie/${encodeURIComponent(normalizedId)}/recommendations`);
            const authHeaders = tmdbAuth(url, apiKey);
            const result = await requestJson(url, environment.fetch, 8000, authHeaders);
            if (!result.ok) {
                return result;
            }
            const payload = asRecord(result.value);
            const results = asRecordArray(payload?.results);
            return ok(results.map((raw) => ({
                ...normalizeTmdbMovie(raw),
                voteAverage: typeof raw.vote_average === "number" ? raw.vote_average : 0,
                popularity: typeof raw.popularity === "number" ? raw.popularity : 0,
                adult: raw.adult === true,
            })));
        },
    };
}
export const tmdbMovieProvider = createTmdbMovieProvider();
