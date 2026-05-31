import Link from "next/link";
import { AuthCard } from "@/components/domain/auth-card";
import { SignInForm } from "@/components/domain/sign-in-form";
import { normalizeAuthNextPath } from "@/lib/supabase/auth";

export const metadata = {
  title: "登录 · 阅迹",
};

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  const next = normalizeAuthNextPath(typeof params?.next === "string" ? params.next : "");

  return (
    <AuthCard
      title="登录到阅迹"
      subtitle="记录你的阅读与观影"
      footer={
        <>
          还没有账号？{" "}
          <Link
            href={next ? `/auth/sign-up?next=${encodeURIComponent(next)}` : "/auth/sign-up"}
            className="font-medium text-primary hover:underline"
          >
            创建账号
          </Link>
        </>
      }
    >
      <SignInForm next={next} error={typeof params?.error === "string" ? params.error : ""} />
    </AuthCard>
  );
}
