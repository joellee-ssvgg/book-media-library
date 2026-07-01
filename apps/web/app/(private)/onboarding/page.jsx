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
            <h1 className="mt-1 text-2xl font-semibold">Onboarding</h1>
          </div>
          <a className="text-sm font-medium text-[#315f53]" href="/dashboard">
            返回 Dashboard
          </a>
        </header>

        <section className="grid gap-3">
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight">
            完成资料设置，并导入历史阅迹记录。
          </h2>
          <p className="max-w-3xl text-base leading-7 text-[#5f665f]">
            这里会调用真实 onboarding 和导入 RPC，不使用本地占位数据。
          </p>
        </section>

        <OnboardingForms />
      </main>
    </div>
  );
}
