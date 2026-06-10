import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { captureTask20OperationalAlert } from "@/lib/observability/sentry";
import { ipRateLimitForPath, shouldApplyTask20RateLimit } from "@/lib/rate-limit/config";
import { evaluateTask20RateLimit } from "@/lib/rate-limit/store";
import { createUpstashRateLimitStore } from "@/lib/rate-limit/upstash";
const publicProfilePattern = /^\/u\/([^/]+)$/;
const privatePathPattern = /^\/(dashboard|library|lists|settings|add|maps|onboarding)(\/|$)/;
function supabasePublicProfileRpcUrl() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
        return null;
    }
    return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/task17_public_profile_state`;
}
function getClientIp(request) {
    const forwardedFor = request.headers.get("x-forwarded-for") ?? request.headers.get("x-vercel-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() || "127.0.0.1";
    }
    return request.headers.get("x-real-ip") ?? "127.0.0.1";
}
export function isPrivatePath(pathname) {
    return privatePathPattern.test(pathname);
}
export function hasSupabaseAuthCookie(cookies) {
    return cookies.some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}
export function withSessionCookies(target, source) {
    source.cookies.getAll().forEach((cookie) => {
        target.cookies.set(cookie);
    });
    return target;
}
// Resolves the Supabase session once per request. getClaims() verifies the JWT
// locally via the project JWKS when asymmetric signing keys are in use, and
// refreshes an expired access token with the refresh token. Refreshed cookies
// are forwarded to the downstream render (NextResponse.next({ request })) and
// set on the response so the browser persists them.
async function resolveSession(request) {
    let response = NextResponse.next({ request });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey || !hasSupabaseAuthCookie(request.cookies.getAll())) {
        return { userId: null, response };
    }
    const supabase = createServerClient(url, anonKey, {
        auth: {
            flowType: "pkce",
        },
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, {
                        ...options,
                        path: options?.path ?? "/",
                    });
                });
            },
        },
    });
    try {
        const { data, error } = await supabase.auth.getClaims();
        if (error) {
            return { userId: null, response };
        }
        return { userId: data?.claims?.sub ?? null, response };
    }
    catch (error) {
        await captureTask20OperationalAlert({
            code: "proxy_session_resolve_error",
            message: error instanceof Error ? error.message : "Proxy session resolution failed",
        }).catch(() => undefined);
        return { userId: null, response };
    }
}
async function task20RateLimitResponse(request, userId) {
    if (!shouldApplyTask20RateLimit(request.nextUrl.pathname)) {
        return null;
    }
    const decision = await evaluateTask20RateLimit({
        ip: getClientIp(request),
        profileId: userId,
        store: createUpstashRateLimitStore(),
        alert: (alert) => captureTask20OperationalAlert(alert).then(() => undefined),
        ipRule: ipRateLimitForPath(request.nextUrl.pathname),
    });
    if (decision.allowed) {
        return null;
    }
    return new NextResponse("Too Many Requests", {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Retry-After": String(decision.retryAfterSeconds ?? 60),
            "X-RateLimit-Limit": String(decision.limit ?? ""),
            "X-RateLimit-Remaining": String(decision.remaining ?? 0),
            "X-RateLimit-Scope": decision.scope ?? "unknown",
        },
        status: 429,
    });
}
export async function proxy(request) {
    const { userId, response } = await resolveSession(request);
    const limited = await task20RateLimitResponse(request, userId);
    if (limited) {
        return withSessionCookies(limited, response);
    }
    const pathname = request.nextUrl.pathname;
    if (isPrivatePath(pathname) && !userId) {
        const signIn = new URL("/auth/sign-in", request.url);
        signIn.searchParams.set("next", pathname);
        return withSessionCookies(NextResponse.redirect(signIn), response);
    }
    const match = pathname.match(publicProfilePattern);
    if (!match) {
        return response;
    }
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const rpcUrl = supabasePublicProfileRpcUrl();
    if (!anonKey || !rpcUrl) {
        return withSessionCookies(new NextResponse("Supabase public config is missing", { status: 503 }), response);
    }
    const profileResponse = await fetch(rpcUrl, {
        body: JSON.stringify({ input_username: decodeURIComponent(match[1]) }),
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
        },
        method: "POST",
    });
    if (!profileResponse.ok) {
        return withSessionCookies(new NextResponse("Public profile lookup failed", { status: 503 }), response);
    }
    const data = (await profileResponse.json());
    if (data.status === "gone") {
        return withSessionCookies(new NextResponse("Gone", {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
            status: 410,
        }), response);
    }
    return response;
}
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|pwa-icon.svg).*)"],
};
