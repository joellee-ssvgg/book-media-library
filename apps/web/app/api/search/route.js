import { searchBookCandidates } from "@/lib/books/search";
import { searchMovieCandidates } from "@/lib/movies/search";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") || "book";

  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  try {
    const results = type === "movie"
      ? await searchMovieCandidates(q)
      : await searchBookCandidates(q);
    return Response.json({ results });
  } catch {
    return Response.json({ results: [], error: "搜索失败" }, { status: 500 });
  }
}
