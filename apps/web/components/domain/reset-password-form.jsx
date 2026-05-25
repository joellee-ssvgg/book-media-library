"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/actions/auth";
import { initialAuthActionState } from "@/schemas/auth-email";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialAuthActionState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">新密码</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-[#394A56]/60">至少 8 位</p>
        {state.fieldErrors?.password ? (
          <p className="text-xs text-red-600">{state.fieldErrors.password[0]}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">确认新密码</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
        {state.fieldErrors?.confirmPassword ? (
          <p className="text-xs text-red-600">
            {state.fieldErrors.confirmPassword[0]}
          </p>
        ) : null}
      </div>

      {state.status !== "idle" && state.status !== "success" && state.message ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "更新中…" : "更新密码"}
      </Button>
    </form>
  );
}
