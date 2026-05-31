import Link from "next/link";

export function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="ink-wash left-0 top-28 h-80 w-[34rem]" aria-hidden="true" />
      <Link
        href="/"
        className="font-display z-10 mb-8 text-4xl font-bold text-[var(--ink)] no-underline"
      >
        阅迹
      </Link>
      <div className="ink-card z-10 w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-semibold text-[var(--ink)]">{title}</h1>
          {subtitle ? (
            <p className="ink-subtitle mt-2 text-sm">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </div>
      {footer ? (
        <div className="z-10 mt-6 font-ui text-sm text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}
