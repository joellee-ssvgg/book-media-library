import { NextResponse } from "next/server";
import { createRouteSupabaseClient, normalizeAuthNextPath, requestUrl } from "@/lib/supabase/auth";
export async function GET(request) {
    const authClient = createRouteSupabaseClient(request);
    if ("error" in authClient) {
        return new NextResponse(authClient.error, { status: 503 });
    }
    const next = normalizeAuthNextPath(request.nextUrl.searchParams.get("next"));
    const redirectTo = requestUrl("/auth/callback", request);
    redirectTo.searchParams.set("next", next);
    const { data, error } = await authClient.supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
            redirectTo: redirectTo.toString(),
        },
    });
    if (error || !data.url) {
        return new NextResponse(error?.message ?? "无法创建 GitHub OAuth 登录链接。", {
            status: 502,
        });
    }
    const response = NextResponse.redirect(data.url);
    authClient.applyToResponse(response);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}
