import type { UserScopedSupabaseClient } from "@/lib/supabase/server";

import { buildProviderQueryHash, normalizeSearchQuery } from "./hash";
import { err, ok } from "./result";
import type { CanonicalCandidate, MediaProvider, P0ProviderId, Result, SearchQuery } from "./types";

export type ProviderSearchCacheKey = {
  mediaType: "book" | "movie";
  provider: P0ProviderId;
  queryHash: string;
};

export type ProviderSearchCacheEntry = {
  results: CanonicalCandidate[];
  negative: boolean;
  expiresAt: Date;
};

export type ProviderSearchCacheStore = {
  get(key: ProviderSearchCacheKey): Promise<ProviderSearchCacheEntry | null>;
  set(
    key: ProviderSearchCacheKey,
    entry: ProviderSearchCacheEntry,
    query: SearchQuery,
  ): Promise<void>;
};

type ProviderSearchCacheOptions = {
  stores?: ProviderSearchCacheStore[];
  now?: () => Date;
};

type ProviderSearchCacheRpcPayload = {
  results_json?: unknown;
  negative?: unknown;
  expires_at?: unknown;
};

export class LruProviderSearchCacheStore implements ProviderSearchCacheStore {
  private readonly entries = new Map<string, ProviderSearchCacheEntry>();

  constructor(
    private readonly maxEntries = 100,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(key: ProviderSearchCacheKey): Promise<ProviderSearchCacheEntry | null> {
    const cacheKey = serializeKey(key);
    const entry = this.entries.get(cacheKey);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(cacheKey);
      return null;
    }

    this.entries.delete(cacheKey);
    this.entries.set(cacheKey, entry);
    return entry;
  }

  async set(key: ProviderSearchCacheKey, entry: ProviderSearchCacheEntry): Promise<void> {
    const cacheKey = serializeKey(key);

    if (this.entries.has(cacheKey)) {
      this.entries.delete(cacheKey);
    }

    this.entries.set(cacheKey, entry);

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;

      if (!oldestKey) {
        return;
      }

      this.entries.delete(oldestKey);
    }
  }
}

export class SupabaseProviderSearchCacheStore implements ProviderSearchCacheStore {
  constructor(private readonly client: UserScopedSupabaseClient) {}

  async get(key: ProviderSearchCacheKey): Promise<ProviderSearchCacheEntry | null> {
    const { data, error } = await this.client.rpc<ProviderSearchCacheRpcPayload>(
      "get_provider_search_cache",
      {
        input_media_type: key.mediaType,
        input_provider: key.provider,
        input_query_hash: key.queryHash,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return rpcPayloadToEntry(data);
  }

  async set(
    key: ProviderSearchCacheKey,
    entry: ProviderSearchCacheEntry,
    query: SearchQuery,
  ): Promise<void> {
    const { error } = await this.client.rpc("upsert_provider_search_cache", {
      input_media_type: key.mediaType,
      input_provider: key.provider,
      input_query_hash: key.queryHash,
      input_query_json: normalizeSearchQuery(query),
      input_results_json: entry.results,
      input_negative: entry.negative,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export class ProviderSearchCache {
  private readonly stores: ProviderSearchCacheStore[];
  private readonly now: () => Date;

  constructor(options: ProviderSearchCacheOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.stores = options.stores ?? [new LruProviderSearchCacheStore(100, this.now)];
  }

  async get(key: ProviderSearchCacheKey): Promise<ProviderSearchCacheEntry | null> {
    for (const [index, store] of this.stores.entries()) {
      const entry = await store.get(key);

      if (!entry) {
        continue;
      }

      await this.promote(key, entry, index);
      return entry;
    }

    return null;
  }

  async set(
    key: ProviderSearchCacheKey,
    results: CanonicalCandidate[],
    query: SearchQuery,
  ): Promise<ProviderSearchCacheEntry> {
    const entry: ProviderSearchCacheEntry = {
      results,
      negative: results.length === 0,
      expiresAt: computeCacheExpiresAt(results.length === 0, this.now()),
    };

    await Promise.all(this.stores.map((store) => store.set(key, entry, query)));
    return entry;
  }

  private async promote(
    key: ProviderSearchCacheKey,
    entry: ProviderSearchCacheEntry,
    hitStoreIndex: number,
  ) {
    const storesToPromote = this.stores.slice(0, hitStoreIndex);

    await Promise.all(
      storesToPromote.map((store) =>
        store.set(
          key,
          entry,
          {
            mediaType: key.mediaType,
            text: "",
          },
        ),
      ),
    );
  }
}

export function computeCacheExpiresAt(negative: boolean, now: Date): Date {
  const ttlMs = negative ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ttlMs);
}

export function createProviderSearchCache(client?: UserScopedSupabaseClient, now?: () => Date) {
  const memory = new LruProviderSearchCacheStore(100, now);
  const stores: ProviderSearchCacheStore[] = client
    ? [memory, new SupabaseProviderSearchCacheStore(client)]
    : [memory];

  return new ProviderSearchCache({
    stores,
    now,
  });
}

export async function searchProviderWithCache(
  provider: MediaProvider,
  query: SearchQuery,
  cache: ProviderSearchCache,
): Promise<Result<CanonicalCandidate[]>> {
  const key = {
    mediaType: query.mediaType,
    provider: provider.id,
    queryHash: buildProviderQueryHash(query),
  };

  try {
    const cached = await cache.get(key);

    if (cached) {
      return ok(cached.results);
    }

    const result = await provider.search(query);

    if (!result.ok) {
      return result;
    }

    await cache.set(key, result.value, query);
    return result;
  } catch (error) {
    return err("provider_error", "Provider cache access failed.", error);
  }
}

function serializeKey(key: ProviderSearchCacheKey) {
  return `${key.mediaType}:${key.provider}:${key.queryHash}`;
}

function rpcPayloadToEntry(payload: ProviderSearchCacheRpcPayload): ProviderSearchCacheEntry {
  const expiresAt = typeof payload.expires_at === "string" ? new Date(payload.expires_at) : new Date(0);
  const results = Array.isArray(payload.results_json)
    ? (payload.results_json as CanonicalCandidate[])
    : [];

  return {
    results,
    negative: payload.negative === true,
    expiresAt,
  };
}
