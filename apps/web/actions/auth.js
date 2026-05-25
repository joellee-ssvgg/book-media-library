"use server";

import { redirect } from "next/navigation";
import { createCookieSupabaseClient, normalizeAuthNextPath } from "@/lib/supabase/auth";
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/schemas/auth-email";
import { headers } from "next/headers";

function toFieldErrors(result) {
  return result.success ? undefined : result.error.flatten().fieldErrors;
}

async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host");
  return `${proto}://${host}`;
}

export async function signInWithPasswordAction(_previousState, formData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "请检查输入的邮箱和密码。",
      fieldErrors: toFieldErrors(parsed),
    };
  }

  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { status: "config_error", message: supabase.error };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const message =
      error.message === "Invalid login credentials"
        ? "邮箱或密码不正确。"
        : error.message === "Email not confirmed"
          ? "请先到邮箱完成确认后再登录。"
          : error.message;
    return { status: "auth_error", message };
  }

  const next = normalizeAuthNextPath(parsed.data.next);
  redirect(next);
}

export async function signUpWithPasswordAction(_previousState, formData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "请检查输入的邮箱和密码。",
      fieldErrors: toFieldErrors(parsed),
    };
  }

  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { status: "config_error", message: supabase.error };
  }

  const origin = await getOrigin();
  const next = normalizeAuthNextPath(parsed.data.next);
  const redirectTo = new URL("/auth/confirm", origin);
  redirectTo.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: redirectTo.toString(),
    },
  });

  if (error) {
    const message =
      error.message === "User already registered"
        ? "该邮箱已注册，请直接登录或重置密码。"
        : error.message;
    return { status: "auth_error", message };
  }

  if (data.session) {
    redirect(next);
  }

  return {
    status: "success",
    message: "已发送确认邮件，请到邮箱中点击链接完成注册。",
  };
}

export async function forgotPasswordAction(_previousState, formData) {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "请输入有效的邮箱地址。",
      fieldErrors: toFieldErrors(parsed),
    };
  }

  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { status: "config_error", message: supabase.error };
  }

  const origin = await getOrigin();
  const redirectTo = new URL("/auth/confirm", origin);
  redirectTo.searchParams.set("next", "/auth/reset-password");

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: redirectTo.toString(),
  });

  if (error) {
    return { status: "auth_error", message: error.message };
  }

  return {
    status: "success",
    message: "如果该邮箱已注册，重置密码链接已发送到邮箱。",
  };
}

export async function resetPasswordAction(_previousState, formData) {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "请检查输入的密码。",
      fieldErrors: toFieldErrors(parsed),
    };
  }

  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { status: "config_error", message: supabase.error };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { status: "auth_error", message: error.message };
  }

  redirect("/dashboard");
}
