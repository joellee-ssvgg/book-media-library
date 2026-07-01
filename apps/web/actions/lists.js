"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

const VISIBILITY = ["private", "public"];

const createListSchema = z.object({
  title: z.string().trim().min(1, "请输入清单名称").max(80, "清单名称不能超过 80 个字"),
  description: z
    .string()
    .trim()
    .max(200, "清单说明不能超过 200 个字")
    .optional()
    .transform((value) => value || null),
  visibility: z.enum(VISIBILITY).catch("private"),
});

async function getClientAndUser() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    return { error: supabase.error };
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: "请先登录后再操作清单。" };
  }
  return { supabase };
}

export async function createListAction(_previousState, formData) {
  const parsed = createListSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    visibility: formData.get("visibility") ?? "private",
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors,
      message: fieldErrors.title?.[0] ?? fieldErrors.description?.[0] ?? "请检查清单信息。",
      status: "validation_error",
    };
  }

  const ctx = await getClientAndUser();
  if (ctx.error) {
    return { message: ctx.error, status: "auth_error" };
  }

  const { data, error } = await ctx.supabase
    .from("lists")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      visibility_scope: parsed.data.visibility,
    })
    .select("id")
    .single();

  if (error) {
    return { message: error.message, status: "database_error" };
  }

  redirect(`/lists/${data.id}`);
}

// 清单 + 该作品是否已在其中（驱动「加入清单」勾选弹层）
export async function loadListsForWork(workId) {
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error, lists: [] };

  const [{ data: lists }, { data: itemRows }] = await Promise.all([
    ctx.supabase
      .from("lists")
      .select("id, title, visibility_scope")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    workId
      ? ctx.supabase.from("list_items").select("list_id").eq("work_id", workId).is("deleted_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  const inLists = new Set((itemRows ?? []).map((r) => r.list_id));
  return {
    error: null,
    lists: (lists ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      visibility: l.visibility_scope,
      contains: inLists.has(l.id),
    })),
  };
}

export async function addWorkToList(listId, { entryId = null, workId }) {
  if (!listId || !workId) return { error: "缺少参数。" };
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error };

  // 已在清单里就不重复加
  const { data: existing } = await ctx.supabase
    .from("list_items")
    .select("id")
    .eq("list_id", listId)
    .eq("work_id", workId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return { error: null, already: true };

  // 下一个位置 = 当前最大 + 1
  const { data: last } = await ctx.supabase
    .from("list_items")
    .select("position")
    .eq("list_id", listId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? 0) + 1;

  const { error } = await ctx.supabase
    .from("list_items")
    .insert({ list_id: listId, entry_id: entryId, work_id: workId, position });
  if (error) return { error: error.message };

  revalidatePath(`/lists/${listId}`);
  return { error: null };
}

// 「加入清单」勾选弹层用：按 (listId, workId) 取消收藏
export async function removeWorkFromList(listId, workId) {
  if (!listId || !workId) return { error: "缺少参数。" };
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error };

  const { data: item } = await ctx.supabase
    .from("list_items")
    .select("id")
    .eq("list_id", listId)
    .eq("work_id", workId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!item) return { error: null };

  const { error } = await ctx.supabase.rpc("task34_soft_delete_list_item", { input_item_id: item.id });
  if (error) return { error: error.message };

  revalidatePath(`/lists/${listId}`);
  return { error: null };
}

// 新建一个私密清单并立即把作品加进去（弹层里的「新建清单」）
export async function quickCreateListWithWork(title, { entryId = null, workId }) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) return { error: "请输入清单名称。" };
  if (trimmed.length > 80) return { error: "清单名称不能超过 80 个字。" };
  if (!workId) return { error: "缺少作品。" };
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error };

  const { data: list, error: listError } = await ctx.supabase
    .from("lists")
    .insert({ title: trimmed, visibility_scope: "private" })
    .select("id")
    .single();
  if (listError) return { error: listError.message };

  const { error: itemError } = await ctx.supabase
    .from("list_items")
    .insert({ list_id: list.id, entry_id: entryId, work_id: workId, position: 1 });
  if (itemError) return { error: itemError.message };

  revalidatePath("/lists");
  return { error: null, listId: list.id, title: trimmed };
}

export async function removeListItem(itemId, listId) {
  if (!itemId) return { error: "缺少参数。" };
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error };

  const { data, error } = await ctx.supabase.rpc("task34_soft_delete_list_item", { input_item_id: itemId });
  if (error) return { error: error.message };
  if (listId) revalidatePath(`/lists/${listId}`);
  return { error: null, data };
}

const updateListSchema = z.object({
  title: z.string().trim().min(1, "请输入清单名称").max(80, "清单名称不能超过 80 个字").optional(),
  description: z.string().trim().max(200, "清单说明不能超过 200 个字").nullish(),
  visibility: z.enum(VISIBILITY).optional(),
});

export async function updateList(listId, patch) {
  if (!listId) return { error: "缺少参数。" };
  const parsed = updateListSchema.safeParse(patch);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.title?.[0] ?? "请检查清单信息。" };
  }
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error };

  const update = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) update.description = parsed.data.description || null;
  if (parsed.data.visibility !== undefined) update.visibility_scope = parsed.data.visibility;
  if (Object.keys(update).length === 0) return { error: null };

  const { error } = await ctx.supabase.from("lists").update(update).eq("id", listId);
  if (error) return { error: error.message };

  revalidatePath(`/lists/${listId}`);
  revalidatePath("/lists");
  return { error: null };
}

export async function reorderListItem(itemId, listId, newPosition) {
  if (!itemId || !newPosition) return { error: "缺少参数。" };
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error };

  // position 有 (list_id, position) 唯一约束：和占位的那条交换，中间先挪到临时大数
  const { data: occupant } = await ctx.supabase
    .from("list_items")
    .select("id")
    .eq("list_id", listId)
    .eq("position", newPosition)
    .is("deleted_at", null)
    .maybeSingle();
  const { data: moving } = await ctx.supabase
    .from("list_items")
    .select("position")
    .eq("id", itemId)
    .maybeSingle();
  if (!moving) return { error: "条目不存在。" };

  if (occupant) {
    await ctx.supabase.from("list_items").update({ position: 1000000 }).eq("id", occupant.id);
    await ctx.supabase.from("list_items").update({ position: newPosition }).eq("id", itemId);
    await ctx.supabase.from("list_items").update({ position: moving.position }).eq("id", occupant.id);
  } else {
    await ctx.supabase.from("list_items").update({ position: newPosition }).eq("id", itemId);
  }

  revalidatePath(`/lists/${listId}`);
  return { error: null };
}

export async function deleteList(listId) {
  if (!listId) return { error: "缺少参数。" };
  const ctx = await getClientAndUser();
  if (ctx.error) return { error: ctx.error };

  const { error } = await ctx.supabase.rpc("task34_soft_delete_list", { input_list_id: listId });
  if (error) return { error: error.message };

  revalidatePath("/lists");
  return { error: null };
}
