import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";
const favoriteItemSchema = z.object({
    media_type: z.enum(["book", "movie"]).default("book"),
    canonical_title: z.string().trim().min(1).max(240),
    status: z.string().trim().optional(),
});
export const completeOnboardingFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
    username: z
        .string()
        .trim()
        .regex(/^[a-z0-9_]{3,20}$/, "username 只能使用 3-20 位小写字母、数字或下划线"),
    displayName: z.string().trim().max(80).optional(),
    avatarUrl: z.url().optional().or(z.literal("")),
    favorites: z.array(favoriteItemSchema).max(3).default([]),
});
export const onboardingImportFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
    importSource: z.enum(["csv", "mspf"]),
});
export const initialOnboardingActionState = {
    status: "idle",
};
export const initialImportActionState = {
    status: "idle",
};
