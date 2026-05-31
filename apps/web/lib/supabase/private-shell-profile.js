export function firstUsableProfile(rows) {
  if (!Array.isArray(rows)) {
    return null;
  }

  return rows.find((profile) => typeof profile?.username === "string" && profile.username.length > 0) ?? null;
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const UNIQUE_CONSTRAINT_CODE = "23505";
const MISSING_FUNCTION_CODE = "42883";
const ENSURE_PROFILE_RPC = "task22_ensure_current_profile";

function normalizeUsername(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fallbackUsernameFromUserId(user) {
  const idPart = String(user?.id ?? "").replace(/-/g, "").slice(0, 12);
  return `user_${idPart || "local0000000"}`.slice(0, 20);
}

export function buildFallbackUsername(user) {
  const metadata = user?.user_metadata ?? {};
  const emailName = typeof user?.email === "string" ? user.email.split("@")[0] : "";
  const raw = metadata.username ?? metadata.preferred_username ?? emailName;
  let username = normalizeUsername(raw);

  if (username.length > 20) {
    username = username.slice(0, 20).replace(/_+$/g, "");
  }

  if (!USERNAME_PATTERN.test(username)) {
    username = fallbackUsernameFromUserId(user);
  }

  return username;
}

export function usernameWithRetrySuffix(username, attempt) {
  if (attempt <= 0) {
    return username;
  }
  const suffix = `_${attempt}`;
  const maxStemLength = 20 - suffix.length;
  const stem = username.slice(0, maxStemLength).replace(/_+$/g, "");
  return `${stem.length >= 3 ? stem : username.slice(0, maxStemLength)}${suffix}`;
}

function isAuthUserIdConflict(error) {
  const message = String(error?.message ?? "");
  return error?.code === UNIQUE_CONSTRAINT_CODE && message.includes("auth_user_id");
}

function isUsernameConflict(error) {
  const message = String(error?.message ?? "");
  return error?.code === UNIQUE_CONSTRAINT_CODE && message.toLowerCase().includes("username");
}

function isMissingEnsureProfileRpc(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === MISSING_FUNCTION_CODE
    || (message.includes("could not find the function") && message.includes(ENSURE_PROFILE_RPC))
  );
}

function profileConflictError() {
  return new Error("登录成功，但这个账号已有不可用的用户资料。请先恢复账号资料，或换一个账号登录。");
}

async function ensurePrivateShellProfileViaRpc(supabase) {
  if (typeof supabase.rpc !== "function") {
    return null;
  }

  const { data, error } = await supabase.rpc(ENSURE_PROFILE_RPC);
  if (error) {
    if (isMissingEnsureProfileRpc(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  const profile = firstUsableProfile([data]);
  if (!profile) {
    throw new Error("登录成功，但用户资料恢复后无法读取。");
  }
  return profile;
}

async function selectPrivateShellProfile(supabase, authUserId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return firstUsableProfile(data);
}

async function insertPrivateShellProfile(supabase, user, username) {
  const metadata = user?.user_metadata ?? {};
  const payload = {
    auth_user_id: user.id,
    username,
    display_name: metadata.display_name ?? metadata.name ?? null,
    avatar_url: metadata.avatar_url ?? null,
  };

  const { data, error } = await supabase
    .from("profiles")
    .insert(payload)
    .select("username")
    .single();

  return { data, error };
}

export async function ensurePrivateShellProfile(supabase, user) {
  const rpcProfile = await ensurePrivateShellProfileViaRpc(supabase);
  if (rpcProfile) {
    return rpcProfile;
  }

  const existingProfile = await selectPrivateShellProfile(supabase, user.id);
  if (existingProfile) {
    return existingProfile;
  }

  const baseUsername = buildFallbackUsername(user);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username = usernameWithRetrySuffix(baseUsername, attempt);
    const { data, error } = await insertPrivateShellProfile(supabase, user, username);

    if (!error) {
      const profile = firstUsableProfile([data]);
      if (profile) {
        return profile;
      }
      const reselectedProfile = await selectPrivateShellProfile(supabase, user.id);
      if (reselectedProfile) {
        return reselectedProfile;
      }
      throw new Error("登录成功，但用户资料创建后无法读取。");
    }

    if (isAuthUserIdConflict(error)) {
      const reselectedProfile = await selectPrivateShellProfile(supabase, user.id);
      if (reselectedProfile) {
        return reselectedProfile;
      }
      throw profileConflictError();
    }

    if (!isUsernameConflict(error)) {
      throw new Error(error.message);
    }
  }

  throw new Error("登录成功，但无法生成可用的用户名。");
}
