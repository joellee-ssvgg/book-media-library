# Task20 PWA and Upstash Rate Limit Runbook

Task20 implements the P0 PWA shell and the two-layer abuse guard from product plan v6 and ADR-028/030/035.

## Source Requirements

- `P0 任务清单`: Task20 requires `manifest.webmanifest`, a basic service worker that caches static assets only, Vercel Edge rate limiting with `rl:ip:` and `rl:profile:`, fail-open plus Sentry, and SLO alert thresholds.
- `个人书影库平台产品方案 v6` §7.4: P0 offline support is browse-only. Writes stay online-only.
- `个人书影库平台产品方案 v6` §8.2: `rl:ip:{ip}:{minute_bucket}` allows 20 requests per minute, and `rl:profile:{profile_id}:{day_bucket}` allows 1000 requests per day.
- `ADR 48 条快查索引`: ADR-030 requires alert threshold rows across business, reliability, abuse, and cost panels.

## Runtime Behavior

- `apps/web/public/manifest.webmanifest` exposes the installable app metadata.
- `apps/web/public/sw.js` caches static assets and `/_next/static/*` only. It does not cache navigation documents or form submissions.
- `apps/web/components/domain/pwa-runtime.tsx` registers the service worker in the browser.
- `apps/web/proxy.ts` enforces the IP limit for non-static requests.
- If a bearer token or Supabase auth cookie is present, `proxy.ts` resolves the current profile through `task20_current_profile_id()` and applies the profile daily limit.
- If Upstash is unavailable, requests fail open and `captureTask20OperationalAlert()` sends a Sentry warning.

## Database

`slo_alert_thresholds` stores P0 SLO and alert threshold configuration:

- abuse: IP and profile rate limits;
- business: add-work latency and public profile TTFB;
- reliability: private note leakage, monthly availability, event outbox backlog, and RLS pgTAP failures;
- cost: provider quota monthly usage.

The table has forced RLS, public read access for enabled thresholds, and no direct write grants for `anon` or `authenticated`.

## Verification

Run the full local gate:

```bash
pnpm task20:check
```

Run external service smoke checks only when `.env.local` contains real Upstash and Sentry values:

```bash
pnpm task20:rate-limit:smoke
pnpm task20:sentry:smoke
```

Expected evidence:

- local unit tests prove the 20/min/IP and 1000/day/profile boundaries;
- `task20:rate-limit:smoke` proves the same boundaries against the configured Upstash REST instance and deletes its smoke keys;
- `task20:sentry:smoke` returns an accepted Sentry event id;
- `supabase test db test/rls` includes `task20_pwa_upstash_rate_limit.sql`;
- browser inspection shows `/manifest.webmanifest` and `/sw.js` are reachable.
