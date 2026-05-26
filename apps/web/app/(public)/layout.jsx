import { PublicTopbar } from "@/components/layout/public-topbar";

export default async function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicTopbar rightHref="/auth/sign-in" rightLabel="登录" />
      {children}
    </div>
  );
}
