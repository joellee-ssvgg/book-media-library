import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";

export const loadLibraryDashboardFormSchema = z.object({
  accessToken: optionalAccessTokenSchema,
});

export type LibraryEntryView = {
  entry_id: string;
  work_id: string;
  edition_id: string;
  media_type: "book" | "movie";
  title: string;
  year?: number;
  cover_url?: string;
  runtime_minutes?: number;
  page_count?: number;
  status: string;
  rating_x10?: number;
  visibility_scope: string;
  favorite: boolean;
  imported: boolean;
  started_at?: string;
  finished_at?: string;
  updated_at: string;
  progress?: Record<string, unknown>;
};

export type DashboardEntryView = Pick<
  LibraryEntryView,
  "entry_id" | "media_type" | "title" | "cover_url" | "status" | "rating_x10" | "updated_at" | "finished_at" | "progress"
>;

export type StalledEntryView = Pick<
  LibraryEntryView,
  "entry_id" | "media_type" | "title" | "status" | "updated_at"
>;

export type SeedRecommendationView = {
  media_type: "book" | "movie";
  title: string;
  subtitle: string;
  year: number;
  provider: string;
  href: string;
};

export type LibraryDashboardData = {
  status: "loaded";
  profile_id?: string;
  entry_count: number;
  use_seed: boolean;
  seed_recommendations: SeedRecommendationView[];
  library: LibraryEntryView[];
  dashboard: {
    continue_reading: DashboardEntryView[];
    recent_finished: DashboardEntryView[];
    stalled: StalledEntryView[];
    heatmap_placeholder: {
      status: "placeholder";
      reason: string;
    };
    year_ring: {
      completed_this_year: number;
      goal: number;
    };
  };
};

export type LibraryDashboardActionState = {
  status: "idle" | "validation_error" | "config_error" | "db_error" | "loaded";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof loadLibraryDashboardFormSchema>, string[]>>;
  data: LibraryDashboardData;
};

export const p0SeedRecommendations: SeedRecommendationView[] = [
  {
    media_type: "book",
    title: "The Pragmatic Programmer",
    subtitle: "P0 seed recommendation",
    year: 1999,
    provider: "openlibrary",
    href: "/add/book?q=The%20Pragmatic%20Programmer",
  },
  {
    media_type: "book",
    title: "Dune",
    subtitle: "P0 seed recommendation",
    year: 1965,
    provider: "openlibrary",
    href: "/add/book?q=Dune",
  },
  {
    media_type: "movie",
    title: "Inception",
    subtitle: "P0 seed recommendation",
    year: 2010,
    provider: "tmdb",
    href: "/add/movie?q=Inception",
  },
];

export const initialLibraryDashboardData: LibraryDashboardData = {
  status: "loaded",
  entry_count: 0,
  use_seed: true,
  seed_recommendations: p0SeedRecommendations,
  library: [],
  dashboard: {
    continue_reading: [],
    recent_finished: [],
    stalled: [],
    heatmap_placeholder: {
      status: "placeholder",
      reason: "P0 reserves the heatmap surface until progress density data exists",
    },
    year_ring: {
      completed_this_year: 0,
      goal: 12,
    },
  },
};

export const initialLibraryDashboardActionState: LibraryDashboardActionState = {
  status: "idle",
  data: initialLibraryDashboardData,
};
