import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";
const progressPayloadSchema = z.record(z.string(), z.unknown());
export const recordProgressFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
    entryId: z.uuid(),
    progressModelKey: z.enum(["book_page_progress", "watch_log"]),
    eventType: z.enum(["progress_set", "session_logged", "completed", "abandoned"]),
    payloadJson: progressPayloadSchema,
    occurredAt: z.iso.datetime({ offset: true }).optional(),
    reasonCode: z.string().trim().min(1).max(80).optional(),
    reasonNote: z.string().trim().min(1).max(500).optional(),
    imported: z.boolean(),
});
export const initialRecordProgressActionState = {
    status: "idle",
    message: "",
};
