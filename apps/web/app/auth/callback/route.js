import { NextResponse } from "next/server";
import { createRouteSupabaseClient, normalizeAuthNextPath, requestUrl } from "@/lib/supabase/auth";
export async function GET(request) {
    const authClient = createRouteSupabaseClient(request);
    if ("error" in authClient) {
        return new NextResponse(authClient.error, { status: 503 });
    }
    const code = request.nextUrl.searchParams.get("code");
    const next = normalizeAuthNextPath(request.nextUrl.searchParams.get("next"));
    if (!code) {
        return new NextResponse("GitHub OAuth 回调缺少 code。", { status: 400 });
    }
    const { error } = await authClient.supabase.auth.exchangeCodeForSession(code);
    if (error) {
        return new NextResponse(error.message, { status: 502 });
    }
    const response = NextResponse.redirect(requestUrl(next, request));
    authClient.applyToResponse(response);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}
