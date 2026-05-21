import { OnboardingForms } from "@/components/domain/onboarding-forms";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d2c4] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">
              P0 Task 14
            </p>
            <h1 className="mt-1 text-2xl font-semibold">60 秒 Onboarding</h1>
          </div>
          <a className="text-sm font-medium text-[#315f53]" href="/add/book">
            去添加书籍
          </a>
        </header>

        <section className="grid gap-3">
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight">
            设置公开身份后，选择 3 项起步或上传历史数据进入异步导入。
          </h2>
          <p className="max-w-3xl text-base leading-7 text-[#5f665f]">
            CSV/MSPF 不在页面内同步写库；提交后生成 owner-only import job，由 Task13 service runner 执行真实导入。
          </p>
        </section>

        <OnboardingForms />
      </main>
    </div>
  );
}
