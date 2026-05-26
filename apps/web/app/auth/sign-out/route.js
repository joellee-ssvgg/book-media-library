import { NextResponse } from "next/server";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

async function handleSignOut(request) {
    const supabase = await createCookieSupabaseClient();
    if ("error" in supabase) {
        return new NextResponse(supabase.error, { status: 503 });
    }
    await supabase.auth.signOut();
    const response = NextResponse.redirect(new URL("/auth/sign-in", request.url), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}

export const GET = handleSignOut;
export const POST = handleSignOut;
