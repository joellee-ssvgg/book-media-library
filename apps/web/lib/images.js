// Cover/avatar URLs can come from providers (TMDB, OpenLibrary, Google Books),
// OAuth metadata (GitHub avatars), Supabase storage, or arbitrary hosts via
// manual works and CSV imports. Only hosts listed here go through the
// next/image optimizer; everything else falls back to a plain <img> so an
// unknown host never crashes the page. Keep this list in sync with
// images.remotePatterns in next.config.mjs (both read from here).
export const optimizedImageHosts = [
    "image.tmdb.org",
    "covers.openlibrary.org",
    "books.google.com",
    "books.googleusercontent.com",
    "avatars.githubusercontent.com",
];
export function supabaseStorageHost(env = process.env) {
    try {
        return new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    }
    catch {
        return null;
    }
}
export function allOptimizedImageHosts(env = process.env) {
    const storageHost = supabaseStorageHost(env);
    return storageHost ? [...optimizedImageHosts, storageHost] : optimizedImageHosts;
}
// Returns an https-normalized src when the host is allowlisted for the
// next/image optimizer, otherwise null (callers render a plain <img>).
export function normalizeRemoteImageSrc(src, env = process.env) {
    if (typeof src !== "string" || src.length === 0) {
        return null;
    }
    let url;
    try {
        url = new URL(src);
    }
    catch {
        return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return null;
    }
    if (!allOptimizedImageHosts(env).includes(url.hostname)) {
        return null;
    }
    url.protocol = "https:";
    return url.toString();
}
