import { describe, expect, it } from "vitest";
import { accessTokenFromCookies, extractAccessToken, tokenFromCookieValue } from "./proxy";

const accessToken = "eyJ.test.token";

function encodedSessionCookie(payload) {
  return `base64-${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
}

describe("proxy Supabase cookie parsing", () => {
  it("extracts access tokens from Supabase base64 SSR cookies", () => {
    expect(tokenFromCookieValue(encodedSessionCookie({ access_token: accessToken }))).toBe(accessToken);
  });

  it("keeps support for JSON session cookies", () => {
    expect(tokenFromCookieValue(JSON.stringify({ access_token: accessToken }))).toBe(accessToken);
  });

  it("rejects malformed base64 cookies instead of accepting a fake session", () => {
    expect(tokenFromCookieValue("base64-not-json")).toBeNull();
  });

  it("reassembles Supabase chunked auth cookies before extracting access tokens", () => {
    const value = encodedSessionCookie({ access_token: accessToken });
    const splitAt = Math.ceil(value.length / 2);

    expect(
      accessTokenFromCookies([
        { name: "sb-project-ref-auth-token.0", value: value.slice(0, splitAt) },
        { name: "sb-project-ref-auth-token.1", value: value.slice(splitAt) },
      ])
    ).toBe(accessToken);
  });

  it("uses bearer authorization before cookie auth", () => {
    const request = {
      headers: {
        get(name) {
          return name === "authorization" ? "Bearer eyJ.header.token" : null;
        },
      },
      cookies: {
        getAll() {
          return [{ name: "sb-project-ref-auth-token", value: encodedSessionCookie({ access_token: accessToken }) }];
        },
      },
    };

    expect(extractAccessToken(request)).toBe("eyJ.header.token");
  });
});
