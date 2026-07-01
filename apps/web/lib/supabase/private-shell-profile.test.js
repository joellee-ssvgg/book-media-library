import { describe, expect, it } from "vitest";
import {
  buildFallbackUsername,
  ensurePrivateShellProfile,
  firstUsableProfile,
  usernameWithRetrySuffix,
} from "./private-shell-profile";

describe("firstUsableProfile", () => {
  it("selects the first row with a username", () => {
    expect(firstUsableProfile([{ username: "reader_1" }, { username: "reader_2" }])).toEqual({
      username: "reader_1",
    });
  });

  it("ignores missing or empty profile results", () => {
    expect(firstUsableProfile([])).toBeNull();
    expect(firstUsableProfile([{ username: "" }])).toBeNull();
    expect(firstUsableProfile(null)).toBeNull();
  });
});

function createProfileClient({ initialRows = [], insertResults = [], rpcResults = null } = {}) {
  const inserts = [];
  const rpcCalls = [];
  const selectResults = [{ data: initialRows, error: null }];
  let insertIndex = 0;
  let rpcIndex = 0;

  const selectChain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    order() {
      return this;
    },
    async limit() {
      return selectResults.shift() ?? { data: [], error: null };
    },
  };

  const insertChain = {
    select() {
      return this;
    },
    async single() {
      const payload = inserts.at(-1);
      return insertResults[insertIndex++] ?? { data: { username: payload?.username }, error: null };
    },
  };

  const client = {
    from() {
      return {
        select() {
          return selectChain;
        },
        insert(payload) {
          inserts.push(payload);
          return insertChain;
        },
      };
    },
  };

  if (Array.isArray(rpcResults)) {
    client.rpc = async (name) => {
      rpcCalls.push(name);
      return rpcResults[rpcIndex++] ?? { data: null, error: null };
    };
  }

  return {
    inserts,
    rpcCalls,
    client,
  };
}

describe("buildFallbackUsername", () => {
  it("normalizes metadata or email into the database username format", () => {
    expect(
      buildFallbackUsername({
        id: "00000000-0000-0000-0000-000000000000",
        email: "Reader.Name+Demo@example.com",
        user_metadata: {},
      }),
    ).toBe("reader_name_demo");
  });

  it("falls back to the auth user id when the candidate is not usable", () => {
    expect(
      buildFallbackUsername({
        id: "12345678-90ab-cdef-1234-567890abcdef",
        email: "李@example.com",
        user_metadata: {},
      }),
    ).toBe("user_1234567890ab");
  });

  it("keeps retry suffixes inside the 20 character username limit", () => {
    expect(usernameWithRetrySuffix("abcdefghijklmnopqrst", 12)).toBe("abcdefghijklmnopq_12");
  });
});

describe("ensurePrivateShellProfile", () => {
  it("uses the database RPC when it is available", async () => {
    const { client, inserts, rpcCalls } = createProfileClient({
      rpcResults: [{ data: { username: "reader_rpc", status: "active" }, error: null }],
    });

    await expect(
      ensurePrivateShellProfile(client, {
        id: "user-id",
        email: "reader@example.com",
        user_metadata: {},
      }),
    ).resolves.toEqual({ username: "reader_rpc", status: "active" });
    expect(rpcCalls).toEqual(["task22_ensure_current_profile"]);
    expect(inserts).toHaveLength(0);
  });

  it("falls back when the database RPC has not been migrated yet", async () => {
    const missingRpc = {
      code: "42883",
      message: "Could not find the function public.task22_ensure_current_profile without parameters",
    };
    const { client, inserts } = createProfileClient({
      initialRows: [{ username: "reader_fallback" }],
      rpcResults: [{ data: null, error: missingRpc }],
    });

    await expect(
      ensurePrivateShellProfile(client, {
        id: "user-id",
        email: "reader@example.com",
        user_metadata: {},
      }),
    ).resolves.toEqual({ username: "reader_fallback" });
    expect(inserts).toHaveLength(0);
  });

  it("returns an existing profile without inserting", async () => {
    const { client, inserts } = createProfileClient({
      initialRows: [{ username: "reader_1" }],
    });

    await expect(
      ensurePrivateShellProfile(client, {
        id: "user-id",
        email: "reader@example.com",
        user_metadata: {},
      }),
    ).resolves.toEqual({ username: "reader_1" });
    expect(inserts).toHaveLength(0);
  });

  it("creates a profile when auth exists but the profile row is missing", async () => {
    const { client, inserts } = createProfileClient({
      initialRows: [],
    });

    await expect(
      ensurePrivateShellProfile(client, {
        id: "12345678-90ab-cdef-1234-567890abcdef",
        email: "reader@example.com",
        user_metadata: { name: "Reader Demo", avatar_url: "https://example.com/avatar.png" },
      }),
    ).resolves.toEqual({ username: "reader" });
    expect(inserts).toEqual([
      {
        auth_user_id: "12345678-90ab-cdef-1234-567890abcdef",
        username: "reader",
        display_name: "Reader Demo",
        avatar_url: "https://example.com/avatar.png",
      },
    ]);
  });

  it("retries when the generated username already exists", async () => {
    const duplicateUsername = {
      code: "23505",
      message: "duplicate key value violates unique constraint \"profiles_username_lower_key\"",
    };
    const { client, inserts } = createProfileClient({
      initialRows: [],
      insertResults: [
        { data: null, error: duplicateUsername },
        { data: { username: "reader_1" }, error: null },
      ],
    });

    await expect(
      ensurePrivateShellProfile(client, {
        id: "12345678-90ab-cdef-1234-567890abcdef",
        email: "reader@example.com",
        user_metadata: {},
      }),
    ).resolves.toEqual({ username: "reader_1" });
    expect(inserts.map((payload) => payload.username)).toEqual(["reader", "reader_1"]);
  });

  it("does not surface raw auth_user_id unique conflicts", async () => {
    const duplicateAuthUserId = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "profiles_auth_user_id_key"',
    };
    const { client } = createProfileClient({
      initialRows: [],
      insertResults: [{ data: null, error: duplicateAuthUserId }],
    });

    await expect(
      ensurePrivateShellProfile(client, {
        id: "12345678-90ab-cdef-1234-567890abcdef",
        email: "reader@example.com",
        user_metadata: {},
      }),
    ).rejects.toThrow("账号已有不可用的用户资料");
  });
});
