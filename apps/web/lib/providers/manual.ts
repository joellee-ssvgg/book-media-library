import { err, ok } from "./result";
import type { CanonicalRecord, MediaProvider } from "./types";

function manualExternalId(mediaType: "book" | "movie", title: string) {
  return `manual:${mediaType}:${encodeURIComponent(title.toLowerCase())}`;
}

export const manualProvider: MediaProvider = {
  id: "manual",
  mediaTypes: ["book", "movie"],
  async search(query) {
    const title = query.text.replace(/\s+/g, " ").trim();

    if (!title) {
      return err("invalid_query", "Manual provider query is empty.");
    }

    return ok([
      {
        provider: "manual",
        mediaType: query.mediaType,
        externalId: manualExternalId(query.mediaType, title),
        title,
        creators: [],
        externalIds: [
          {
            source: "manual",
            externalId: manualExternalId(query.mediaType, title),
          },
        ],
        raw: {
          title,
        },
      },
    ]);
  },
  async fetch(externalId) {
    const title = decodeURIComponent(externalId.split(":").at(-1) ?? "").trim();

    if (!title) {
      return err("invalid_query", "Manual external id is empty.");
    }

    return ok({
      provider: "manual",
      mediaType: externalId.includes(":movie:") ? "movie" : "book",
      externalId,
      title,
      creators: [],
      externalIds: [
        {
          source: "manual",
          externalId,
        },
      ],
      raw: {
        externalId,
      },
      credits: [],
    } satisfies CanonicalRecord);
  },
};
