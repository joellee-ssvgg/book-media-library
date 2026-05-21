import { PublicProfileSettingsForm } from "@/components/domain/public-profile-settings-form";

export default function PublicSettingsPage() {
  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto grid min-h-screen w-full max-w-5xl content-start gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d2c4] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">P0 Task 17</p>
            <h1 className="mt-1 text-2xl font-semibold">公开主页设置</h1>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-medium text-[#315f53]">
            <a href="/library">我的库</a>
            <a href="/settings/data/export">数据导出</a>
          </div>
        </header>

        <section className="grid gap-3">
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight">
            保存公开主页可见性与 Top-3。
          </h2>
          <p className="max-w-3xl text-base leading-7 text-[#5f665f]">
            Top-3 条目会切到 public，并公开状态、评分、短评、完成时间；private notes 不会进入公开响应。
          </p>
        </section>

        <PublicProfileSettingsForm />
      </main>
    </div>
  );
}
