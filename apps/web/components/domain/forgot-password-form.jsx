"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/actions/auth";
import { initialAuthActionState } from "@/schemas/auth-email";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialAuthActionState
  );

  if (state.status === "success") {
    return (
      <div className="rounded-md bg-[#E7E8E7]/50 px-4 py-6 text-center">
        <p className="text-sm text-[#22303F]">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
        {state.fieldErrors?.email ? (
          <p className="text-xs text-red-600">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      {state.status !== "idle" && state.message ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "发送中…" : "发送重置链接"}
      </Button>
    </form>
  );
}
