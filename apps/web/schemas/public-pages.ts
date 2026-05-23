import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";

export type PublicEntryCard = {
  entry_id: string;
  work_id: string;
  edition_id: string;
  media_type: "book" | "movie";
  title: string;
  year?: number;
  cover_url?: string;
  status: string;
  rating_x10?: number;
  review?: string;
  favorite?: boolean;
  finished_at?: string;
  updated_at: string;
  position?: number;
};

export type PublicProfileData =
  | {
      status: "active";
      profile: {
        username: string;
        display_name?: string;
        avatar_url?: string;
        bio?: string;
        public_visibility: "public" | "unlisted";
      };
      top3: PublicEntryCard[];
      recent_finished: PublicEntryCard[];
      public_reviews: PublicEntryCard[];
      stats: {
        public_entries: number;
        books: number;
        movies: number;
        completed: number;
        reviewed: number;
        average_rating_x10?: number;
      };
    }
  | {
      status: "gone" | "not_found";
    };

export type PublicWorkData =
  | {
      status: "active";
      work: {
        work_id: string;
        media_type: "book" | "movie";
        title: string;
        original_title?: string;
        description?: string;
        original_language?: string;
        year?: number;
      };
      edition?: {
        edition_id?: string;
        title?: string;
        cover_url?: string;
        language?: string;
        edition_type?: string;
        page_count?: number;
        runtime_minutes?: number;
        release_date?: string;
      };
      stats: {
        public_entries: number;
        completed: number;
        reviewed: number;
        average_rating_x10?: number;
      };
      recent_reviews: Array<{
        entry_id: string;
        status: string;
        rating_x10?: number;
        review?: string;
        finished_at?: string;
        updated_at: string;
        author_name: string;
        author_username?: string;
        author_deleted: boolean;
      }>;
    }
  | {
      status: "not_found";
    };

export const publicProfileSettingsFormSchema = z.object({
  accessToken: optionalAccessTokenSchema,
  publicVisibility: z.enum(["private", "unlisted", "followers", "public"]),
  topEntryId1: z.string().trim().optional(),
  topEntryId2: z.string().trim().optional(),
  topEntryId3: z.string().trim().optional(),
});

export type PublicProfileSettingsActionState = {
  status: "idle" | "validation_error" | "config_error" | "db_error" | "updated";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof publicProfileSettingsFormSchema>, string[]>>;
};

export const initialPublicProfileSettingsActionState: PublicProfileSettingsActionState = {
  status: "idle",
};
