import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";
export const publicProfileSettingsFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
    publicVisibility: z.enum(["private", "unlisted", "followers", "public"]),
    topEntryId1: z.string().trim().optional(),
    topEntryId2: z.string().trim().optional(),
    topEntryId3: z.string().trim().optional(),
});
export const initialPublicProfileSettingsActionState = {
    status: "idle",
};
