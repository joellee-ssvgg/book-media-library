import type { Task20RateLimitStore } from "./store";

type UpstashPipelineResult = Array<{
  result?: unknown;
  error?: string;
}>;

type UpstashEnv = {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
};

function defaultUpstashEnv(): UpstashEnv {
  return {
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  };
}

function normalizeRestUrl(url: string) {
  return url.replace(/\/$/, "");
}

function readResultCount(payload: UpstashPipelineResult) {
  const first = payload[0];

  if (!first || first.error) {
    throw new Error(first?.error ?? "Upstash INCR response is missing");
  }

  const count = Number(first.result);

  if (!Number.isFinite(count)) {
    throw new Error("Upstash INCR response is not numeric");
  }

  return count;
}

export function createUpstashRateLimitStore(
  env: UpstashEnv = defaultUpstashEnv(),
  fetchImpl: typeof fetch = fetch,
): Task20RateLimitStore {
  const restUrl = env.UPSTASH_REDIS_REST_URL;
  const restToken = env.UPSTASH_REDIS_REST_TOKEN;

  async function pipeline(commands: unknown[][]) {
    if (!restUrl || !restToken) {
      throw new Error("Upstash Redis REST credentials are not configured");
    }

    const response = await fetchImpl(`${normalizeRestUrl(restUrl)}/pipeline`, {
      body: JSON.stringify(commands),
      headers: {
        Authorization: `Bearer ${restToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Upstash Redis REST request failed with ${response.status}`);
    }

    return (await response.json()) as UpstashPipelineResult;
  }

  return {
    async increment(key, windowSeconds) {
      const payload = await pipeline([
        ["INCR", key],
        ["EXPIRE", key, windowSeconds, "NX"],
      ]);

      return readResultCount(payload);
    },
    async reset(keys) {
      if (keys.length === 0) {
        return;
      }

      await pipeline([["DEL", ...keys]]);
    },
  };
}
