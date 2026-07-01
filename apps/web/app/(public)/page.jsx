import Link from "next/link";
import { BookOpen, Globe2, LockKeyhole, PencilLine, Search, SquareArrowOutUpRight } from "lucide-react";

const features = [
  {
    icon: LockKeyhole,
    title: "私人记录",
    desc: "你的阅读与观影，默认仅你可见。在专属空间里，安心记录每一次触动。",
  },
  {
    icon: BookOpen,
    title: "阅迹归档",
    desc: "书籍、电影、笔记与想法统一收纳。清晰整理，随时回顾与发现。",
  },
  {
    icon: Globe2,
    title: "选择性公开",
    desc: "精选内容，生成你的公开主页。与同好分享，连接更多共鸣。",
  },
];

const workflow = [
  { icon: Search, title: "搜索添加", desc: "搜书搜影，一键添加" },
  { icon: BookOpen, title: "记录进度", desc: "记录状态与感受" },
  { icon: PencilLine, title: "留下痕迹", desc: "写下笔记与想法" },
  { icon: SquareArrowOutUpRight, title: "选择公开", desc: "生成主页，分享共鸣" },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="ink-wash left-0 top-44 h-80 w-[36rem]" aria-hidden="true" />

      <section className="page-frame relative flex min-h-[440px] min-w-0 flex-col items-center justify-center gap-8 py-20 text-center md:py-28">
        <div className="relative z-10 min-w-0">
          <p className="ink-eyebrow">LOCAL LIBRARY</p>
          <h1 className="ink-title mt-6">
            <span className="block sm:inline">建立你的私人</span>
            <span className="block sm:inline">阅迹库</span>
          </h1>
          <p className="ink-subtitle mx-auto mt-7 max-w-xl text-lg">
            记录阅读、观影和那些愿意留下来的时刻。
            <br />
            默认私密，选择性公开。
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4 sm:gap-5">
            <Link href="/dashboard" className="ink-button inline-flex h-14 min-w-36 items-center justify-center px-6 text-base font-medium no-underline sm:min-w-40 sm:px-8">
              开始使用
            </Link>
          </div>
        </div>
      </section>

      <section className="page-frame grid gap-6 py-0">
        <div className="ink-card grid gap-6 p-6 md:grid-cols-3 md:p-7">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="grid gap-3 md:grid-cols-[68px_1fr]" key={feature.title}>
                <div className="grid size-16 place-items-center rounded-full bg-accent text-primary">
                  <Icon className="size-7" strokeWidth={1.7} />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">{feature.title}</h2>
                  <p className="ink-subtitle mt-1 text-sm">{feature.desc}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="ink-card-soft grid gap-5 p-5 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
          {workflow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div className="contents" key={step.title}>
                <article className="grid grid-cols-[52px_1fr] items-center gap-4">
                  <div className="grid size-12 place-items-center rounded-full bg-accent text-primary">
                    <Icon className="size-6" strokeWidth={1.7} />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-[var(--ink)]">{step.title}</h3>
                    <p className="font-ui text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </article>
                {index < workflow.length - 1 ? <span className="hidden text-3xl text-primary/70 md:block">→</span> : null}
              </div>
            );
          })}
        </div>

        <p className="pb-3 text-center font-ui text-sm text-muted-foreground">阅迹 · 你的私人阅迹库</p>
      </section>
    </main>
  );
}
