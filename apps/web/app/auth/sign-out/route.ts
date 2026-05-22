import { NextResponse } from "next/server";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const supabase = await createCookieSupabaseClient();

  if ("error" in supabase) {
    return new NextResponse(supabase.error, { status: 503 });
  }

  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}
