import { PublicTopbar } from "@/components/layout/public-topbar";

export default async function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicTopbar rightHref="/dashboard" rightLabel="进入阅迹" />
      {children}
    </div>
  );
}
