import { describe, expect, it } from "vitest";

import { isUuid, slugifyTitle } from "./slug";

describe("public page slug helpers", () => {
  it("keeps readable ASCII and CJK route slugs stable", () => {
    expect(slugifyTitle("The Pragmatic Programmer")).toBe("the-pragmatic-programmer");
    expect(slugifyTitle("三体：黑暗森林")).toBe("三体-黑暗森林");
    expect(slugifyTitle("!!!")).toBe("work");
  });

  it("validates UUID route params", () => {
    expect(isUuid("00000000-0000-0000-0000-000000000017")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});
