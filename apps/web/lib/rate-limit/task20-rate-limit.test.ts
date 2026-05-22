import { describe, expect, it, vi } from "vitest";
import {
  createTask20RateLimitKey,
  shouldApplyTask20RateLimit,
  task20IpRateLimit,
  task20ProfileRateLimit,
} from "./config";
import { evaluateTask20RateLimit, type Task20RateLimitStore } from "./store";

function createMemoryStore(): Task20RateLimitStore {
  const counts = new Map<string, number>();

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
    expect(createTask20RateLimitKey(task20IpRateLimit, "203.0.113.8", now)).toBe(
      "rl:ip:203.0.113.8:29657554",
    );
    expect(
      createTask20RateLimitKey(
        task20ProfileRateLimit,
        "00000000-0000-0000-0000-00000000aa20",
        now,
      ),
    ).toBe("rl:profile:00000000-0000-0000-0000-00000000aa20:20260522");
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
    const store: Task20RateLimitStore = {
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
    expect(alert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "task20_rate_limit_store_error",
        scope: "ip",
      }),
    );
  });

  it("does not rate limit static PWA and Next.js assets", () => {
    expect(shouldApplyTask20RateLimit("/")).toBe(true);
    expect(shouldApplyTask20RateLimit("/u/task20_owner")).toBe(true);
    expect(shouldApplyTask20RateLimit("/manifest.webmanifest")).toBe(false);
    expect(shouldApplyTask20RateLimit("/sw.js")).toBe(false);
    expect(shouldApplyTask20RateLimit("/pwa-icon.svg")).toBe(false);
    expect(shouldApplyTask20RateLimit("/_next/static/chunks/app.js")).toBe(false);
  });
});
