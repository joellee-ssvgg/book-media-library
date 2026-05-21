import { z } from "zod";

const progressPayloadSchema = z.record(z.string(), z.unknown());

export const recordProgressFormSchema = z.object({
  accessToken: z.string().min(1, "accessToken is required"),
  entryId: z.uuid(),
  progressModelKey: z.enum(["book_page_progress", "watch_log"]),
  eventType: z.enum(["progress_set", "session_logged", "completed", "abandoned"]),
  payloadJson: progressPayloadSchema,
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  reasonCode: z.string().trim().min(1).max(80).optional(),
  reasonNote: z.string().trim().min(1).max(500).optional(),
  imported: z.boolean(),
});

export type RecordProgressActionState =
  | {
      status: "idle";
      message: "";
    }
  | {
      status: "validation_error";
      message: string;
      fieldErrors?: Partial<Record<keyof z.infer<typeof recordProgressFormSchema>, string[]>>;
    }
  | {
      status: "config_error" | "db_error";
      message: string;
    }
  | {
      status: "recorded";
      message: string;
      progressLogId: string;
      entryId: string;
      progressModelId: string;
      snapshot: Record<string, unknown> | null;
    };

export const initialRecordProgressActionState: RecordProgressActionState = {
  status: "idle",
  message: "",
};
