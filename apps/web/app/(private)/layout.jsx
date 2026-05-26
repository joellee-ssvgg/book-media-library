import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";
import { firstUsableProfile } from "@/lib/supabase/private-shell-profile";

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
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const profile = firstUsableProfile(data);
  if (!profile) {
    redirect("/auth/sign-out");
  }

  return profile;
}

export default async function PrivateLayout({ children }) {
  const profile = await loadPrivateShellProfile();
  return <AppShell publicProfileHref={`/u/${profile.username}`}>{children}</AppShell>;
}
