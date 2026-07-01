function normalizeLimit(limit) {
    if (limit === undefined) {
        return 100;
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
        throw new Error("Task13 job runner limit must be an integer from 1 to 5000.");
    }
    return limit;
}
export async function runTask13DueJobs(client, options = {}) {
    const inputLimit = normalizeLimit(options.limit);
    const { data, error } = await client.rpc("process_task13_due_jobs", {
        input_limit: inputLimit,
    });
    if (error) {
        return {
            ok: false,
            message: error.message,
        };
    }
    if (!data) {
        return {
            ok: false,
            message: "process_task13_due_jobs returned no summary.",
        };
    }
    return {
        ok: true,
        summary: data,
    };
}
