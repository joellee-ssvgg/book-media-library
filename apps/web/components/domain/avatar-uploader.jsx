"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { uploadAvatarAction } from "@/actions/avatar";
import { ProfileAvatar } from "@/components/domain/visual-system";

export function AvatarUploader({ initialSrc, initial = "阅" }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [src, setSrc] = useState(initialSrc || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setError("");
    setPending(true);
    const formData = new FormData();
    formData.append("avatar", file);
    const result = await uploadAvatarAction(formData);
    setPending(false);
    if (result.status === "uploaded") {
      setSrc(result.avatarUrl);
      router.refresh();
    } else {
      setError(result.message || "上传失败，请重试。");
    }
  }

  return (
    <div className="grid place-items-start gap-2 md:place-items-center">
      <div className="relative">
        <ProfileAvatar src={src || undefined} initial={initial} alt="头像" className="size-24 text-5xl" />
        {pending ? (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-[var(--ink)]/45">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="font-ui text-sm font-medium text-primary hover:underline disabled:opacity-60"
      >
        {pending ? "上传中…" : src ? "更换头像" : "上传头像"}
      </button>
      <p className="font-ui text-xs text-muted-foreground">支持 JPG / PNG / WebP，不超过 5MB</p>
      {error ? <p className="font-ui text-xs text-[var(--danger)]">{error}</p> : null}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}
