import enUS from "./locales/en-US";
import zhCN from "./locales/zh-CN";

const bundles = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const;

export type LocaleId = keyof typeof bundles;
export type I18nBundle = (typeof bundles)[LocaleId];

export function t(key: string, locale: LocaleId = "zh-CN"): string {
  const parts = key.split(".");
  let current: unknown = bundles[locale];

  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      return key;
    }

    current = current[part];
  }

  return typeof current === "string" ? current : key;
}

export function listLocales(): LocaleId[] {
  return Object.keys(bundles) as LocaleId[];
}

export function getBundle(locale: LocaleId): I18nBundle {
  return bundles[locale];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
