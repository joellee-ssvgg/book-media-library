import { NextResponse } from "next/server";
import { createCookieSupabaseClient, normalizeAuthNextPath } from "@/lib/supabase/auth";
export async function GET(request) {
    const supabase = await createCookieSupabaseClient();
    if ("error" in supabase) {
        return new NextResponse(supabase.error, { status: 503 });
    }
    const code = request.nextUrl.searchParams.get("code");
    const next = normalizeAuthNextPath(request.nextUrl.searchParams.get("next"));
    if (!code) {
        return new NextResponse("GitHub OAuth 回调缺少 code。", { status: 400 });
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        return new NextResponse(error.message, { status: 502 });
    }
    const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}
