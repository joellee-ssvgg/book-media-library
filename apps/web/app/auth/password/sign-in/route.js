import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAuthConfig, normalizeAuthNextPath } from "@/lib/supabase/auth";

export async function POST(request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = normalizeAuthNextPath(formData.get("next"));

  if (!email || !password) {
    const url = new URL("/auth/sign-in", request.url);
    url.searchParams.set("error", "请输入邮箱和密码。");
    if (next !== "/dashboard") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  const config = getSupabaseAuthConfig();
  if ("error" in config) {
    const url = new URL("/auth/sign-in", request.url);
    url.searchParams.set("error", config.error);
    if (next !== "/dashboard") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.redirect(new URL(next, request.url));

  const supabase = createServerClient(config.url, config.anonKey, {
    auth: { flowType: "pkce" },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, { ...options, path: "/" });
        }
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.message === "Invalid login credentials"
        ? "邮箱或密码不正确。"
        : error.message === "Email not confirmed"
          ? "请先到邮箱完成确认后再登录。"
          : error.message;
    const url = new URL("/auth/sign-in", request.url);
    url.searchParams.set("error", message);
    if (next !== "/dashboard") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
