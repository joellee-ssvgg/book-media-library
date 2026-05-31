import Link from "next/link";

export function PublicTopbar({ rightHref = "/auth/sign-in", rightLabel = "进入阅迹" }) {
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-3 border-b border-border bg-background/82 px-4 backdrop-blur-md sm:h-[86px] md:px-14">
      <Link href="/" className="shrink-0 font-display text-3xl font-bold text-[var(--ink)] no-underline md:text-4xl">
        阅迹
      </Link>
      <nav className="flex min-w-0 items-center justify-end gap-3 font-ui text-sm text-[var(--ink)] md:gap-8" aria-label="公开导航">
        <Link href={rightHref} className="ink-button hidden h-11 shrink-0 items-center px-5 text-sm font-medium no-underline sm:inline-flex md:px-7">
          {rightLabel}
        </Link>
      </nav>
    </header>
  );
}
