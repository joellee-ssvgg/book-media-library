export function firstUsableProfile(rows) {
  if (!Array.isArray(rows)) {
    return null;
  }

  return rows.find((profile) => typeof profile?.username === "string" && profile.username.length > 0) ?? null;
}
