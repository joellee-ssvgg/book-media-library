import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type SupabaseAuthConfig =
  | {
      anonKey: string;
      url: string;
    }
  | {
      error: string;
    };

export function getSupabaseAuthConfig(): SupabaseAuthConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      error: "NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 必须配置后才能登录。",
    };
  }

  return { anonKey, url };
}

export function normalizeAuthNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/onboarding";
  }

  return value;
}

export async function createCookieSupabaseClient() {
  const config = getSupabaseAuthConfig();

  if ("error" in config) {
    return config;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    auth: {
      flowType: "pkce",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, {
            ...options,
            path: options.path ?? "/",
          });
        });
      },
    },
  });
}
