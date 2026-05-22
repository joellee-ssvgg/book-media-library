import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { captureTask20OperationalAlert } from "../apps/web/lib/observability/sentry";

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

async function main() {
  loadDotEnvLocal();

  const result = await captureTask20OperationalAlert({
    code: "task20_rate_limit_store_error",
    message: "Task20 smoke alert: Sentry ingest verification.",
    scope: "ip",
    key: "rl:ip:task20-smoke",
  });

  if (result.status !== "sent") {
    throw new Error("Task20 Sentry smoke did not send because NEXT_PUBLIC_SENTRY_DSN is missing.");
  }

  console.log(`Task20 Sentry smoke accepted by ingest. event_id=${result.eventId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
