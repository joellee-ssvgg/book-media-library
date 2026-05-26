"use client";

import { useActionState } from "react";
import { createListAction } from "@/actions/lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialCreateListActionState = {
  message: "",
  status: "idle",
};

export function CreateListForm() {
  const [state, formAction, pending] = useActionState(
    createListAction,
    initialCreateListActionState
  );

  return (
    <form action={formAction} className="mt-8 grid gap-5 border border-border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor="title">清单名称</Label>
        <Input id="title" name="title" required maxLength={80} autoFocus />
        {state.fieldErrors?.title ? (
          <p className="text-xs text-red-600">{state.fieldErrors.title[0]}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">说明</Label>
        <Input id="description" name="description" maxLength={200} />
        {state.fieldErrors?.description ? (
          <p className="text-xs text-red-600">{state.fieldErrors.description[0]}</p>
        ) : null}
      </div>
      {state.status !== "idle" && state.message ? (
        <p className="text-sm text-red-600">{state.message}</p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "创建中…" : "创建清单"}
        </Button>
      </div>
    </form>
  );
}
