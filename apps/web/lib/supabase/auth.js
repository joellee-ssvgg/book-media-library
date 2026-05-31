import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function getSupabaseAuthConfig() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        return {
            error: "NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 必须配置后才能登录。",
        };
    }
    return { anonKey, url };
}
export function normalizeAuthNextPath(value) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
        return "/dashboard";
    }
    return value;
}

function firstHeaderValue(value) {
    return value?.split(",")[0]?.trim() || null;
}

export function requestOrigin(request) {
    const host = firstHeaderValue(request.headers.get("x-forwarded-host"))
        ?? firstHeaderValue(request.headers.get("host"));
    if (host) {
        const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto"))
            ?? new URL(request.url).protocol.replace(":", "");
        return `${protocol}://${host}`;
    }
    return new URL(request.url).origin;
}

export function requestUrl(path, request) {
    return new URL(path, requestOrigin(request));
}

function applyPendingHeaders(response, headers) {
    if (!headers) {
        return;
    }
    if (typeof headers.forEach === "function") {
        headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        return;
    }
    Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
}

export function createRouteSupabaseClient(request) {
    const config = getSupabaseAuthConfig();
    if ("error" in config) {
        return config;
    }

    const pendingCookies = [];
    const pendingHeaders = [];
    const supabase = createServerClient(config.url, config.anonKey, {
        auth: {
            flowType: "pkce",
        },
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet, headers) {
                pendingCookies.push(...cookiesToSet);
                pendingHeaders.push(headers);
            },
        },
    });

    return {
        supabase,
        applyToResponse(response) {
            pendingCookies.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, {
                    ...options,
                    path: options.path ?? "/",
                });
            });
            pendingHeaders.forEach((headers) => applyPendingHeaders(response, headers));
            return response;
        },
    };
}

export async function createCookieSupabaseClient() {
    const config = getSupabaseAuthConfig();
    if ("error" in config) {
        return config;
    }
    const cookieStore = await cookies();
    return createServerClient(config.url, config.anonKey, {
        auth: {
            flowType: "pkce",
        },
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    try {
                        cookieStore.set(name, value, {
                            ...options,
                            path: options.path ?? "/",
                        });
                    }
                    catch {
                        // Server Components cannot write refreshed auth cookies; middleware/actions handle writes.
                    }
                });
            },
        },
    });
}
