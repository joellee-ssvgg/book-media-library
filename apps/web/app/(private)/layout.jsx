import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

async function loadPrivateShellProfile() {
  const supabase = await createCookieSupabaseClient();
  if ("error" in supabase) {
    redirect("/auth/sign-in");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/auth/sign-in");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !data?.username) {
    throw new Error(error?.message ?? "Authenticated profile username is missing.");
  }

  return data;
}

export default async function PrivateLayout({ children }) {
  const profile = await loadPrivateShellProfile();
  return <AppShell publicProfileHref={`/u/${profile.username}`}>{children}</AppShell>;
}
