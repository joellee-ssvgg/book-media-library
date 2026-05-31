import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "../../public");
describe("Task20 PWA assets", () => {
    it("ships an installable manifest", () => {
        const manifest = JSON.parse(readFileSync(join(publicDir, "manifest.webmanifest"), "utf8"));
        expect(manifest.start_url).toBe("/");
        expect(manifest.display).toBe("standalone");
        expect(manifest.theme_color).toBe("#1f3d35");
        expect(manifest.icons).toContainEqual(expect.objectContaining({
            src: "/pwa-icon.svg",
            purpose: "any maskable",
            sizes: "any",
        }));
    });
    it("keeps the service worker cache limited to static assets", () => {
        const sw = readFileSync(join(publicDir, "sw.js"), "utf8");
        expect(sw).toContain("TASK20_STATIC_ASSETS");
        expect(sw).toContain("/manifest.webmanifest");
        expect(sw).not.toContain("/_next/static/");
        expect(sw).not.toContain("css|js");
        expect(sw).not.toContain('"/"');
        expect(sw).not.toContain("request.mode === \"navigate\"");
    });
});
