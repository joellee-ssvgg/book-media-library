import { NextResponse, type NextRequest } from "next/server";
import { captureTask20OperationalAlert } from "@/lib/observability/sentry";
import { shouldApplyTask20RateLimit } from "@/lib/rate-limit/config";
import { evaluateTask20RateLimit } from "@/lib/rate-limit/store";
import { createUpstashRateLimitStore } from "@/lib/rate-limit/upstash";

const publicProfilePattern = /^\/u\/([^/]+)$/;

function supabaseRestRpcUrl(functionName: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${functionName}`;
}

function supabasePublicProfileRpcUrl() {
  return supabaseRestRpcUrl("task17_public_profile_state");
}

function supabaseTask20ProfileRpcUrl() {
  return supabaseRestRpcUrl("task20_current_profile_id");
}

function getClientIp(request: NextRequest) {
  const forwardedFor =
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-vercel-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "127.0.0.1";
  }

  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

function maybeJwt(value: string | undefined) {
  const token = value?.trim();

  if (!token || !token.startsWith("eyJ")) {
    return null;
  }

  return token;
}

function tokenFromCookieValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const rawValue = decodeURIComponent(value);
  const directToken = maybeJwt(rawValue);

  if (directToken) {
    return directToken;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (Array.isArray(parsed)) {
      return maybeJwt(String(parsed[0] ?? ""));
    }

    if (parsed && typeof parsed === "object" && "access_token" in parsed) {
      return maybeJwt(String(parsed.access_token ?? ""));
    }
  } catch {
    return null;
  }

  return null;
}

function extractAccessToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return maybeJwt(authorization.slice("bearer ".length));
  }

  for (const cookie of request.cookies.getAll()) {
    const isSupabaseAuthCookie =
      cookie.name === "sb-access-token" ||
      cookie.name === "supabase-auth-token" ||
      (cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"));

    if (!isSupabaseAuthCookie) {
      continue;
    }

    const token = tokenFromCookieValue(cookie.value);
    if (token) {
      return token;
    }
  }

  return null;
}

async function resolveTask20ProfileId(request: NextRequest) {
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

  const profileId = (await response.json()) as unknown;

  return typeof profileId === "string" && profileId.trim() ? profileId : null;
}

async function task20RateLimitResponse(request: NextRequest) {
  if (!shouldApplyTask20RateLimit(request.nextUrl.pathname)) {
    return null;
  }

  let profileId: string | null = null;

  try {
    profileId = await resolveTask20ProfileId(request);
  } catch (error) {
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

export async function proxy(request: NextRequest) {
  const limited = await task20RateLimitResponse(request);

  if (limited) {
    return limited;
  }

  const match = request.nextUrl.pathname.match(publicProfilePattern);

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

  const data = (await response.json()) as { status?: string };

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
