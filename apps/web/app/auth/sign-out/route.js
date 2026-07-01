import { NextResponse } from "next/server";
import { createRouteSupabaseClient, requestUrl } from "@/lib/supabase/auth";

async function handleSignOut(request) {
    const authClient = createRouteSupabaseClient(request);
    if ("error" in authClient) {
        return new NextResponse(authClient.error, { status: 503 });
    }
    await authClient.supabase.auth.signOut();
    const response = NextResponse.redirect(requestUrl("/auth/sign-in", request), 303);
    authClient.applyToResponse(response);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}

export const GET = handleSignOut;
export const POST = handleSignOut;
