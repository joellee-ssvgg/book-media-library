import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { hasSupabaseAuthCookie, isPrivatePath, withSessionCookies } from "./proxy";

describe("isPrivatePath", () => {
  it("matches every private app section including nested paths", () => {
    expect(isPrivatePath("/dashboard")).toBe(true);
    expect(isPrivatePath("/library/films")).toBe(true);
    expect(isPrivatePath("/lists/wishlist")).toBe(true);
    expect(isPrivatePath("/settings/public")).toBe(true);
    expect(isPrivatePath("/add/book")).toBe(true);
    expect(isPrivatePath("/maps")).toBe(true);
    expect(isPrivatePath("/onboarding")).toBe(true);
  });

  it("leaves public and auth routes alone", () => {
    expect(isPrivatePath("/")).toBe(false);
    expect(isPrivatePath("/u/reader_1")).toBe(false);
    expect(isPrivatePath("/w/work-id/slug")).toBe(false);
    expect(isPrivatePath("/auth/sign-in")).toBe(false);
  });

  it("does not match path-prefix lookalikes", () => {
    expect(isPrivatePath("/dashboard-export")).toBe(false);
    expect(isPrivatePath("/address")).toBe(false);
  });
});

describe("hasSupabaseAuthCookie", () => {
  it("detects the Supabase SSR auth cookie", () => {
    expect(hasSupabaseAuthCookie([{ name: "sb-project-ref-auth-token", value: "x" }])).toBe(true);
  });

  it("detects chunked auth cookies", () => {
    expect(
      hasSupabaseAuthCookie([
        { name: "sb-project-ref-auth-token.0", value: "x" },
        { name: "sb-project-ref-auth-token.1", value: "y" },
      ])
    ).toBe(true);
  });

  it("ignores unrelated cookies", () => {
    expect(
      hasSupabaseAuthCookie([
        { name: "theme", value: "dark" },
        { name: "sb-project-ref-code-verifier", value: "x" },
      ])
    ).toBe(false);
  });
});

describe("withSessionCookies", () => {
  it("copies refreshed session cookies onto another response", () => {
    const source = NextResponse.next();
    source.cookies.set("sb-project-ref-auth-token", "refreshed", { path: "/", maxAge: 3600 });
    const target = withSessionCookies(
      NextResponse.redirect("https://example.com/auth/sign-in"),
      source
    );

    const cookie = target.cookies.get("sb-project-ref-auth-token");
    expect(cookie?.value).toBe("refreshed");
    expect(target.status).toBe(307);
  });

  it("returns the target untouched when no cookies were refreshed", () => {
    const target = withSessionCookies(new NextResponse("Gone", { status: 410 }), NextResponse.next());
    expect(target.cookies.getAll()).toHaveLength(0);
    expect(target.status).toBe(410);
  });
});
