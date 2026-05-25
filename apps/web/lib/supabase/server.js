import { createClient } from "@supabase/supabase-js";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";
function createRpcClient(accessToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        return {
            error: "NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 必须配置后才能提交。",
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
            async rpc(fn, args) {
                const rpc = client.rpc.bind(client);
                const result = await rpc(fn, args);
                return {
                    data: result.data,
                    error: result.error,
                };
            },
        },
    };
}
export function createUserScopedSupabase(accessToken) {
    return createRpcClient(accessToken);
}
export async function createActionSupabase(accessToken) {
    const legacyAccessToken = accessToken?.trim();
    if (legacyAccessToken) {
        return createRpcClient(legacyAccessToken);
    }
    const supabase = await createCookieSupabaseClient();
    if ("error" in supabase) {
        return supabase;
    }
    const { data: { user }, error, } = await supabase.auth.getUser();
    if (error || !user) {
        return {
            error: "请先通过 GitHub 登录后再提交。",
        };
    }
    return {
        client: {
            async rpc(fn, args) {
                const result = await supabase.rpc(fn, args);
                return {
                    data: result.data,
                    error: result.error,
                };
            },
        },
    };
}
export function createAnonymousSupabase() {
    return createRpcClient();
}
