"use server";

import { revalidatePath } from "next/cache";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
};

export async function uploadAvatarAction(formData) {
  const file = formData.get("avatar");
  if (!file || typeof file === "string" || file.size === 0) {
    return { status: "error", message: "请选择一张图片。" };
  }
  if (!ALLOWED_TYPES[file.type]) {
    return { status: "error", message: "仅支持 JPG / PNG / WebP 格式。" };
  }
  if (file.size > MAX_BYTES) {
    return { status: "error", message: "图片不能超过 5MB。" };
  }

  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { status: "error", message: supabase.error };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "请先登录后再上传。" };
  }

  const path = `${user.id}/avatar`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) {
    return { status: "error", message: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .select("username")
    .maybeSingle();
  if (updateError) {
    return { status: "error", message: updateError.message };
  }

  if (updated?.username) {
    revalidatePath(`/u/${updated.username}`);
  }

  return { status: "uploaded", avatarUrl };
}
