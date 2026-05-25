import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";
export const loadLibraryDashboardFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
});
export const p0SeedRecommendations = [
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
export const initialLibraryDashboardData = {
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
export const initialLibraryDashboardActionState = {
    status: "idle",
    data: initialLibraryDashboardData,
};
