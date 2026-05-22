import {
  createTask20RateLimitKey,
  task20IpRateLimit,
  task20ProfileRateLimit,
  task20RateLimitResetAt,
  type Task20RateLimitRule,
  type Task20RateLimitScope,
} from "./config";

export type Task20RateLimitDecision = {
  allowed: boolean;
  failOpen: boolean;
  scope?: Task20RateLimitScope;
  key?: string;
  count?: number;
  limit?: number;
  remaining?: number;
  resetAt?: Date;
  retryAfterSeconds?: number;
};

export type Task20RateLimitAlert = {
  code: "task20_rate_limit_store_error" | "task20_profile_resolve_error";
  message: string;
  scope?: Task20RateLimitScope;
  key?: string;
};

export type Task20RateLimitAlertSink = (alert: Task20RateLimitAlert) => Promise<void>;

export type Task20RateLimitStore = {
  increment(key: string, windowSeconds: number): Promise<number>;
  reset?(keys: string[]): Promise<void>;
};

type CheckOptions = {
  identifier: string;
  now: Date;
  rule: Task20RateLimitRule;
  store: Task20RateLimitStore;
  alert?: Task20RateLimitAlertSink;
};

type EvaluateOptions = {
  ip: string;
  profileId?: string | null;
  now?: Date;
  store: Task20RateLimitStore;
  alert?: Task20RateLimitAlertSink;
};

async function safeAlert(alert: Task20RateLimitAlertSink | undefined, payload: Task20RateLimitAlert) {
  if (!alert) {
    return;
  }

  try {
    await alert(payload);
  } catch {
    // Task20 requires Redis failures to fail-open. Alert delivery cannot become a request blocker.
  }
}

async function checkRule({
  identifier,
  now,
  rule,
  store,
  alert,
}: CheckOptions): Promise<Task20RateLimitDecision> {
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
  } catch (error) {
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

export async function evaluateTask20RateLimit({
  ip,
  profileId,
  now = new Date(),
  store,
  alert,
}: EvaluateOptions): Promise<Task20RateLimitDecision> {
  const ipDecision = await checkRule({
    identifier: ip,
    now,
    rule: task20IpRateLimit,
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
