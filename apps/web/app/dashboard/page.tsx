import { LibraryDashboardClient } from "@/components/domain/library-dashboard-client";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d2c4] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">
              P0 Task 16
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
          </div>
          <a className="text-sm font-medium text-[#315f53]" href="/library">
            我的库
          </a>
        </header>

        <section className="grid gap-3">
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight">
            继续阅读、最近完成、停滞条目、热力图占位和年度环。
          </h2>
          <p className="max-w-3xl text-base leading-7 text-[#5f665f]">
            0 entry 显示 P0 seed；加载到真实条目后，Dashboard 模块切换到当前 profile 的数据。
          </p>
        </section>

        <LibraryDashboardClient mode="dashboard" />
      </main>
    </div>
  );
}
