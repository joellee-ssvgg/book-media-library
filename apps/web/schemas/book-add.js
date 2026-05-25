import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";
export const addBookEntryFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
    provider: z.enum(["openlibrary", "googlebooks"]),
    externalId: z.string().trim().min(1),
    status: z.enum(["want_to_read", "reading", "finished", "abandoned"]).default("want_to_read"),
});
export const initialAddBookEntryActionState = {
    status: "idle",
};
