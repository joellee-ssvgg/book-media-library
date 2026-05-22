import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createTask20RateLimitKey,
  task20IpRateLimit,
  task20ProfileRateLimit,
} from "../apps/web/lib/rate-limit/config";
import { createUpstashRateLimitStore } from "../apps/web/lib/rate-limit/upstash";

function loadDotEnvLocal() {
  const envPath = resolve(".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] ??= value;
  }
}

async function assertFixedWindowBoundary(
  key: string,
  limit: number,
  windowSeconds: number,
  label: string,
) {
  const store = createUpstashRateLimitStore();

  await store.reset?.([key]);

  let count = 0;
  for (let i = 1; i <= limit; i += 1) {
    count = await store.increment(key, windowSeconds);
  }

  if (count !== limit) {
    throw new Error(`${label} expected count ${limit}, got ${count}`);
  }

  const rejectedCount = await store.increment(key, windowSeconds);

  if (rejectedCount !== limit + 1) {
    throw new Error(`${label} expected rejection boundary ${limit + 1}, got ${rejectedCount}`);
  }

  await store.reset?.([key]);
}

async function main() {
  loadDotEnvLocal();

  const now = new Date();
  const suffix = String(Date.now());
  const ipKey = createTask20RateLimitKey(task20IpRateLimit, `task20-smoke-ip-${suffix}`, now);
  const profileKey = createTask20RateLimitKey(
    task20ProfileRateLimit,
    `task20-smoke-profile-${suffix}`,
    now,
  );

  await assertFixedWindowBoundary(
    ipKey,
    task20IpRateLimit.limit,
    task20IpRateLimit.windowSeconds,
    "Task20 IP rate limit",
  );
  await assertFixedWindowBoundary(
    profileKey,
    task20ProfileRateLimit.limit,
    task20ProfileRateLimit.windowSeconds,
    "Task20 profile rate limit",
  );

  console.log("Task20 Upstash smoke passed: 20/min/IP and 1000/day/profile boundaries verified.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
