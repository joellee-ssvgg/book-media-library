import { err, ok } from "./result";
export function normalizeText(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 0 ? normalized : undefined;
}
export function asRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }
    return value;
}
export function asRecordArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((item) => {
        const record = asRecord(item);
        return record ? [record] : [];
    });
}
export function asStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((item) => {
        const text = normalizeText(item);
        return text ? [text] : [];
    });
}
export function asInteger(value) {
    if (typeof value === "number" && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
        return Number(value);
    }
    return undefined;
}
export function parseYear(value) {
    const text = normalizeText(value);
    if (!text) {
        return undefined;
    }
    const match = text.match(/\d{4}/);
    return match ? Number(match[0]) : undefined;
}
export function firstText(...values) {
    for (const value of values) {
        const text = normalizeText(value);
        if (text) {
            return text;
        }
    }
    return undefined;
}
export async function requestJson(url, fetchImpl, timeoutMs = 8000, extraHeaders = {}) {
    const resolvedFetch = fetchImpl ?? globalThis.fetch;
    if (!resolvedFetch) {
        return err("missing_config", "fetch is not available in this runtime.");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await resolvedFetch(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "BookMediaLibrary/0.1.0",
                ...extraHeaders,
            },
            signal: controller.signal,
        });
        if (response.status === 429) {
            return err("rate_limited", `Provider rate limit exceeded for ${url.hostname}.`);
        }
        if (!response.ok) {
            return err("provider_error", `Provider returned HTTP ${response.status}.`);
        }
        return ok(await response.json());
    }
    catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return err("timeout", `Provider request timed out after ${timeoutMs}ms.`, error);
        }
        return err("provider_error", "Provider request failed.", error);
    }
    finally {
        clearTimeout(timeout);
    }
}
