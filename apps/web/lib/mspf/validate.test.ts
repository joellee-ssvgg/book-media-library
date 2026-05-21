import { describe, expect, it } from "vitest";

import { assertMspfDocument, mspfToImportPayload } from "./validate";

const validMspf = {
  format: "MSPF",
  version: "1.0.0",
  exported_at: "2026-05-21T00:00:00.000Z",
  profile: {
    id: "00000000-0000-0000-0000-000000000001",
    username: "demo01",
  },
  works: [
    {
      id: "00000000-0000-0000-0000-000000000101",
      media_type: "book",
      canonical_title: "The Pragmatic Programmer",
      first_release_year: 1999,
      external_ids: [
        {
          source: "openlibrary",
          external_id: "/works/OL123W",
        },
      ],
    },
  ],
  editions: [
    {
      id: "00000000-0000-0000-0000-000000000201",
      work_id: "00000000-0000-0000-0000-000000000101",
      title: "The Pragmatic Programmer",
      language: "en",
      edition_type: "paperback",
      page_count: 352,
      is_default: true,
    },
  ],
  entries: [
    {
      id: "00000000-0000-0000-0000-000000000301",
      work_id: "00000000-0000-0000-0000-000000000101",
      edition_id: "00000000-0000-0000-0000-000000000201",
      status: "reading",
      rating_x10: 45,
      visibility_scope: "private",
      favorite: true,
    },
  ],
};

describe("MSPF validator", () => {
  it("compiles the v1.0.0 schema and maps entries into import payload items", () => {
    const payload = mspfToImportPayload(validMspf, "library.mspf.json");

    expect(payload).toMatchObject({
      source: "mspf",
      source_file_name: "library.mspf.json",
      mspf: {
        version: "1.0.0",
      },
      items: [
        {
          original_work_id: "00000000-0000-0000-0000-000000000101",
          original_edition_id: "00000000-0000-0000-0000-000000000201",
          original_entry_id: "00000000-0000-0000-0000-000000000301",
          media_type: "book",
          canonical_title: "The Pragmatic Programmer",
          status: "reading",
          page_count: 352,
          rating_x10: 45,
          favorite: true,
        },
      ],
    });
  });

  it("rejects additional top-level properties", () => {
    expect(() => assertMspfDocument({ ...validMspf, unexpected: true })).toThrow(
      "must NOT have additional properties",
    );
  });

  it("rejects invalid entry status values", () => {
    expect(() =>
      assertMspfDocument({
        ...validMspf,
        entries: [{ ...validMspf.entries[0], status: "done" }],
      }),
    ).toThrow("must be equal to one of the allowed values");
  });
});
