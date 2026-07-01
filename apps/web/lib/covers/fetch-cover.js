// Client-side cover lookup for entries that have no stored cover_url.
// Searches the provider APIs (Google Books / OpenLibrary for books, TMDB for
// movies) by title via /api/search and returns the first candidate's cover.
// Purely external API calls — no database writes, works regardless of which
// Supabase the app points at. Promises are cached per title to dedupe.
const coverCache = new Map();

export function fetchCoverByTitle(title, mediaType) {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (!trimmed) return Promise.resolve(null);

  const type = mediaType === "movie" ? "movie" : "book";
  const key = `${type}:${trimmed}`;
  if (coverCache.has(key)) return coverCache.get(key);

  const promise = (async () => {
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&type=${type}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      const candidates = data.results?.candidates ?? data.results ?? [];
      return candidates.find((c) => c?.coverUrl)?.coverUrl ?? null;
    } catch {
      return null;
    }
  })();

  coverCache.set(key, promise);
  return promise;
}
