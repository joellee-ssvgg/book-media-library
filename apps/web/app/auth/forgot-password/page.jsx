import Link from "next/link";
import { AuthCard } from "@/components/domain/auth-card";
import { ForgotPasswordForm } from "@/components/domain/forgot-password-form";

export const metadata = {
  title: "重置密码 · 阅迹",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="重置密码"
      subtitle="输入你的邮箱，我们会发送重置密码链接"
      footer={
        <Link href="/auth/sign-in" className="text-[#2C6485] hover:underline">
          返回登录
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
