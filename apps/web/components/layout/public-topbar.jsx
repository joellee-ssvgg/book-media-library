import Link from "next/link";

export function PublicTopbar({ rightHref = "/auth/sign-in", rightLabel = "登录" }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <Link href="/" className="text-base font-semibold text-foreground no-underline">
        阅迹
      </Link>
      <a
        href={rightHref}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-primary/90"
      >
        {rightLabel}
      </a>
    </header>
  );
}
