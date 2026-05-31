import { NextResponse } from "next/server";
import { captureTask20OperationalAlert } from "@/lib/observability/sentry";
import { shouldApplyTask20RateLimit } from "@/lib/rate-limit/config";
import { evaluateTask20RateLimit } from "@/lib/rate-limit/store";
import { createUpstashRateLimitStore } from "@/lib/rate-limit/upstash";
const publicProfilePattern = /^\/u\/([^/]+)$/;
const privatePathPattern = /^\/(dashboard|library|lists|settings|add)(\/|$)/;
function supabaseRestRpcUrl(functionName) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
        return null;
    }
    return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${functionName}`;
}
function supabaseAuthUserUrl() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
        return null;
    }
    return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`;
}
function supabasePublicProfileRpcUrl() {
    return supabaseRestRpcUrl("task17_public_profile_state");
}
function supabaseTask20ProfileRpcUrl() {
    return supabaseRestRpcUrl("task20_current_profile_id");
}
function getClientIp(request) {
    const forwardedFor = request.headers.get("x-forwarded-for") ?? request.headers.get("x-vercel-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() || "127.0.0.1";
    }
    return request.headers.get("x-real-ip") ?? "127.0.0.1";
}
function maybeJwt(value) {
    const token = value?.trim();
    if (!token || !token.startsWith("eyJ")) {
        return null;
    }
    return token;
}
function decodeBase64CookieValue(value) {
    if (!value.startsWith("base64-")) {
        return value;
    }
    const encoded = value.slice("base64-".length);
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
}
export function tokenFromCookieValue(value) {
    if (!value) {
        return null;
    }
    let rawValue;
    try {
        rawValue = decodeBase64CookieValue(decodeURIComponent(value));
    }
    catch {
        return null;
    }
    const directToken = maybeJwt(rawValue);
    if (directToken) {
        return directToken;
    }
    try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed)) {
            return maybeJwt(String(parsed[0] ?? ""));
        }
        if (parsed && typeof parsed === "object" && "access_token" in parsed) {
            return maybeJwt(String(parsed.access_token ?? ""));
        }
    }
    catch {
        return null;
    }
    return null;
}
function supabaseAuthCookieBaseName(name) {
    if (name === "sb-access-token" || name === "supabase-auth-token") {
        return name;
    }
    if (!name.startsWith("sb-") || !name.includes("-auth-token")) {
        return null;
    }
    return name.replace(/[.](0|[1-9][0-9]*)$/, "");
}
function combinedCookieValue(cookies, baseName) {
    const direct = cookies.find((cookie) => cookie.name === baseName);
    if (direct?.value) {
        return direct.value;
    }
    const chunks = [];
    for (let index = 0;; index += 1) {
        const chunk = cookies.find((cookie) => cookie.name === `${baseName}.${index}`);
        if (!chunk?.value) {
            break;
        }
        chunks.push(chunk.value);
    }
    return chunks.length > 0 ? chunks.join("") : null;
}
export function accessTokenFromCookies(cookies) {
    const baseNames = new Set();
    for (const cookie of cookies) {
        const baseName = supabaseAuthCookieBaseName(cookie.name);
        if (baseName) {
            baseNames.add(baseName);
        }
    }
    for (const baseName of baseNames) {
        const token = tokenFromCookieValue(combinedCookieValue(cookies, baseName));
        if (token) {
            return token;
        }
    }
    return null;
}
export function extractAccessToken(request) {
    const authorization = request.headers.get("authorization");
    if (authorization?.toLowerCase().startsWith("bearer ")) {
        return maybeJwt(authorization.slice("bearer ".length));
    }
    return accessTokenFromCookies(request.cookies.getAll());
}
async function resolveTask20ProfileId(request) {
    const accessToken = extractAccessToken(request);
    if (!accessToken) {
        return null;
    }
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const rpcUrl = supabaseTask20ProfileRpcUrl();
    if (!anonKey || !rpcUrl) {
        throw new Error("Supabase public config is missing for Task20 profile rate limit");
    }
    const response = await fetch(rpcUrl, {
        body: "{}",
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        method: "POST",
    });
    if (!response.ok) {
        throw new Error(`Task20 profile lookup failed with ${response.status}`);
    }
    const profileId = (await response.json());
    return typeof profileId === "string" && profileId.trim() ? profileId : null;
}
async function task20RateLimitResponse(request) {
    if (!shouldApplyTask20RateLimit(request.nextUrl.pathname)) {
        return null;
    }
    let profileId = null;
    try {
        profileId = await resolveTask20ProfileId(request);
    }
    catch (error) {
        await captureTask20OperationalAlert({
            code: "task20_profile_resolve_error",
            message: error instanceof Error ? error.message : "Task20 profile lookup failed",
        }).catch(() => undefined);
    }
    const decision = await evaluateTask20RateLimit({
        ip: getClientIp(request),
        profileId,
        store: createUpstashRateLimitStore(),
        alert: (alert) => captureTask20OperationalAlert(alert).then(() => undefined),
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
function allAccessTokenCandidates(request) {
    const tokens = [];
    const authorization = request.headers.get("authorization");
    if (authorization?.toLowerCase().startsWith("bearer ")) {
        const headerToken = maybeJwt(authorization.slice("bearer ".length));
        if (headerToken) {
            tokens.push(headerToken);
        }
    }
    const cookies = request.cookies.getAll();
    const baseNames = new Set();
    for (const cookie of cookies) {
        const baseName = supabaseAuthCookieBaseName(cookie.name);
        if (baseName) {
            baseNames.add(baseName);
        }
    }
    for (const baseName of baseNames) {
        const token = tokenFromCookieValue(combinedCookieValue(cookies, baseName));
        if (token) {
            tokens.push(token);
        }
    }
    return tokens;
}
async function hasValidSupabaseSession(request) {
    const tokens = allAccessTokenCandidates(request);
    if (tokens.length === 0) {
        return false;
    }
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const userUrl = supabaseAuthUserUrl();
    if (!anonKey || !userUrl) {
        return false;
    }
    // Validate every candidate: a stale auth cookie from another Supabase
    // project (e.g. after switching backends) must not block a valid session.
    for (const token of tokens) {
        const response = await fetch(userUrl, {
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${token}`,
            },
        });
        if (response.ok) {
            return true;
        }
    }
    return false;
}
export async function proxy(request) {
    const limited = await task20RateLimitResponse(request);
    if (limited) {
        return limited;
    }
    const pathname = request.nextUrl.pathname;
    const hasToken = privatePathPattern.test(pathname)
        ? await hasValidSupabaseSession(request)
        : false;
    if (privatePathPattern.test(pathname) && !hasToken) {
        const signIn = new URL("/auth/sign-in", request.url);
        signIn.searchParams.set("next", pathname);
        return NextResponse.redirect(signIn);
    }
    const match = pathname.match(publicProfilePattern);
    if (!match) {
        return NextResponse.next();
    }
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const rpcUrl = supabasePublicProfileRpcUrl();
    if (!anonKey || !rpcUrl) {
        return new NextResponse("Supabase public config is missing", { status: 503 });
    }
    const response = await fetch(rpcUrl, {
        body: JSON.stringify({ input_username: decodeURIComponent(match[1]) }),
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
        },
        method: "POST",
    });
    if (!response.ok) {
        return new NextResponse("Public profile lookup failed", { status: 503 });
    }
    const data = (await response.json());
    if (data.status === "gone") {
        return new NextResponse("Gone", {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
            status: 410,
        });
    }
    return NextResponse.next();
}
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|pwa-icon.svg).*)"],
};
