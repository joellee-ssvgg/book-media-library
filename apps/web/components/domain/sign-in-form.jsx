"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { signInWithPasswordAction } from "@/actions/auth";
import { initialAuthActionState } from "@/schemas/auth-email";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function GithubIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-1.93c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.19 1.18A11.1 11.1 0 0 1 12 6.83c.99.005 1.99.135 2.92.4 2.22-1.49 3.19-1.18 3.19-1.18.62 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.35.78 1.05.78 2.12v3.14c0 .3.21.66.8.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export function SignInForm({ next = "" }) {
  const [state, formAction, pending] = useActionState(
    signInWithPasswordAction,
    initialAuthActionState
  );
  const redirectingRef = useRef(false);
  const isRedirecting = state.status === "success";

  useEffect(() => {
    if (!isRedirecting || !state.redirectTo || redirectingRef.current) {
      return;
    }

    redirectingRef.current = true;
    window.location.replace(state.redirectTo);
  }, [isRedirecting, state.redirectTo]);

  const oauthHref = next
    ? `/auth/oauth/github?next=${encodeURIComponent(next)}`
    : "/auth/oauth/github";

  return (
    <div className="space-y-4">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">密码</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-[#2C6485] hover:underline"
            >
              忘记密码？
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {state.fieldErrors?.password ? (
            <p className="text-xs text-red-600">{state.fieldErrors.password[0]}</p>
          ) : null}
        </div>

        {state.status !== "idle" && state.status !== "success" && state.message ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {state.message}
          </p>
        ) : null}

        {isRedirecting && state.message ? (
          <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending || isRedirecting}>
          {isRedirecting ? "进入中…" : pending ? "登录中…" : "登录"}
        </Button>
      </form>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#E7E8E7]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-[#394A56]/60">或</span>
        </div>
      </div>

      <a
        href={oauthHref}
        className="inline-flex w-full h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <GithubIcon className="size-4" />
        <span>用 GitHub 登录</span>
      </a>
    </div>
  );
}
