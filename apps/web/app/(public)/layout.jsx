import { redirect } from "next/navigation";
import { PublicTopbar } from "@/components/layout/public-topbar";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

export default async function PublicLayout({ children }) {
  const supabase = await createCookieSupabaseClient();
  let user = null;
  if (!("error" in supabase)) {
    const result = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    user = result.data.user;
  }
  if (user) {
    redirect("/dashboard");
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicTopbar rightHref="/auth/sign-in" rightLabel="登录" />
      {children}
    </div>
  );
}
