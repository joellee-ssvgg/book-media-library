"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoverImage } from "@/components/domain/cover-image";
import {
  ArrowLeft,
  Globe,
  Lock,
  Link2,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { BookCover } from "@/components/domain/visual-system";
import { updateList, deleteList, removeListItem, reorderListItem } from "@/actions/lists";
import { cn } from "@/lib/utils";

const COVER_VARIANTS = ["cream", "navy", "blue", "gold", "forest", "red"];

function isPublicVis(v) {
  return v === "public" || v === "unlisted";
}

function Cover({ item, index }) {
  if (item.coverUrl) {
    return (
      <CoverImage
        src={item.coverUrl}
        sizes="(max-width: 768px) 45vw, 220px"
        className="aspect-[2/3] w-full rounded-md border border-border bg-muted shadow-sm"
      />
    );
  }
  return <BookCover title={item.title} variant={COVER_VARIANTS[index % COVER_VARIANTS.length]} className="aspect-[2/3] w-full" />;
}

export function ListDetailClient({ list, items }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description ?? "");
  const [visibility, setVisibility] = useState(isPublicVis(list.visibility) ? "public" : "private");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isPublic = isPublicVis(list.visibility);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await updateList(list.id, { title: title.trim(), description: description.trim(), visibility });
    setSaving(false);
    if (!res.error) {
      setEditing(false);
      router.refresh();
    }
  }

  async function remove(item) {
    setBusy(item.itemId);
    const res = await removeListItem(item.itemId, list.id);
    setBusy(null);
    if (!res.error) router.refresh();
  }

  async function move(index, dir) {
    const target = items[index + dir];
    if (!target) return;
    setBusy(items[index].itemId);
    const res = await reorderListItem(items[index].itemId, list.id, target.position);
    setBusy(null);
    if (!res.error) router.refresh();
  }

  async function doDelete() {
    setDeleting(true);
    const res = await deleteList(list.id);
    if (res.error) {
      setDeleting(false);
      return;
    }
    router.push("/lists");
  }

  function copyShare() {
    const url = `${window.location.origin}/l/${list.id}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const VisIcon = isPublic ? Globe : Lock;

  return (
    <div>
      <Link href="/lists" className="mb-6 inline-flex items-center gap-2 font-ui text-sm text-muted-foreground no-underline transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        返回清单
      </Link>

      {/* 头部 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="ink-eyebrow">LIST</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">{list.title}</h1>
          {list.description ? <p className="ink-subtitle mt-2 max-w-2xl text-sm">{list.description}</p> : null}
          <div className="mt-3 flex items-center gap-3 font-ui text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <VisIcon className="size-3.5" />
              {isPublic ? "公开" : "私密"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{items.length} 个条目</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isPublic ? (
            <button
              type="button"
              onClick={copyShare}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-ui text-sm text-primary transition-colors hover:bg-accent"
            >
              {copied ? <Check className="size-4" strokeWidth={2} /> : <Link2 className="size-4" />}
              {copied ? "已复制" : "分享链接"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-ui text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Pencil className="size-4" strokeWidth={1.8} />
            编辑
          </button>
          {confirmingDelete ? (
            <span className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={doDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--danger)] px-3 py-1.5 font-ui text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" strokeWidth={1.8} />}
                确认删除清单
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} className="font-ui text-sm text-muted-foreground hover:text-[var(--ink)]">
                取消
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              title="删除清单"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-ui text-sm text-muted-foreground transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
            >
              <Trash2 className="size-4" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* 编辑面板 */}
      {editing ? (
        <div className="ink-card mt-6 grid gap-4 p-5">
          <label className="grid gap-1.5">
            <span className="font-ui text-sm font-medium text-[var(--ink)]">清单名称</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="rounded-md border border-border bg-transparent px-3 py-2 font-ui text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="font-ui text-sm font-medium text-[var(--ink)]">说明（可选）</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              className="resize-none rounded-md border border-border bg-transparent px-3 py-2 font-ui text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="grid gap-1.5">
            <span className="font-ui text-sm font-medium text-[var(--ink)]">可见性</span>
            <div className="flex gap-2">
              {[
                { key: "private", label: "私密", icon: Lock },
                { key: "public", label: "公开", icon: Globe },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setVisibility(opt.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-ui text-sm transition-colors",
                    visibility === opt.key ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground hover:text-[var(--ink)]"
                  )}
                >
                  <opt.icon className="size-4" />
                  {opt.label}
                </button>
              ))}
            </div>
            {visibility === "public" ? (
              <p className="font-ui text-xs text-[var(--ink-faint)]">公开后，任何拿到链接的人都能查看这个清单。</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !title.trim()}
              className="ink-button inline-flex h-10 items-center gap-2 px-5 text-sm font-medium disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              保存
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="font-ui text-sm text-muted-foreground hover:text-[var(--ink)]">
              取消
            </button>
          </div>
        </div>
      ) : null}

      {/* 条目 */}
      <div className="mt-8">
        {items.length === 0 ? (
          <div className="ink-card grid place-items-center gap-3 px-6 py-16 text-center">
            <h2 className="font-display text-xl font-semibold text-[var(--ink)]">这个清单还是空的</h2>
            <p className="ink-subtitle text-sm">去图书库或影视库，点条目上的「清单」按钮把作品加进来。</p>
            <div className="mt-2 flex gap-3">
              <Link href="/library" className="ink-button inline-flex h-10 items-center px-5 text-sm font-medium no-underline">去图书库</Link>
              <Link href="/library/films" className="ink-button-outline inline-flex h-10 items-center px-5 text-sm font-medium no-underline">去影视库</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-6 gap-y-8">
            {items.map((item, index) => (
              <article key={item.itemId} className="group min-w-0">
                <Cover item={item} index={index} />
                <h3 className="mt-3 truncate font-display text-base font-semibold text-[var(--ink)]" title={item.title}>
                  {item.title}
                </h3>
                <p className="font-ui text-sm text-muted-foreground">
                  {item.mediaType === "movie" ? "影视" : "图书"}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || busy === item.itemId}
                    title="上移"
                    className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1 || busy === item.itemId}
                    title="下移"
                    className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={busy === item.itemId}
                    title="从清单移除"
                    className="ml-auto grid size-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-40"
                  >
                    {busy === item.itemId ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-4" />}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
