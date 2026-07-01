import Link from "next/link";
import { MovieAddClient } from "@/components/domain/movie-add-client";
import { searchMovieCandidates } from "@/lib/movies/search";
import { SectionHeader } from "@/components/ui/section-header";

function firstParam(value) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AddMoviePage({ searchParams }) {
    const params = await searchParams;
    const query = firstParam(params.q).trim();
    const { candidates, notices } = await searchMovieCandidates(query);
    return (
      <div className="page-frame">
        <SectionHeader
          eyebrow="ADD FILM"
          title="添加电影"
          action={
            <Link href="/library/films" className="font-ui text-sm font-medium text-primary hover:underline">
              返回影视库
            </Link>
          }
        />
        <p className="ink-subtitle mt-3 max-w-2xl text-sm">
          详细添加：搜索 TMDB 后可为每个结果单独设置初始观影状态和评分，再加入你的库。只想快速添加，可用顶部的搜索弹窗。
        </p>
        <div className="mt-8">
          <MovieAddClient candidates={candidates} notices={notices} query={query} />
        </div>
      </div>
    );
}
