export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b border-[#d8d2c4] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">
              P0
            </p>
            <h1 className="mt-1 text-2xl font-semibold">书影计划</h1>
          </div>
          <span className="text-sm text-[#6c675f]">Startup gate</span>
        </header>

        <section className="grid flex-1 content-center gap-6 py-12 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="max-w-xl text-4xl font-semibold leading-tight">
              书和电影的个人文化档案平台
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5f665f]">
              当前仓库处于 Task 01 启动门禁阶段。进入产品实现前，必须完成
              GitHub、Supabase、Vercel、环境变量与 CI 的真实接入。
            </p>
          </div>

          <div className="border border-[#d8d2c4] bg-[#fffdf8] p-5">
            <h3 className="text-sm font-medium text-[#5f665f]">当前门禁</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#6c675f]">GitHub private repo</dt>
                <dd className="font-medium">已创建</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#6c675f]">Supabase project</dt>
                <dd className="font-medium">待登录</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#6c675f]">Vercel project</dt>
                <dd className="font-medium">待登录</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#6c675f]">Environment secrets</dt>
                <dd className="font-medium">待提供</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </div>
  );
}
