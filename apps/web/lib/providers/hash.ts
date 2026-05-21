import { createHash } from "node:crypto";

import type { SearchQuery } from "./types";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

export function normalizeSearchQuery(query: SearchQuery) {
  return {
    language: query.language?.trim().toLowerCase() || null,
    limit: query.limit ?? null,
    mediaType: query.mediaType,
    searchConfig: query.searchConfig ?? null,
    text: query.text.replace(/\s+/g, " ").trim().toLowerCase(),
  };
}

export function buildProviderQueryHash(query: SearchQuery): string {
  return createHash("sha256").update(stableJson(normalizeSearchQuery(query))).digest("hex");
}
