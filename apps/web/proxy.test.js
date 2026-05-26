import { describe, expect, it } from "vitest";
import { tokenFromCookieValue } from "./proxy";

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
});
