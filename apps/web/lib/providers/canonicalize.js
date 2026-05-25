import { getRegistry } from "@/lib/registry";
const P0_PROVIDER_IDS = ["openlibrary", "googlebooks", "tmdb", "manual"];
function isP0ProviderId(value) {
    return P0_PROVIDER_IDS.includes(value);
}
function definedText(value) {
    return value && value.trim().length > 0 ? value.trim() : undefined;
}
export function getProviderSearchOrder(query) {
    const registry = getRegistry(query.mediaType);
    const providers = registry.searchProviders.filter(isP0ProviderId);
    const searchConfig = query.searchConfig ?? registry.pickSearchConfig(query.text);
    if (query.mediaType === "book" && searchConfig === "english") {
        return providers.toSorted((left, right) => {
            const order = {
                googlebooks: 0,
                openlibrary: 1,
                tmdb: 2,
                manual: 3,
            };
            return order[left] - order[right];
        });
    }
    if (query.mediaType === "book" && searchConfig === "chinese_jieba") {
        return providers.toSorted((left, right) => {
            const order = {
                openlibrary: 0,
                googlebooks: 1,
                tmdb: 2,
                manual: 3,
            };
            return order[left] - order[right];
        });
    }
    return providers;
}
export function canonicalizeProviderRecord(record) {
    return {
        work: {
            mediaType: record.mediaType,
            canonicalTitle: record.title,
            originalTitle: definedText(record.originalTitle),
            firstReleaseYear: record.releaseYear,
            originalLanguage: definedText(record.language),
            description: definedText(record.description),
            coverUrl: definedText(record.coverUrl),
            createdVia: record.provider === "manual" ? "manual_global" : "provider",
        },
        externalIds: record.externalIds,
        credits: "credits" in record ? record.credits : [],
    };
}
