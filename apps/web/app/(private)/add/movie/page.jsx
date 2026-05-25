import { MovieAddClient } from "@/components/domain/movie-add-client";
import { searchMovieCandidates } from "@/lib/movies/search";
function firstParam(value) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
export default async function AddMoviePage({ searchParams }) {
    const params = await searchParams;
    const query = firstParam(params.q).trim();
    const { candidates, notices } = await searchMovieCandidates(query);
    return (<div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d2c4] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">
              P0 Task 15
            </p>
            <h1 className="mt-1 text-2xl font-semibold">添加电影</h1>
          </div>
          <a className="text-sm font-medium text-[#315f53]" href="/add/book">
            添加书籍
          </a>
        </header>

        <section className="grid gap-3">
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight">
            搜索 TMDB，选择结果并设置你的初始观影状态和评分。
          </h2>
          <p className="max-w-3xl text-base leading-7 text-[#5f665f]">
            提交时会重新向 TMDB 拉取记录，再由数据库创建 movie work、默认 edition 和 user
            entry。
          </p>
        </section>

        <MovieAddClient candidates={candidates} notices={notices} query={query}/>
      </main>
    </div>);
}
