import { AuthCard } from "@/components/domain/auth-card";
import { ResetPasswordForm } from "@/components/domain/reset-password-form";

export const metadata = {
  title: "设置新密码 · 阅迹",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="设置新密码"
      subtitle="请输入你的新密码"
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
