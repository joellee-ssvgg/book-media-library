import { describe, expect, it, vi } from "vitest";
import { captureTask20OperationalAlert } from "./sentry";

describe("captureTask20OperationalAlert", () => {
  it("sends a Sentry envelope without exposing secrets in the payload", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));

    const result = await captureTask20OperationalAlert(
      {
        code: "task20_rate_limit_store_error",
        key: "rl:ip:203.0.113.8:29668114",
        message: "redis unavailable",
        scope: "ip",
      },
      {
        env: {
          NEXT_PUBLIC_SENTRY_DSN: "https://public-key@example.ingest.sentry.io/123456",
          NODE_ENV: "test",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
        now: new Date("2026-05-22T12:00:00.000Z"),
      },
    );

    expect(result.status).toBe("sent");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.ingest.sentry.io/api/123456/envelope/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/x-sentry-envelope",
        }),
      }),
    );

    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    const body = call?.[1].body;
    expect(String(body)).toContain('"logger":"task20.rate_limit"');
    expect(String(body)).toContain('"message":"redis unavailable"');
    expect(String(body)).not.toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("skips alert delivery when no Sentry DSN exists", async () => {
    const fetchImpl = vi.fn();

    await expect(
      captureTask20OperationalAlert(
        {
          code: "task20_profile_resolve_error",
          message: "missing profile",
        },
        {
          env: {},
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      ),
    ).resolves.toEqual({
      status: "skipped",
      reason: "missing_dsn",
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
