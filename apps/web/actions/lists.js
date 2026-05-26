"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

const createListSchema = z.object({
  title: z.string().trim().min(1, "请输入清单名称").max(80, "清单名称不能超过 80 个字"),
  description: z
    .string()
    .trim()
    .max(200, "清单说明不能超过 200 个字")
    .optional()
    .transform((value) => value || null),
});

export async function createListAction(_previousState, formData) {
  const parsed = createListSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors,
      message: fieldErrors.title?.[0] ?? fieldErrors.description?.[0] ?? "请检查清单信息。",
      status: "validation_error",
    };
  }

  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { message: supabase.error, status: "config_error" };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { message: "请先登录后再创建清单。", status: "auth_error" };
  }

  const { data, error } = await supabase
    .from("lists")
    .insert({
      description: parsed.data.description,
      title: parsed.data.title,
      visibility_scope: "private",
    })
    .select("id")
    .single();

  if (error) {
    return { message: error.message, status: "database_error" };
  }

  redirect(`/lists/${data.id}`);
}
