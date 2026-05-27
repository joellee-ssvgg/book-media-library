import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _anonKey, options) => {
    options.cookies.setAll([
      {
        name: "sb-test-auth-token",
        value: "test-session",
        options: { httpOnly: true },
      },
    ]);

    return {
      auth: {
        signInWithPassword: vi.fn(async () => ({ error: null })),
      },
    };
  }),
}));

function signInRequest(body) {
  return new Request("https://example.com/auth/password/sign-in", {
    body: new URLSearchParams(body),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
}

describe("password sign-in route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("redirects successful form posts with 303 so the browser follows with GET", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      signInRequest({
        email: "reader@example.com",
        password: "correct-password",
        next: "/dashboard",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.com/dashboard");
    expect(response.headers.get("set-cookie")).toContain("sb-test-auth-token=test-session");
  });

  it("redirects invalid form posts with 303 back to sign-in", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      signInRequest({
        email: "",
        password: "",
        next: "/dashboard",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/auth/sign-in?error=");
  });
});
