import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";
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
];
export const addMovieEntryFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
    provider: z.literal("tmdb"),
    externalId: z.string().trim().min(1),
    status: z.enum(["want_to_watch", "watching", "watched", "abandoned"]).default("want_to_watch"),
    ratingX10: z.enum(ratingOptions).default(""),
});
export const initialAddMovieEntryActionState = {
    status: "idle",
};
