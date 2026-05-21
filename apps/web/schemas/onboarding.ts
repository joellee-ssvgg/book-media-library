import { z } from "zod";

const favoriteItemSchema = z.object({
  media_type: z.enum(["book", "movie"]).default("book"),
  canonical_title: z.string().trim().min(1).max(240),
  status: z.string().trim().optional(),
});

export const completeOnboardingFormSchema = z.object({
  accessToken: z.string().trim().min(1, "access token 必填"),
  username: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{3,20}$/, "username 只能使用 3-20 位小写字母、数字或下划线"),
  displayName: z.string().trim().max(80).optional(),
  avatarUrl: z.url().optional().or(z.literal("")),
  favorites: z.array(favoriteItemSchema).max(3).default([]),
});

export const onboardingImportFormSchema = z.object({
  accessToken: z.string().trim().min(1, "access token 必填"),
  importSource: z.enum(["csv", "mspf"]),
});

export type OnboardingActionState = {
  status: "idle" | "validation_error" | "config_error" | "db_error" | "completed";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof completeOnboardingFormSchema>, string[]>>;
  profileId?: string;
  username?: string;
  createdCount?: number;
};

export type ImportActionState = {
  status: "idle" | "validation_error" | "config_error" | "db_error" | "queued";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof onboardingImportFormSchema>, string[]>>;
  jobId?: string;
  source?: "csv" | "mspf";
};

export const initialOnboardingActionState: OnboardingActionState = {
  status: "idle",
};

export const initialImportActionState: ImportActionState = {
  status: "idle",
};
