export const task20IpRateLimit = {
    scope: "ip",
    keyPrefix: "rl:ip",
    limit: 20,
    windowSeconds: 60,
};
// Page navigations count against a separate, looser bucket: Next.js prefetches
// links aggressively, so the strict API budget would lock out normal browsing.
export const task20IpPageRateLimit = {
    scope: "ip",
    keyPrefix: "rl:ip:nav",
    limit: 120,
    windowSeconds: 60,
};
export const task20ProfileRateLimit = {
    scope: "profile",
    keyPrefix: "rl:profile",
    limit: 1000,
    windowSeconds: 60 * 60 * 24,
};
export const task20RateLimitRules = {
    ip: task20IpRateLimit,
    ipPage: task20IpPageRateLimit,
    profile: task20ProfileRateLimit,
};
const strictIpPathPattern = /^\/(api|auth)(\/|$)/;
export function ipRateLimitForPath(pathname) {
    return strictIpPathPattern.test(pathname) ? task20IpRateLimit : task20IpPageRateLimit;
}
const staticAssetPattern = /\.(?:css|js|mjs|map|svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|woff|woff2)$/i;
export function shouldApplyTask20RateLimit(pathname) {
    if (pathname.startsWith("/_next/")
        || pathname === "/favicon.ico"
        || pathname === "/manifest.webmanifest"
        || pathname === "/sw.js"
        || pathname === "/pwa-icon.svg"
        || pathname === "/robots.txt") {
        return false;
    }
    return !staticAssetPattern.test(pathname);
}
function normalizeIdentifier(identifier) {
    return identifier.trim().replace(/[^a-zA-Z0-9_.:-]/g, "_");
}
function bucketForRule(rule, now) {
    if (rule.scope === "ip") {
        return Math.floor(now.getTime() / 60_000).toString();
    }
    return now.toISOString().slice(0, 10).replaceAll("-", "");
}
export function createTask20RateLimitKey(rule, identifier, now = new Date()) {
    return `${rule.keyPrefix}:${normalizeIdentifier(identifier)}:${bucketForRule(rule, now)}`;
}
export function task20RateLimitResetAt(rule, now = new Date()) {
    return new Date(now.getTime() + rule.windowSeconds * 1000);
}
