import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";

import type { ImportItem, ImportPayload } from "@/lib/import/types";

import schema from "./v1.0.0.schema.json";

type MspfExternalId = {
  source: string;
  external_id: string;
  source_url?: string | null;
};

type MspfWork = {
  id: string;
  media_type: string;
  canonical_title: string;
  original_title?: string | null;
  description?: string | null;
  first_release_year?: number | null;
  original_language?: string | null;
  external_ids?: MspfExternalId[];
};

type MspfEdition = {
  id: string;
  work_id: string;
  title?: string | null;
  cover_url?: string | null;
  language?: string | null;
  edition_type?: string | null;
  page_count?: number | null;
  runtime_minutes?: number | null;
  is_default: boolean;
};

type MspfEntry = {
  id: string;
  edition_id: string;
  work_id?: string;
  status: string;
  rating_x10?: number | null;
  visibility_scope: "private" | "unlisted" | "followers" | "public";
  field_visibility_json?: Record<string, string>;
  favorite?: boolean;
  imported?: boolean;
  started_at?: string | null;
  finished_at?: string | null;
};

type MspfDocument = {
  format: "MSPF";
  version: string;
  exported_at: string;
  profile: {
    id: string;
    username: string;
  };
  works?: MspfWork[];
  editions?: MspfEdition[];
  entries?: MspfEntry[];
};

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

export const validateMspf = ajv.compile<MspfDocument>(schema);

function formatAjvErrors(errors: ErrorObject[] | null | undefined) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
}

function assertP0MediaType(mediaType: string): asserts mediaType is "book" | "movie" {
  if (mediaType !== "book" && mediaType !== "movie") {
    throw new Error(`MSPF media_type is outside P0 scope: ${mediaType}`);
  }
}

function defined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

export function assertMspfDocument(input: unknown): MspfDocument {
  if (!validateMspf(input)) {
    throw new Error(`MSPF validation failed: ${formatAjvErrors(validateMspf.errors)}`);
  }

  return input;
}

export function mspfToImportPayload(
  input: unknown,
  sourceFileName?: string,
): ImportPayload {
  const document = assertMspfDocument(input);
  const works = new Map((document.works ?? []).map((work) => [work.id, work]));
  const editions = new Map((document.editions ?? []).map((edition) => [edition.id, edition]));
  const entries = document.entries ?? [];

  if (entries.length === 0) {
    throw new Error("MSPF import requires at least one entry.");
  }

  const items: ImportItem[] = entries.map((entry) => {
    const edition = editions.get(entry.edition_id);
    const workId = entry.work_id ?? edition?.work_id;

    if (!workId) {
      throw new Error(`MSPF entry ${entry.id} does not reference a work.`);
    }

    const work = works.get(workId);

    if (!work) {
      throw new Error(`MSPF entry ${entry.id} references missing work ${workId}.`);
    }

    assertP0MediaType(work.media_type);

    return {
      original_work_id: work.id,
      original_edition_id: edition?.id,
      original_entry_id: entry.id,
      media_type: work.media_type,
      canonical_title: work.canonical_title,
      original_title: defined(work.original_title),
      description: defined(work.description),
      first_release_year: defined(work.first_release_year),
      original_language: defined(work.original_language),
      cover_url: defined(edition?.cover_url),
      edition_title: defined(edition?.title),
      edition_language: defined(edition?.language),
      edition_type: defined(edition?.edition_type),
      page_count: defined(edition?.page_count),
      runtime_minutes: defined(edition?.runtime_minutes),
      status: entry.status,
      rating_x10: defined(entry.rating_x10),
      favorite: entry.favorite,
      imported: entry.imported,
      visibility_scope: entry.visibility_scope,
      field_visibility_json: entry.field_visibility_json,
      started_at: defined(entry.started_at),
      finished_at: defined(entry.finished_at),
      external_ids: (work.external_ids ?? []).map((externalId) => ({
        source: externalId.source,
        external_id: externalId.external_id,
        source_url: defined(externalId.source_url),
      })),
    };
  });

  return {
    source: "mspf",
    source_file_name: sourceFileName,
    mspf: {
      version: document.version,
      exported_at: document.exported_at,
    },
    items,
  };
}
