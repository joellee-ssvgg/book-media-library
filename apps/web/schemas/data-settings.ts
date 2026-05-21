import { z } from "zod";

export const dataExportFormSchema = z.object({
  accessToken: z.string().trim().min(1, "access token 必填"),
});

export const accountDeletionFormSchema = z.object({
  accessToken: z.string().trim().min(1, "access token 必填"),
  deletionChannel: z.enum(["export_then_delete", "gdpr"]),
  exportJobId: z.string().trim().uuid("export job id 必须是 UUID").optional(),
  confirmation: z.string().trim().min(1, "确认文本必填"),
});

export type DataExportActionState = {
  status: "idle" | "validation_error" | "config_error" | "db_error" | "exported";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof dataExportFormSchema>, string[]>>;
  jobId?: string;
  generatedAt?: string;
  dataJson?: string;
  zipBase64?: string;
};

export type AccountDeletionActionState = {
  status:
    | "idle"
    | "validation_error"
    | "config_error"
    | "db_error"
    | "soft_deleted"
    | "cooling_off";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof accountDeletionFormSchema>, string[]>>;
  requestId?: string;
  channel?: "export_then_delete" | "gdpr";
  softDeleteUntil?: string;
  coolingUntil?: string;
};

export const initialDataExportActionState: DataExportActionState = {
  status: "idle",
};

export const initialAccountDeletionActionState: AccountDeletionActionState = {
  status: "idle",
};
