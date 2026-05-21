import { createClient } from "@supabase/supabase-js";

export type UserScopedSupabaseClient = {
  rpc<T = unknown>(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

export type AnonymousSupabaseClient = UserScopedSupabaseClient;

type UserScopedSupabaseResult =
  | {
      client: UserScopedSupabaseClient;
    }
  | {
      error: string;
    };

type AnonymousSupabaseResult =
  | {
      client: AnonymousSupabaseClient;
    }
  | {
      error: string;
    };

function createRpcClient(accessToken?: string): UserScopedSupabaseResult {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error:
        "NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 必须配置后才能提交。",
    };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    ...(accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      : {}),
  });

  return {
    client: {
      async rpc<T = unknown>(fn: string, args?: Record<string, unknown>) {
        const rpc = client.rpc.bind(client) as unknown as (
          rpcFn: string,
          rpcArgs?: Record<string, unknown>,
        ) => PromiseLike<{
          data: unknown;
          error: { message: string } | null;
        }>;

        const result = await rpc(fn, args);

        return {
          data: result.data as T | null,
          error: result.error,
        };
      },
    },
  };
}

export function createUserScopedSupabase(accessToken: string): UserScopedSupabaseResult {
  return createRpcClient(accessToken);
}

export function createAnonymousSupabase(): AnonymousSupabaseResult {
  return createRpcClient();
}
