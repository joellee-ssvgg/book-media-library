import { describe, expect, it } from "vitest";
import { firstUsableProfile } from "./private-shell-profile";

describe("firstUsableProfile", () => {
  it("selects the first row with a username", () => {
    expect(firstUsableProfile([{ username: "reader_1" }, { username: "reader_2" }])).toEqual({
      username: "reader_1",
    });
  });

  it("ignores missing or empty profile results", () => {
    expect(firstUsableProfile([])).toBeNull();
    expect(firstUsableProfile([{ username: "" }])).toBeNull();
    expect(firstUsableProfile(null)).toBeNull();
  });
});
