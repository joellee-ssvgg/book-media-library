import { NextResponse } from "next/server";
import { createRouteSupabaseClient, normalizeAuthNextPath, requestUrl } from "@/lib/supabase/auth";

const ALLOWED_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request) {
  const authClient = createRouteSupabaseClient(request);
  if ("error" in authClient) {
    return new NextResponse(authClient.error, { status: 503 });
  }

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = normalizeAuthNextPath(request.nextUrl.searchParams.get("next"));

  if (!tokenHash || !type || !ALLOWED_TYPES.has(type)) {
    return new NextResponse("邮件确认链接缺少必要参数或参数无效。", { status: 400 });
  }

  const { error } = await authClient.supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return new NextResponse(error.message, { status: 502 });
  }

  const response = NextResponse.redirect(requestUrl(next, request));
  authClient.applyToResponse(response);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
