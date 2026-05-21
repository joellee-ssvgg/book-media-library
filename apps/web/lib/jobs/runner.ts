export type Task13JobQueueName =
  | "import_jobs"
  | "export_jobs"
  | "cover_cache_jobs"
  | "events_visibility_sync_jobs";

export type Task13QueueSummary = {
  processed: number;
  done: number;
  dead_letter: number;
  locked: boolean;
};

export type Task13DueJobsSummary = Record<Task13JobQueueName, Task13QueueSummary>;

export type JobRunnerRpcClient = {
  rpc<T = unknown>(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

export type JobRunnerResult =
  | {
      ok: true;
      summary: Task13DueJobsSummary;
    }
  | {
      ok: false;
      message: string;
    };

function normalizeLimit(limit: number | undefined) {
  if (limit === undefined) {
    return 100;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
    throw new Error("Task13 job runner limit must be an integer from 1 to 5000.");
  }

  return limit;
}

export async function runTask13DueJobs(
  client: JobRunnerRpcClient,
  options: { limit?: number } = {},
): Promise<JobRunnerResult> {
  const inputLimit = normalizeLimit(options.limit);

  const { data, error } = await client.rpc<Task13DueJobsSummary>("process_task13_due_jobs", {
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
