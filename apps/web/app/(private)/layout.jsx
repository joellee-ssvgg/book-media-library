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

  // proxy.js already refreshed the session for this request, so the JWT can be
  // verified locally (JWKS) without another round trip to the auth server.
  const { data, error: authError } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (authError || !claims?.sub) {
    redirect("/auth/sign-in");
  }

  const user = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    user_metadata: claims.user_metadata ?? {},
  };

  const profile = await ensurePrivateShellProfile(supabase, user);

  return {
    username: profile.username,
    displayName: resolveDisplayName(profile, user, profile.username),
    avatarUrl: profile.avatar_url ?? "",
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
