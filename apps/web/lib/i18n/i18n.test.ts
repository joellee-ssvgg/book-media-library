import { describe, expect, it } from "vitest";

import { getBundle, listLocales, t } from "./index";
import enUS from "./locales/en-US";
import zhCN from "./locales/zh-CN";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n bundle", () => {
  it("supports the P0 zh-CN and en-US locales", () => {
    expect(listLocales()).toEqual(["zh-CN", "en-US"]);
    expect(getBundle("zh-CN")).toBe(zhCN);
    expect(getBundle("en-US")).toBe(enUS);
  });

  it("resolves registry label and status keys", () => {
    expect(t("media.book.label")).toBe("书");
    expect(t("media.book.status.reading")).toBe("在读");
    expect(t("media.movie.label", "en-US")).toBe("Movie");
    expect(t("media.movie.status.watched", "en-US")).toBe("Watched");
  });

  it("returns the key itself for missing or non-string values", () => {
    expect(t("media.book.unknown")).toBe("media.book.unknown");
    expect(t("media.book")).toBe("media.book");
  });

  it("keeps zh-CN and en-US key sets synchronized", () => {
    expect(flattenKeys(enUS).sort()).toEqual(flattenKeys(zhCN).sort());
  });
});
