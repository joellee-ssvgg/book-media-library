import type { EnabledMediaTypeId, ProviderId, SearchTextConfig } from "@/lib/registry";

export type P0ProviderId = Extract<ProviderId, "openlibrary" | "googlebooks" | "tmdb" | "manual">;

export type ProviderErrorCode =
  | "invalid_query"
  | "missing_config"
  | "provider_error"
  | "rate_limited"
  | "timeout";

export type ResultError = {
  code: ProviderErrorCode;
  message: string;
  cause?: unknown;
};

export type Result<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: ResultError;
    };

export type SearchQuery = {
  mediaType: EnabledMediaTypeId;
  text: string;
  searchConfig?: SearchTextConfig;
  language?: string;
  limit?: number;
};

export type ExternalIdentifier = {
  source: P0ProviderId | "isbn";
  externalId: string;
  sourceUrl?: string;
};

export type CanonicalCredit = {
  role: "author" | "director" | "actor" | "translator" | "illustrator" | "composer";
  name: string;
  billingOrder?: number;
};

export type CanonicalCandidate = {
  provider: P0ProviderId;
  mediaType: EnabledMediaTypeId;
  externalId: string;
  title: string;
  originalTitle?: string;
  releaseYear?: number;
  description?: string;
  coverUrl?: string;
  language?: string;
  runtimeMinutes?: number;
  creators: string[];
  externalIds: ExternalIdentifier[];
  raw: unknown;
};

export type CanonicalRecord = CanonicalCandidate & {
  credits: CanonicalCredit[];
};

export type CanonicalWorkDraft = {
  work: {
    mediaType: EnabledMediaTypeId;
    canonicalTitle: string;
    originalTitle?: string;
    firstReleaseYear?: number;
    originalLanguage?: string;
    description?: string;
    coverUrl?: string;
    createdVia: "provider" | "manual_global";
  };
  externalIds: ExternalIdentifier[];
  credits: CanonicalCredit[];
};

export type RateLimitConfig = {
  requests: number;
  intervalSeconds: number;
};

export type ProviderFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ProviderEnvironment = {
  fetch?: ProviderFetch;
  googleBooksApiKey?: string;
  tmdbApiKey?: string;
};

export type MediaProvider = {
  id: P0ProviderId;
  mediaTypes: EnabledMediaTypeId[];
  rateLimit?: RateLimitConfig;
  search(query: SearchQuery): Promise<Result<CanonicalCandidate[]>>;
  fetch(externalId: string): Promise<Result<CanonicalRecord>>;
};
