export type ImportExternalId = {
  source: string;
  external_id: string;
  source_url?: string;
};

export type ImportItem = {
  original_work_id?: string;
  original_edition_id?: string;
  original_entry_id?: string;
  media_type: "book" | "movie";
  canonical_title: string;
  original_title?: string;
  first_release_year?: number;
  original_language?: string;
  description?: string;
  cover_url?: string;
  edition_title?: string;
  edition_language?: string;
  edition_type?: string;
  page_count?: number;
  runtime_minutes?: number;
  status: string;
  rating_x10?: number;
  favorite?: boolean;
  visibility_scope?: "private" | "unlisted" | "followers" | "public";
  field_visibility_json?: Record<string, string>;
  started_at?: string;
  finished_at?: string;
  external_ids?: ImportExternalId[];
};

export type ImportPayload = {
  source: "csv" | "mspf";
  source_file_name?: string;
  items: ImportItem[];
  mspf?: {
    version: string;
    exported_at: string;
  };
};
