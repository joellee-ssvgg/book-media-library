import enUS from "./locales/en-US";
import zhCN from "./locales/zh-CN";
const bundles = {
    "zh-CN": zhCN,
    "en-US": enUS,
};
export function t(key, locale = "zh-CN") {
    const parts = key.split(".");
    let current = bundles[locale];
    for (const part of parts) {
        if (!isRecord(current) || !(part in current)) {
            return key;
        }
        current = current[part];
    }
    return typeof current === "string" ? current : key;
}
export function listLocales() {
    return Object.keys(bundles);
}
export function getBundle(locale) {
    return bundles[locale];
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
