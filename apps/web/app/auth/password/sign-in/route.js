import { NextResponse } from "next/server";
import { createRouteSupabaseClient, normalizeAuthNextPath, requestUrl } from "@/lib/supabase/auth";

export async function POST(request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = normalizeAuthNextPath(formData.get("next"));

  if (!email || !password) {
    const url = requestUrl("/auth/sign-in", request);
    url.searchParams.set("error", "请输入邮箱和密码。");
    if (next !== "/dashboard") url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const authClient = createRouteSupabaseClient(request);
  if ("error" in authClient) {
    const url = requestUrl("/auth/sign-in", request);
    url.searchParams.set("error", authClient.error);
    if (next !== "/dashboard") url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const { error } = await authClient.supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.message === "Invalid login credentials"
        ? "邮箱或密码不正确。"
        : error.message === "Email not confirmed"
          ? "请先到邮箱完成确认后再登录。"
          : error.message;
    const url = requestUrl("/auth/sign-in", request);
    url.searchParams.set("error", message);
    if (next !== "/dashboard") url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(requestUrl(next, request), 303);
  authClient.applyToResponse(response);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
