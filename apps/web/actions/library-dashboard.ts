"use server";

import { createActionSupabase } from "@/lib/supabase/server";
import {
  loadLibraryDashboardFormSchema,
  type LibraryDashboardActionState,
  type LibraryDashboardData,
} from "@/schemas/library-dashboard";

function toFieldErrors(result: ReturnType<typeof loadLibraryDashboardFormSchema.safeParse>) {
  return result.success ? undefined : result.error.flatten().fieldErrors;
}

export async function loadLibraryDashboardAction(
  previousState: LibraryDashboardActionState,
  formData: FormData,
): Promise<LibraryDashboardActionState> {
  const parsed = loadLibraryDashboardFormSchema.safeParse({
    accessToken: formData.get("accessToken"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "加载我的库需要先登录。",
      fieldErrors: toFieldErrors(parsed),
      data: previousState.data,
    };
  }

  const supabase = await createActionSupabase(parsed.data.accessToken);

  if ("error" in supabase) {
    return {
      status: "config_error",
      message: supabase.error,
      data: previousState.data,
    };
  }

  const { data, error } = await supabase.client.rpc<LibraryDashboardData>(
    "task16_get_library_dashboard",
  );

  if (error) {
    return {
      status: "db_error",
      message: error.message,
      data: previousState.data,
    };
  }

  if (!data) {
    return {
      status: "db_error",
      message: "task16_get_library_dashboard 没有返回结果。",
      data: previousState.data,
    };
  }

  return {
    status: "loaded",
    message: data.use_seed ? "当前没有真实条目，已显示 P0 seed。" : "已加载真实库数据。",
    data,
  };
}
