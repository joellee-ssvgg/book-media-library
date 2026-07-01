import { describe, expect, it, vi } from "vitest";
import { createTask20RateLimitKey, ipRateLimitForPath, shouldApplyTask20RateLimit, task20IpPageRateLimit, task20IpRateLimit, task20ProfileRateLimit, } from "./config";
import { evaluateTask20RateLimit } from "./store";
function createMemoryStore() {
    const counts = new Map();
    return {
        async increment(key) {
            const next = (counts.get(key) ?? 0) + 1;
            counts.set(key, next);
            return next;
        },
        async reset(keys) {
            for (const key of keys) {
                counts.delete(key);
            }
        },
    };
}
describe("Task20 rate limit", () => {
    const now = new Date("2026-05-22T12:34:20.000Z");
    it("uses the required Redis key shapes", () => {
        expect(createTask20RateLimitKey(task20IpRateLimit, "203.0.113.8", now)).toBe("rl:ip:203.0.113.8:29657554");
        expect(createTask20RateLimitKey(task20ProfileRateLimit, "00000000-0000-0000-0000-00000000aa20", now)).toBe("rl:profile:00000000-0000-0000-0000-00000000aa20:20260522");
    });
    it("allows exactly 20 requests per minute for an IP and rejects the 21st", async () => {
        const store = createMemoryStore();
        let decision = await evaluateTask20RateLimit({
            ip: "203.0.113.8",
            now,
            store,
        });
        for (let i = 2; i <= 20; i += 1) {
            decision = await evaluateTask20RateLimit({
                ip: "203.0.113.8",
                now,
                store,
            });
        }
        expect(decision.allowed).toBe(true);
        expect(decision.count).toBe(20);
        const rejected = await evaluateTask20RateLimit({
            ip: "203.0.113.8",
            now,
            store,
        });
        expect(rejected.allowed).toBe(false);
        expect(rejected.scope).toBe("ip");
        expect(rejected.count).toBe(21);
        expect(rejected.retryAfterSeconds).toBe(60);
    });
    it("allows exactly 1000 requests per day for a profile and rejects the 1001st", async () => {
        const store = createMemoryStore();
        let decision = await evaluateTask20RateLimit({
            ip: "203.0.113.9",
            now,
            profileId: "00000000-0000-0000-0000-00000000aa20",
            store,
        });
        for (let i = 2; i <= 1000; i += 1) {
            decision = await evaluateTask20RateLimit({
                ip: `203.0.113.${i}`,
                now,
                profileId: "00000000-0000-0000-0000-00000000aa20",
                store,
            });
        }
        expect(decision.allowed).toBe(true);
        expect(decision.count).toBe(1000);
        const rejected = await evaluateTask20RateLimit({
            ip: "203.0.113.250",
            now,
            profileId: "00000000-0000-0000-0000-00000000aa20",
            store,
        });
        expect(rejected.allowed).toBe(false);
        expect(rejected.scope).toBe("profile");
        expect(rejected.count).toBe(1001);
    });
    it("fails open and alerts when the Upstash store is unavailable", async () => {
        const alert = vi.fn(async () => undefined);
        const store = {
            async increment() {
                throw new Error("redis unavailable");
            },
        };
        const decision = await evaluateTask20RateLimit({
            ip: "203.0.113.10",
            now,
            store,
            alert,
        });
        expect(decision.allowed).toBe(true);
        expect(decision.failOpen).toBe(true);
        expect(alert).toHaveBeenCalledWith(expect.objectContaining({
            code: "task20_rate_limit_store_error",
            scope: "ip",
        }));
    });
    it("does not rate limit static PWA and Next.js assets", () => {
        expect(shouldApplyTask20RateLimit("/")).toBe(true);
        expect(shouldApplyTask20RateLimit("/u/task20_owner")).toBe(true);
        expect(shouldApplyTask20RateLimit("/manifest.webmanifest")).toBe(false);
        expect(shouldApplyTask20RateLimit("/sw.js")).toBe(false);
        expect(shouldApplyTask20RateLimit("/pwa-icon.svg")).toBe(false);
        expect(shouldApplyTask20RateLimit("/_next/static/chunks/app.js")).toBe(false);
    });
    it("keeps the strict IP budget for API and auth endpoints only", () => {
        expect(ipRateLimitForPath("/api/search")).toBe(task20IpRateLimit);
        expect(ipRateLimitForPath("/api/add-entry")).toBe(task20IpRateLimit);
        expect(ipRateLimitForPath("/auth/sign-in")).toBe(task20IpRateLimit);
        expect(ipRateLimitForPath("/dashboard")).toBe(task20IpPageRateLimit);
        expect(ipRateLimitForPath("/")).toBe(task20IpPageRateLimit);
        expect(ipRateLimitForPath("/u/reader_1")).toBe(task20IpPageRateLimit);
    });
    it("counts page navigations against a separate looser bucket than API calls", async () => {
        const store = createMemoryStore();
        for (let i = 1; i <= 21; i += 1) {
            await evaluateTask20RateLimit({
                ip: "203.0.113.8",
                now,
                store,
                ipRule: task20IpPageRateLimit,
            });
        }
        const pageDecision = await evaluateTask20RateLimit({
            ip: "203.0.113.8",
            now,
            store,
            ipRule: task20IpPageRateLimit,
        });
        expect(pageDecision.allowed).toBe(true);
        expect(pageDecision.count).toBe(22);
        const apiDecision = await evaluateTask20RateLimit({
            ip: "203.0.113.8",
            now,
            store,
            ipRule: task20IpRateLimit,
        });
        expect(apiDecision.allowed).toBe(true);
        expect(apiDecision.count).toBe(1);
    });
    it("rejects the 121st page navigation in a minute", async () => {
        const store = createMemoryStore();
        let decision;
        for (let i = 1; i <= 120; i += 1) {
            decision = await evaluateTask20RateLimit({
                ip: "203.0.113.8",
                now,
                store,
                ipRule: task20IpPageRateLimit,
            });
        }
        expect(decision.allowed).toBe(true);
        const rejected = await evaluateTask20RateLimit({
            ip: "203.0.113.8",
            now,
            store,
            ipRule: task20IpPageRateLimit,
        });
        expect(rejected.allowed).toBe(false);
        expect(rejected.scope).toBe("ip");
        expect(rejected.count).toBe(121);
    });
});
