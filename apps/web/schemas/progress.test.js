import { describe, expect, it } from "vitest";
import { recordProgressFormSchema } from "./progress";
describe("recordProgressFormSchema", () => {
    it("accepts a P0 book progress payload", () => {
        expect(recordProgressFormSchema.parse({
            accessToken: "token",
            entryId: "00000000-0000-4000-8000-000000090901",
            progressModelKey: "book_page_progress",
            eventType: "progress_set",
            payloadJson: {
                current_page: 120,
                total_pages: 352,
            },
            occurredAt: "2026-05-21T20:00:00+08:00",
            reasonCode: "reading_session",
            reasonNote: "今天一口气读到第 6 章",
            imported: false,
        })).toMatchObject({
            entryId: "00000000-0000-4000-8000-000000090901",
            progressModelKey: "book_page_progress",
        });
    });
    it("rejects non-P0 progress models", () => {
        expect(() => recordProgressFormSchema.parse({
            accessToken: "token",
            entryId: "00000000-0000-4000-8000-000000090901",
            progressModelKey: "tv_linear_progress",
            eventType: "progress_set",
            payloadJson: {},
            imported: false,
        })).toThrow();
    });
});
