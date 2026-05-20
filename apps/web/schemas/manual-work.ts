import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

const optionalYear = z.preprocess(
  (value) => {
    if (typeof value !== "string" || value.trim() === "") {
      return undefined;
    }

    return Number(value);
  },
  z.number().int().min(0).max(3000).optional(),
);

export const manualWorkFormSchema = z
  .object({
    accessToken: z.string().trim().min(1, "需要已登录用户的 Supabase access token"),
    mediaType: z.enum(["book", "movie"]),
    title: z.string().trim().min(1, "标题不能为空").max(300),
    year: optionalYear,
    originalTitle: optionalText,
    originalLanguage: optionalText,
    externalSource: optionalText,
    externalId: optionalText,
    dedupOverride: z.boolean(),
    dedupSkippedReason: optionalText,
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.externalSource) !== Boolean(value.externalId)) {
      ctx.addIssue({
        code: "custom",
        path: ["externalId"],
        message: "外部来源和外部 ID 必须同时填写",
      });
    }

    if (value.dedupOverride && !value.dedupSkippedReason) {
      ctx.addIssue({
        code: "custom",
        path: ["dedupSkippedReason"],
        message: "跳过重复候选时必须填写原因",
      });
    }
  });

export type ManualWorkFormInput = z.infer<typeof manualWorkFormSchema>;

export type DuplicateCandidate = {
  work_id: string;
  canonical_title: string;
  first_release_year: number | null;
  similarity_score: number;
};

export type ManualWorkActionState = {
  status:
    | "idle"
    | "created"
    | "duplicate_found"
    | "validation_error"
    | "config_error"
    | "db_error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  candidates?: DuplicateCandidate[];
  workId?: string;
  defaultEditionId?: string;
};

export const initialManualWorkActionState: ManualWorkActionState = {
  status: "idle",
};
