import { describe, expect, it, vi } from "vitest";
import { createUpstashRateLimitStore } from "./upstash";

describe("createUpstashRateLimitStore", () => {
  it("uses the Upstash REST pipeline with INCR and EXPIRE NX", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify([{ result: 1 }, { result: 1 }]), { status: 200 }),
    );
    const store = createUpstashRateLimitStore(
      {
        UPSTASH_REDIS_REST_URL: "https://example-upstash.io/",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      fetchImpl as unknown as typeof fetch,
    );

    await expect(store.increment("rl:ip:203.0.113.8:29668114", 60)).resolves.toBe(1);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example-upstash.io/pipeline",
      expect.objectContaining({
        body: JSON.stringify([
          ["INCR", "rl:ip:203.0.113.8:29668114"],
          ["EXPIRE", "rl:ip:203.0.113.8:29668114", 60, "NX"],
        ]),
        method: "POST",
      }),
    );
  });

  it("throws when Upstash credentials are missing so the caller can fail-open", async () => {
    const store = createUpstashRateLimitStore({}, vi.fn() as unknown as typeof fetch);

    await expect(store.increment("rl:ip:missing:1", 60)).rejects.toThrow(
      "Upstash Redis REST credentials are not configured",
    );
  });
});
