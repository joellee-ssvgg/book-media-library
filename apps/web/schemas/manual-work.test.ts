import { describe, expect, it } from "vitest";

import { manualWorkFormSchema } from "./manual-work";

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    accessToken: "test-token",
    mediaType: "book",
    title: "沙丘",
    year: "1965",
    originalTitle: "",
    originalLanguage: "zh",
    externalSource: "",
    externalId: "",
    dedupOverride: false,
    dedupSkippedReason: "",
    ...overrides,
  };
}

describe("manualWorkFormSchema", () => {
  it("accepts media types enabled by the registry", () => {
    expect(manualWorkFormSchema.safeParse(validInput({ mediaType: "book" })).success).toBe(true);
    expect(manualWorkFormSchema.safeParse(validInput({ mediaType: "movie" })).success).toBe(true);
  });

  it("rejects non-P0 media types", () => {
    const parsed = manualWorkFormSchema.safeParse(validInput({ mediaType: "tv" }));

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.mediaType).toContain(
      "当前 P0 阶段只支持书和电影",
    );
  });
});
