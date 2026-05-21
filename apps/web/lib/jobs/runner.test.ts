import { describe, expect, it } from "vitest";

import { runTask13DueJobs, type JobRunnerRpcClient } from "./runner";

const emptySummary = {
  import_jobs: { processed: 0, done: 0, dead_letter: 0, locked: false },
  export_jobs: { processed: 0, done: 0, dead_letter: 0, locked: false },
  cover_cache_jobs: { processed: 0, done: 0, dead_letter: 0, locked: false },
  events_visibility_sync_jobs: { processed: 0, done: 0, dead_letter: 0, locked: false },
};

describe("runTask13DueJobs", () => {
  it("calls the Task13 due-jobs RPC with the normalized limit", async () => {
    const calls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
    const client: JobRunnerRpcClient = {
      async rpc<T>(fn: string, args?: Record<string, unknown>) {
        calls.push({ fn, args });
        return { data: emptySummary as T, error: null };
      },
    };

    const result = await runTask13DueJobs(client, { limit: 25 });

    expect(result).toEqual({ ok: true, summary: emptySummary });
    expect(calls).toEqual([
      {
        fn: "process_task13_due_jobs",
        args: { input_limit: 25 },
      },
    ]);
  });

  it("uses the database default batch size when no limit is provided", async () => {
    const calls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
    const client: JobRunnerRpcClient = {
      async rpc<T>(fn: string, args?: Record<string, unknown>) {
        calls.push({ fn, args });
        return { data: emptySummary as T, error: null };
      },
    };

    await runTask13DueJobs(client);

    expect(calls[0]).toEqual({
      fn: "process_task13_due_jobs",
      args: { input_limit: 100 },
    });
  });

  it("returns RPC errors without throwing", async () => {
    const client: JobRunnerRpcClient = {
      async rpc() {
        return { data: null, error: { message: "service role required" } };
      },
    };

    await expect(runTask13DueJobs(client)).resolves.toEqual({
      ok: false,
      message: "service role required",
    });
  });

  it("rejects unsafe batch sizes before calling the database", async () => {
    const client: JobRunnerRpcClient = {
      async rpc() {
        throw new Error("rpc should not be called");
      },
    };

    await expect(runTask13DueJobs(client, { limit: 0 })).rejects.toThrow(
      "Task13 job runner limit must be an integer from 1 to 5000.",
    );
  });
});
