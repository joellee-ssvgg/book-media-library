import Link from "next/link";
import { AuthCard } from "@/components/domain/auth-card";
import { SignUpForm } from "@/components/domain/sign-up-form";

export const metadata = {
  title: "注册 · 阅迹",
};

export default async function SignUpPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params?.next === "string" ? params.next : "";

  return (
    <AuthCard
      title="创建你的阅迹账号"
      subtitle="默认私密，由你决定要展示什么"
      footer={
        <>
          已有账号？{" "}
          <Link
            href={next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in"}
            className="font-medium text-primary hover:underline"
          >
            登录
          </Link>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthCard>
  );
}
