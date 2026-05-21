import { LibraryDashboardClient } from "@/components/domain/library-dashboard-client";

export default function LibraryPage() {
  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d2c4] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">
              P0 Task 16
            </p>
            <h1 className="mt-1 text-2xl font-semibold">我的库</h1>
          </div>
          <a className="text-sm font-medium text-[#315f53]" href="/dashboard">
            Dashboard
          </a>
        </header>

        <section className="grid gap-3">
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight">
            查看真实条目；没有条目时展示 P0 seed 推荐。
          </h2>
          <p className="max-w-3xl text-base leading-7 text-[#5f665f]">
            加载时会调用 authenticated RPC。只返回当前 profile 的 owner 数据，不读取 private
            notes。
          </p>
        </section>

        <LibraryDashboardClient mode="library" />
      </main>
    </div>
  );
}
