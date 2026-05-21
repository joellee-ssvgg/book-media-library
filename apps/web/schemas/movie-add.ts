import { z } from "zod";

const ratingOptions = [
  "",
  "5",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
] as const;

export const addMovieEntryFormSchema = z.object({
  accessToken: z.string().trim().min(1, "access token 必填"),
  provider: z.literal("tmdb"),
  externalId: z.string().trim().min(1),
  status: z.enum(["want_to_watch", "watching", "watched", "abandoned"]).default("want_to_watch"),
  ratingX10: z.enum(ratingOptions).default(""),
});

export type MovieCandidateView = {
  provider: "tmdb";
  externalId: string;
  title: string;
  releaseYear?: number;
  coverUrl?: string;
  runtimeMinutes?: number;
  description?: string;
};

export type ProviderSearchNotice = {
  provider: string;
  message: string;
};

export type AddMovieEntryActionState = {
  status: "idle" | "validation_error" | "config_error" | "provider_error" | "db_error" | "created";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof addMovieEntryFormSchema>, string[]>>;
  workId?: string;
  editionId?: string;
  entryId?: string;
};

export const initialAddMovieEntryActionState: AddMovieEntryActionState = {
  status: "idle",
};
