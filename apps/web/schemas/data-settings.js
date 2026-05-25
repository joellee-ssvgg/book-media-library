import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";
export const dataExportFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
});
export const accountDeletionFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
    deletionChannel: z.enum(["export_then_delete", "gdpr"]),
    exportJobId: z.string().trim().uuid("export job id 必须是 UUID").optional(),
    confirmation: z.string().trim().min(1, "确认文本必填"),
});
export const initialDataExportActionState = {
    status: "idle",
};
export const initialAccountDeletionActionState = {
    status: "idle",
};
