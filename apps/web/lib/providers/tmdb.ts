import { err, ok } from "./result";
import { asInteger, asRecord, asRecordArray, firstText, parseYear, requestJson } from "./utils";
import type {
  CanonicalCandidate,
  CanonicalCredit,
  CanonicalRecord,
  MediaProvider,
  ProviderEnvironment,
} from "./types";

function tmdbApiKey(environment: ProviderEnvironment) {
  return environment.tmdbApiKey ?? process.env.TMDB_API_KEY;
}

function posterUrl(path: string | undefined) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : undefined;
}

function tmdbSourceUrl(externalId: string) {
  return `https://www.themoviedb.org/movie/${encodeURIComponent(externalId)}`;
}

function normalizeTmdbMovie(raw: Record<string, unknown>): CanonicalCandidate {
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

export function createTmdbMovieProvider(environment: ProviderEnvironment = {}): MediaProvider {
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
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("include_adult", "false");

      if (query.language) {
        url.searchParams.set("language", query.language);
      }

      const result = await requestJson(url, environment.fetch);

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
      url.searchParams.set("api_key", apiKey);

      const result = await requestJson(url, environment.fetch);

      if (!result.ok) {
        return result;
      }

      const candidate = normalizeTmdbMovie(asRecord(result.value) ?? {});

      return ok({
        ...candidate,
        credits: [] satisfies CanonicalCredit[],
      } satisfies CanonicalRecord);
    },
  };
}

export const tmdbMovieProvider = createTmdbMovieProvider();
