import { describe, expect, it } from "vitest";

import {
  ProviderSearchCache,
  LruProviderSearchCacheStore,
  computeCacheExpiresAt,
  searchProviderWithCache,
} from "./cache";
import { canonicalizeProviderRecord, getProviderSearchOrder } from "./canonicalize";
import { createGoogleBooksProvider } from "./googlebooks";
import { createOpenLibraryProvider } from "./openlibrary";
import { createTmdbMovieProvider } from "./tmdb";
import type { CanonicalCandidate, MediaProvider, ProviderFetch } from "./types";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("Provider Adapter", () => {
  it("orders providers by media type and CJK ratio", () => {
    expect(getProviderSearchOrder({ mediaType: "book", text: "沙丘" })).toEqual([
      "openlibrary",
      "googlebooks",
      "manual",
    ]);
    expect(getProviderSearchOrder({ mediaType: "book", text: "Project Hail Mary" })).toEqual([
      "googlebooks",
      "openlibrary",
      "manual",
    ]);
    expect(getProviderSearchOrder({ mediaType: "movie", text: "Inception" })).toEqual([
      "tmdb",
      "manual",
    ]);
  });

  it("normalizes Open Library records with missing optional fields", async () => {
    const fetchImpl: ProviderFetch = async () =>
      jsonResponse({
        docs: [
          {
            key: "/works/OL45804W",
            isbn: ["9780441172719"],
          },
        ],
      });
    const provider = createOpenLibraryProvider({ fetch: fetchImpl });
    const result = await provider.search({ mediaType: "book", text: "沙丘" });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.value[0]).toMatchObject({
      provider: "openlibrary",
      mediaType: "book",
      externalId: "/works/OL45804W",
      title: "Untitled",
      externalIds: expect.arrayContaining([
        {
          source: "isbn",
          externalId: "9780441172719",
        },
      ]),
    });
  });

  it("returns Result.err for provider rate limits and timeouts", async () => {
    const rateLimitedFetch: ProviderFetch = async () => jsonResponse({}, 429);
    const timeoutFetch: ProviderFetch = async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    };
    const googleBooks = createGoogleBooksProvider({
      fetch: rateLimitedFetch,
      googleBooksApiKey: "test-google-key",
    });
    const tmdb = createTmdbMovieProvider({
      fetch: timeoutFetch,
      tmdbApiKey: "test-tmdb-key",
    });

    const rateLimited = await googleBooks.search({ mediaType: "book", text: "Dune" });
    const timeout = await tmdb.search({ mediaType: "movie", text: "Inception" });

    expect(rateLimited).toMatchObject({
      ok: false,
      error: {
        code: "rate_limited",
      },
    });
    expect(timeout).toMatchObject({
      ok: false,
      error: {
        code: "timeout",
      },
    });
  });

  it("uses memory cache for repeated provider queries", async () => {
    let calls = 0;
    const candidate: CanonicalCandidate = {
      provider: "openlibrary",
      mediaType: "book",
      externalId: "/works/OL45804W",
      title: "Dune",
      creators: ["Frank Herbert"],
      externalIds: [
        {
          source: "openlibrary",
          externalId: "/works/OL45804W",
        },
      ],
      raw: {},
    };
    const provider: MediaProvider = {
      id: "openlibrary",
      mediaTypes: ["book"],
      async search() {
        calls += 1;
        return {
          ok: true,
          value: [candidate],
        };
      },
      async fetch() {
        return {
          ok: true,
          value: {
            ...candidate,
            credits: [],
          },
        };
      },
    };
    const cache = new ProviderSearchCache({
      stores: [new LruProviderSearchCacheStore(10, () => new Date("2026-05-21T00:00:00Z"))],
      now: () => new Date("2026-05-21T00:00:00Z"),
    });
    const query = { mediaType: "book" as const, text: "Dune" };

    const first = await searchProviderWithCache(provider, query, cache);
    const second = await searchProviderWithCache(provider, query, cache);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(calls).toBe(1);
  });

  it("keeps normal and negative cache TTLs distinct", () => {
    const now = new Date("2026-05-21T00:00:00Z");

    expect(computeCacheExpiresAt(false, now).toISOString()).toBe("2026-05-22T00:00:00.000Z");
    expect(computeCacheExpiresAt(true, now).toISOString()).toBe("2026-05-21T01:00:00.000Z");
  });

  it("canonicalizes provider records into a work draft", () => {
    const draft = canonicalizeProviderRecord({
      provider: "googlebooks",
      mediaType: "book",
      externalId: "volume-id",
      title: "Dune",
      originalTitle: "Dune",
      releaseYear: 1965,
      language: "en",
      creators: ["Frank Herbert"],
      externalIds: [
        {
          source: "googlebooks",
          externalId: "volume-id",
        },
      ],
      raw: {},
      credits: [
        {
          role: "author",
          name: "Frank Herbert",
          billingOrder: 1,
        },
      ],
    });

    expect(draft).toEqual({
      work: {
        mediaType: "book",
        canonicalTitle: "Dune",
        originalTitle: "Dune",
        firstReleaseYear: 1965,
        originalLanguage: "en",
        description: undefined,
        coverUrl: undefined,
        createdVia: "provider",
      },
      externalIds: [
        {
          source: "googlebooks",
          externalId: "volume-id",
        },
      ],
      credits: [
        {
          role: "author",
          name: "Frank Herbert",
          billingOrder: 1,
        },
      ],
    });
  });
});
