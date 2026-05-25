function createEventId() {
    return crypto.randomUUID().replaceAll("-", "");
}
function parseDsn(dsn) {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace(/^\//, "").split("/").at(-1);
    if (!publicKey || !projectId) {
        throw new Error("Sentry DSN is invalid");
    }
    return {
        envelopeUrl: `${parsed.origin}/api/${projectId}/envelope/`,
        projectId,
        publicKey,
    };
}
export async function captureTask20OperationalAlert(alert, { env = process.env, fetchImpl = fetch, now = new Date(), } = {}) {
    const dsn = env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) {
        return {
            status: "skipped",
            reason: "missing_dsn",
        };
    }
    const eventId = createEventId();
    const sentryDsn = parseDsn(dsn);
    const timestamp = now.toISOString();
    const event = {
        event_id: eventId,
        timestamp,
        platform: "javascript",
        logger: "task20.rate_limit",
        level: alert.code === "task20_rate_limit_store_error" ? "warning" : "error",
        message: alert.message,
        environment: env.VERCEL_ENV ?? env.NODE_ENV ?? "development",
        tags: {
            task: "20",
            code: alert.code,
            scope: alert.scope ?? "unknown",
        },
        extra: {
            key: alert.key,
        },
    };
    const envelope = [
        JSON.stringify({ event_id: eventId, dsn, sent_at: timestamp }),
        JSON.stringify({ type: "event", content_type: "application/json" }),
        JSON.stringify(event),
    ].join("\n");
    const response = await fetchImpl(sentryDsn.envelopeUrl, {
        body: envelope,
        headers: {
            "Content-Type": "application/x-sentry-envelope",
            "X-Sentry-Auth": [
                "Sentry sentry_version=7",
                `sentry_client=book-media-library-task20/1.0`,
                `sentry_key=${sentryDsn.publicKey}`,
            ].join(", "),
        },
        method: "POST",
    });
    if (!response.ok) {
        throw new Error(`Sentry envelope request failed with ${response.status}`);
    }
    return {
        status: "sent",
        eventId,
    };
}
