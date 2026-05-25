import { DataSettingsClient } from "@/components/domain/data-settings-client";
export default function DataExportSettingsPage() {
    return (<div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto grid min-h-screen w-full max-w-6xl content-start gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d2c4] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">P0 Task 18</p>
            <h1 className="mt-1 text-2xl font-semibold">数据导出与注销</h1>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-medium text-[#315f53]">
            <a href="/library">我的库</a>
            <a href="/settings/public">公开主页设置</a>
          </div>
        </header>

        <section className="grid gap-3">
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight">
            导出 MSPF 后按双通道注销。
          </h2>
          <p className="max-w-3xl text-base leading-7 text-[#5f665f]">
            Export then delete 会先要求完成 MSPF job，再进入 30 天软删除；GDPR direct delete 会跳过导出并进入 24 小时冷静期。
          </p>
        </section>

        <DataSettingsClient />
      </main>
    </div>);
}
