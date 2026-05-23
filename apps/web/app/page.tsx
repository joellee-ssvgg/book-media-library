import { ManualWorkForm } from "@/components/domain/manual-work-form";
import { createCookieSupabaseClient } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createCookieSupabaseClient();
  const userResult =
    "error" in supabase
      ? { user: null }
      : await supabase.auth.getUser().then(
          ({ data, error }) => ({ user: error ? null : data.user }),
          () => ({ user: null }),
        );

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#1f2423]">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d2c4] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#6c675f]">
              P0
            </p>
            <h1 className="mt-1 text-2xl font-semibold">书影库</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <nav className="flex flex-wrap gap-4 text-sm font-medium text-[#315f53]">
              <a href="/onboarding">Onboarding</a>
              <a href="/library">我的库</a>
              <a href="/dashboard">Dashboard</a>
              <a href="/settings/public">公开设置</a>
              <a href="/add/book">添加书籍</a>
              <a href="/add/movie">添加电影</a>
            </nav>
            {userResult.user ? (
              <form action="/auth/sign-out" method="POST">
                <button
                  className="h-10 border border-[#315f53] px-4 text-sm font-medium text-[#315f53]"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            ) : (
              <a
                className="inline-flex h-10 items-center bg-[#1f3d35] px-4 text-sm font-medium text-white"
                href="/auth/sign-in"
              >
                Sign in
              </a>
            )}
          </div>
        </header>

        <section className="grid flex-1 gap-8 py-8 lg:grid-cols-[0.9fr_1.4fr]">
          <div>
            <h2 className="max-w-lg text-3xl font-semibold leading-tight">
              登录后开始你的书影库验收流程
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#5f665f]">
              GitHub OAuth 会创建 Supabase 用户和 profile，随后可以完成 onboarding、添加书籍电影、导出与删除数据。
            </p>

            <div className="mt-8 grid gap-3 border-t border-[#d8d2c4] pt-5 text-sm">
              <div className="grid grid-cols-[120px_1fr] gap-4">
                <span className="text-[#6c675f]">创建范围</span>
                <span>书 / 电影</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-4">
                <span className="text-[#6c675f]">去重阈值</span>
                <span>标题 trigram &gt;= 0.85，年份 +/- 1</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-4">
                <span className="text-[#6c675f]">写入权限</span>
                <span>authenticated + RLS</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-4">
                <span className="text-[#6c675f]">默认可见性</span>
                <span>global_public</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-4">
                <span className="text-[#6c675f]">当前身份</span>
                <span>{userResult.user?.email ?? "未登录"}</span>
              </div>
            </div>
          </div>

          <div className="border border-[#d8d2c4] bg-[#fffdf8] p-5">
            <h3 className="mb-5 text-base font-semibold">手动创建作品</h3>
            <ManualWorkForm />
          </div>
        </section>
      </main>
    </div>
  );
}
