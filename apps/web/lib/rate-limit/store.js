import { createTask20RateLimitKey, task20IpRateLimit, task20ProfileRateLimit, task20RateLimitResetAt, } from "./config";
async function safeAlert(alert, payload) {
    if (!alert) {
        return;
    }
    try {
        await alert(payload);
    }
    catch {
        // Task20 requires Redis failures to fail-open. Alert delivery cannot become a request blocker.
    }
}
async function checkRule({ identifier, now, rule, store, alert, }) {
    const key = createTask20RateLimitKey(rule, identifier, now);
    const resetAt = task20RateLimitResetAt(rule, now);
    try {
        const count = await store.increment(key, rule.windowSeconds);
        const remaining = Math.max(rule.limit - count, 0);
        if (count > rule.limit) {
            return {
                allowed: false,
                failOpen: false,
                scope: rule.scope,
                key,
                count,
                limit: rule.limit,
                remaining,
                resetAt,
                retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
            };
        }
        return {
            allowed: true,
            failOpen: false,
            scope: rule.scope,
            key,
            count,
            limit: rule.limit,
            remaining,
            resetAt,
        };
    }
    catch (error) {
        await safeAlert(alert, {
            code: "task20_rate_limit_store_error",
            message: error instanceof Error ? error.message : "Task20 rate limit store failed",
            scope: rule.scope,
            key,
        });
        return {
            allowed: true,
            failOpen: true,
            scope: rule.scope,
            key,
            limit: rule.limit,
            resetAt,
        };
    }
}
export async function evaluateTask20RateLimit({ ip, profileId, now = new Date(), store, alert, ipRule = task20IpRateLimit, }) {
    const ipDecision = await checkRule({
        identifier: ip,
        now,
        rule: ipRule,
        store,
        alert,
    });
    if (!ipDecision.allowed) {
        return ipDecision;
    }
    if (!profileId) {
        return ipDecision;
    }
    return checkRule({
        identifier: profileId,
        now,
        rule: task20ProfileRateLimit,
        store,
        alert,
    });
}
