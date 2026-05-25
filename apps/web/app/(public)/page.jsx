import { BookOpen, Eye, Lock, Film } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <section className="grid gap-12 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            建立你的私人阅迹
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            记录每一本读过的书、每一部看过的电影。默认私密，精选公开。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/auth/sign-in"
              className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-primary/90"
            >
              进入我的书房
            </a>
            <a
              href="/u/joel"
              className="inline-flex h-11 items-center rounded-md border border-border px-6 text-sm font-medium text-foreground no-underline transition-colors hover:bg-accent"
            >
              看看示例主页
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-lg font-medium">J</div>
            <div>
              <p className="font-medium">Joel Lee</p>
              <p className="text-sm text-muted-foreground">书影爱好者</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[2/3] rounded-md bg-muted" />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">精选 · 4 本书 · 6 部电影</p>
        </div>
      </section>

      <section className="mt-20 grid gap-8 sm:grid-cols-3">
        <ValueCard icon={Lock} title="默认私密" desc="你的阅读和观影记录只有自己能看到，安心记录。" />
        <ValueCard icon={BookOpen} title="书影归档" desc="图书和电影统一管理，进度、评分、笔记一站式记录。" />
        <ValueCard icon={Eye} title="精选展示" desc="挑选你最喜欢的作品，生成公开主页分享给朋友。" />
      </section>
    </div>
  );
}

function ValueCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <Icon className="size-6 text-primary" strokeWidth={1.5} />
      <h3 className="mt-3 font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
