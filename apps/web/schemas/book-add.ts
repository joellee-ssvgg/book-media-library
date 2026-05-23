import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";

export const addBookEntryFormSchema = z.object({
  accessToken: optionalAccessTokenSchema,
  provider: z.enum(["openlibrary", "googlebooks"]),
  externalId: z.string().trim().min(1),
  status: z.enum(["want_to_read", "reading", "finished", "abandoned"]).default("want_to_read"),
});

export type BookCandidateView = {
  provider: "openlibrary" | "googlebooks";
  externalId: string;
  title: string;
  creators: string[];
  releaseYear?: number;
  coverUrl?: string;
};

export type ProviderSearchNotice = {
  provider: string;
  message: string;
};

export type AddBookEntryActionState = {
  status: "idle" | "validation_error" | "config_error" | "provider_error" | "db_error" | "created";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof addBookEntryFormSchema>, string[]>>;
  workId?: string;
  editionId?: string;
  entryId?: string;
};

export const initialAddBookEntryActionState: AddBookEntryActionState = {
  status: "idle",
};
