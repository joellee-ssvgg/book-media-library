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

function signInRequest(body, options = {}) {
  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });
  if (options.host) {
    headers.set("host", options.host);
  }

  return new Request(options.url ?? "https://example.com/auth/password/sign-in", {
    body: new URLSearchParams(body),
    headers,
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

  it("keeps the incoming host in redirects so auth cookies stay on the same origin", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      signInRequest(
        {
          email: "reader@example.com",
          password: "correct-password",
          next: "/dashboard",
        },
        {
          host: "127.0.0.1:3000",
          url: "http://localhost:3000/auth/password/sign-in",
        },
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/dashboard");
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
