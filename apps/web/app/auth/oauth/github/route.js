import { NextResponse } from "next/server";
import { createCookieSupabaseClient, normalizeAuthNextPath } from "@/lib/supabase/auth";
export async function GET(request) {
    const supabase = await createCookieSupabaseClient();
    if ("error" in supabase) {
        return new NextResponse(supabase.error, { status: 503 });
    }
    const origin = request.nextUrl.origin;
    const next = normalizeAuthNextPath(request.nextUrl.searchParams.get("next"));
    const redirectTo = new URL("/auth/callback", origin);
    redirectTo.searchParams.set("next", next);
    const { data, error } = await supabase.auth.signInWithOAuth({
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
    return NextResponse.redirect(data.url);
}
