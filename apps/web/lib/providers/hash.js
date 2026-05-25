import { createHash } from "node:crypto";
function stableJson(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableJson).join(",")}]`;
    }
    if (value && typeof value === "object") {
        const record = value;
        const entries = Object.keys(record)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);
        return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value);
}
export function normalizeSearchQuery(query) {
    return {
        language: query.language?.trim().toLowerCase() || null,
        limit: query.limit ?? null,
        mediaType: query.mediaType,
        searchConfig: query.searchConfig ?? null,
        text: query.text.replace(/\s+/g, " ").trim().toLowerCase(),
    };
}
export function buildProviderQueryHash(query) {
    return createHash("sha256").update(stableJson(normalizeSearchQuery(query))).digest("hex");
}
