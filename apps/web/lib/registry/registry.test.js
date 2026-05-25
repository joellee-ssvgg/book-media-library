import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bookRegistry } from "./book";
import { getRegistry, isEnabledMediaTypeId, listEnabledMediaTypes, listEnabledRegistries, } from "./index";
function expectValidStatusStateMachine(mediaType) {
    const registry = getRegistry(mediaType);
    const defaultStatus = registry.statusOptions.find((status) => status.key === registry.defaultStatus);
    expect(defaultStatus).toBeDefined();
    expect(registry.statusOptions.some((status) => status.isTerminal)).toBe(true);
    expect(registry.statusOptions.some((status) => status.isActive)).toBe(true);
}
describe("Media Type Registry", () => {
    it("enables only book and movie in P0", () => {
        expect(listEnabledMediaTypes()).toEqual(["book", "movie"]);
        expect(listEnabledRegistries().map((registry) => registry.id)).toEqual(["book", "movie"]);
    });
    it("rejects non-P0 media types", () => {
        expect(() => getRegistry("tv")).toThrow(/not enabled/);
        expect(isEnabledMediaTypeId("book")).toBe(true);
        expect(isEnabledMediaTypeId("movie")).toBe(true);
        expect(isEnabledMediaTypeId("tv")).toBe(false);
    });
    it("returns the full book capability registry", () => {
        expect(getRegistry("book")).toMatchObject({
            id: "book",
            labelKey: "media.book.label",
            defaultStatus: "want_to_read",
            defaultProgressModel: "book_page_progress",
            supportedEditionTypes: ["paperback", "hardcover", "ebook", "audiobook"],
            searchProviders: ["openlibrary", "googlebooks", "manual"],
            annotationLocationKind: "book",
            publicSummaryFields: ["canonical_title", "first_release_year", "cover_url"],
        });
    });
    it("returns the full movie capability registry", () => {
        expect(getRegistry("movie")).toMatchObject({
            id: "movie",
            labelKey: "media.movie.label",
            defaultStatus: "want_to_watch",
            defaultProgressModel: "watch_log",
            supportedEditionTypes: ["theatrical", "tv_cut", "director_cut"],
            searchProviders: ["tmdb", "manual"],
            annotationLocationKind: "video",
            publicSummaryFields: ["canonical_title", "first_release_year", "cover_url"],
        });
    });
    it("keeps status state machines valid", () => {
        expectValidStatusStateMachine("book");
        expectValidStatusStateMachine("movie");
    });
    it("picks search config for CJK, English, mixed, and symbol-only text", () => {
        expect(bookRegistry.pickSearchConfig("沙丘 第一部")).toBe("chinese_jieba");
        expect(bookRegistry.pickSearchConfig("Project Hail Mary")).toBe("english");
        expect(bookRegistry.pickSearchConfig("Dune 沙丘")).toBe("chinese_jieba");
        expect(bookRegistry.pickSearchConfig(" 12345 ")).toBe("simple");
        expect(bookRegistry.pickSearchConfig("   ")).toBe("simple");
    });
    it("keeps existing business code away from media-type branching", () => {
        const appRoot = join(process.cwd());
        const filesToScan = [
            "actions/manual-work.js",
            "components/domain/manual-work-form.jsx",
            "schemas/manual-work.js",
        ];
        const mediaBranchPattern = /if\s*\([^)]*(?:mediaType|media_type)\s*={2,3}\s*["'](?:book|movie)["']/;
        for (const file of filesToScan) {
            const source = readFileSync(join(appRoot, file), "utf8");
            expect(source).not.toMatch(mediaBranchPattern);
        }
    });
});
