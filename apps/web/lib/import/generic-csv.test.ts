import { describe, expect, it } from "vitest";

import { genericCsvToImportPayload, parseCsvRows } from "./generic-csv";

describe("genericCsvToImportPayload", () => {
  it("parses quoted CSV rows into Task14 import items", () => {
    const payload = genericCsvToImportPayload(
      [
        "title,media_type,status,year,external_source,external_id,favorite",
        "\"The Pragmatic Programmer\",book,want_to_read,1999,openlibrary,/works/OL123W,true",
      ].join("\n"),
      "history.csv",
    );

    expect(payload).toMatchObject({
      source: "csv",
      source_file_name: "history.csv",
      items: [
        {
          media_type: "book",
          canonical_title: "The Pragmatic Programmer",
          status: "want_to_read",
          first_release_year: 1999,
          favorite: true,
          external_ids: [
            {
              source: "openlibrary",
              external_id: "/works/OL123W",
            },
          ],
        },
      ],
    });
  });

  it("keeps commas inside quoted cells", () => {
    expect(parseCsvRows("title,status\n\"Book, With Comma\",reading")).toEqual([
      ["title", "status"],
      ["Book, With Comma", "reading"],
    ]);
  });

  it("rejects rows without a title column", () => {
    expect(() => genericCsvToImportPayload("name_missing,status\nx,reading")).toThrow(
      "canonical_title or title",
    );
  });
});
