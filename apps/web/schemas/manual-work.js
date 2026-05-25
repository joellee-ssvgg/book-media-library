import { z } from "zod";
import { isEnabledMediaTypeId } from "@/lib/registry";
import { optionalAccessTokenSchema } from "@/schemas/auth";
const optionalText = z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional();
const optionalYear = z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") {
        return undefined;
    }
    return Number(value);
}, z.number().int().min(0).max(3000).optional());
export const manualWorkFormSchema = z
    .object({
    accessToken: optionalAccessTokenSchema,
    mediaType: z
        .string()
        .trim()
        .refine(isEnabledMediaTypeId, "当前 P0 阶段只支持书和电影")
        .transform((value) => value),
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
export const initialManualWorkActionState = {
    status: "idle",
};
