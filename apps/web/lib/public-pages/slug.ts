const nonSlugCharacterPattern = /[^\p{Letter}\p{Number}]+/gu;
const duplicateDashPattern = /-+/g;

export function slugifyTitle(title: string) {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(nonSlugCharacterPattern, "-")
    .replace(duplicateDashPattern, "-")
    .replace(/^-|-$/g, "");

  return slug || "work";
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
