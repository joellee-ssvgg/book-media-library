"use client";

import { useActionState } from "react";
import { signUpWithPasswordAction } from "@/actions/auth";
import { initialAuthActionState } from "@/schemas/auth-email";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SignUpForm({ next = "" }) {
  const [state, formAction, pending] = useActionState(
    signUpWithPasswordAction,
    initialAuthActionState
  );

  if (state.status === "success") {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-md bg-[#E7E8E7]/50 px-4 py-6">
          <p className="text-sm text-[#22303F] font-medium">{state.message}</p>
          <p className="mt-2 text-xs text-[#394A56]/70">
            没收到邮件？请检查垃圾邮件，或几分钟后再试。
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
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
      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
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

      {state.status !== "idle" && state.message ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "创建中…" : "创建账号"}
      </Button>
    </form>
  );
}
