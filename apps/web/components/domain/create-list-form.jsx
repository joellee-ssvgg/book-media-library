"use client";

import { useActionState, useState } from "react";
import { Globe, Lock } from "lucide-react";
import { createListAction } from "@/actions/lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const initialCreateListActionState = {
  message: "",
  status: "idle",
};

const VISIBILITY_OPTIONS = [
  { key: "private", label: "私密", icon: Lock },
  { key: "public", label: "公开", icon: Globe },
];

export function CreateListForm({ defaultTitle = "" }) {
  const [state, formAction, pending] = useActionState(createListAction, initialCreateListActionState);
  const [visibility, setVisibility] = useState("private");

  return (
    <form action={formAction} className="mt-8 grid gap-5 rounded-md border border-border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor="title">清单名称</Label>
        <Input id="title" name="title" required maxLength={80} autoFocus defaultValue={defaultTitle} />
        {state.fieldErrors?.title ? <p className="text-xs text-red-600">{state.fieldErrors.title[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">说明</Label>
        <Input id="description" name="description" maxLength={200} />
        {state.fieldErrors?.description ? <p className="text-xs text-red-600">{state.fieldErrors.description[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>可见性</Label>
        <input type="hidden" name="visibility" value={visibility} />
        <div className="flex gap-2">
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setVisibility(opt.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-ui text-sm transition-colors",
                visibility === opt.key
                  ? "border-primary bg-accent text-primary"
                  : "border-border text-muted-foreground hover:text-[var(--ink)]"
              )}
            >
              <opt.icon className="size-4" />
              {opt.label}
            </button>
          ))}
        </div>
        {visibility === "public" ? (
          <p className="font-ui text-xs text-muted-foreground">公开后，任何拿到链接的人都能查看这个清单。</p>
        ) : null}
      </div>
      {state.status !== "idle" && state.message ? <p className="text-sm text-red-600">{state.message}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "创建中…" : "创建清单"}
        </Button>
      </div>
    </form>
  );
}
