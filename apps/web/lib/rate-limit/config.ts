export type Task20RateLimitScope = "ip" | "profile";

export type Task20RateLimitRule = {
  scope: Task20RateLimitScope;
  keyPrefix: string;
  limit: number;
  windowSeconds: number;
};

export const task20IpRateLimit: Task20RateLimitRule = {
  scope: "ip",
  keyPrefix: "rl:ip",
  limit: 20,
  windowSeconds: 60,
};

export const task20ProfileRateLimit: Task20RateLimitRule = {
  scope: "profile",
  keyPrefix: "rl:profile",
  limit: 1000,
  windowSeconds: 60 * 60 * 24,
};

export const task20RateLimitRules = {
  ip: task20IpRateLimit,
  profile: task20ProfileRateLimit,
} as const;

const staticAssetPattern =
  /\.(?:css|js|mjs|map|svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|woff|woff2)$/i;

export function shouldApplyTask20RateLimit(pathname: string) {
  if (
    pathname.startsWith("/_next/")
    || pathname === "/favicon.ico"
    || pathname === "/manifest.webmanifest"
    || pathname === "/sw.js"
    || pathname === "/pwa-icon.svg"
    || pathname === "/robots.txt"
  ) {
    return false;
  }

  return !staticAssetPattern.test(pathname);
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().replace(/[^a-zA-Z0-9_.:-]/g, "_");
}

function bucketForRule(rule: Task20RateLimitRule, now: Date) {
  if (rule.scope === "ip") {
    return Math.floor(now.getTime() / 60_000).toString();
  }

  return now.toISOString().slice(0, 10).replaceAll("-", "");
}

export function createTask20RateLimitKey(
  rule: Task20RateLimitRule,
  identifier: string,
  now = new Date(),
) {
  return `${rule.keyPrefix}:${normalizeIdentifier(identifier)}:${bucketForRule(rule, now)}`;
}

export function task20RateLimitResetAt(rule: Task20RateLimitRule, now = new Date()) {
  return new Date(now.getTime() + rule.windowSeconds * 1000);
}
