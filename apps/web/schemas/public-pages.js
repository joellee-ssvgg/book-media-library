import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";
export const publicProfileSettingsFormSchema = z.object({
    accessToken: optionalAccessTokenSchema,
    publicVisibility: z.enum(["private", "unlisted", "followers", "public"]),
    username: z.string().trim().regex(/^[a-z0-9_]{3,20}$/, "用户名只能用 3–20 位小写字母、数字或下划线"),
    displayName: z.string().trim().max(30, "显示名称最多 30 个字符").optional(),
    bio: z.string().trim().max(200, "一句话介绍最多 200 个字符").optional(),
    topEntryId1: z.string().trim().optional(),
    topEntryId2: z.string().trim().optional(),
    topEntryId3: z.string().trim().optional(),
});
export const initialPublicProfileSettingsActionState = {
    status: "idle",
};
