import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";
import { ensurePrivateShellProfile } from "@/lib/supabase/private-shell-profile";

function resolveDisplayName(profileRow, user, username) {
  const candidates = [
    profileRow?.display_name,
    user?.user_metadata?.display_name,
    user?.user_metadata?.name,
    typeof user?.email === "string" ? user.email.split("@")[0] : null,
    username,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return "阅迹用户";
}

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

  const profile = await ensurePrivateShellProfile(supabase, user);

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("username", profile.username)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    username: profile.username,
    displayName: resolveDisplayName(profileRow, user, profile.username),
    avatarUrl: profileRow?.avatar_url ?? "",
  };
}

export default async function PrivateLayout({ children }) {
  const profile = await loadPrivateShellProfile();
  return (
    <AppShell
      publicProfileHref={`/u/${profile.username}`}
      displayName={profile.displayName}
      avatarUrl={profile.avatarUrl}
    >
      {children}
    </AppShell>
  );
}
