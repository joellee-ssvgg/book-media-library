import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "请输入邮箱")
  .email("请输入有效的邮箱地址");

const passwordSchema = z
  .string()
  .min(8, "密码至少需要 8 位")
  .max(72, "密码最多 72 位");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "请输入密码"),
  next: z.string().optional(),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export const initialAuthActionState = {
  status: "idle",
  message: "",
  fieldErrors: undefined,
};
