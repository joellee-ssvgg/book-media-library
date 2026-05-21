import { NextResponse, type NextRequest } from "next/server";

const publicProfilePattern = /^\/u\/([^/]+)$/;

function supabaseRpcUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/task17_public_profile_state`;
}

export async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(publicProfilePattern);

  if (!match) {
    return NextResponse.next();
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rpcUrl = supabaseRpcUrl();

  if (!anonKey || !rpcUrl) {
    return new NextResponse("Supabase public config is missing", { status: 503 });
  }

  const response = await fetch(rpcUrl, {
    body: JSON.stringify({ input_username: decodeURIComponent(match[1]) }),
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    return new NextResponse("Public profile lookup failed", { status: 503 });
  }

  const data = (await response.json()) as { status?: string };

  if (data.status === "gone") {
    return new NextResponse("Gone", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      status: 410,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/u/:username",
};
