import Link from "next/link";

export function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-[#F7F8F7] flex flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-6 text-lg font-semibold text-[#22303F] tracking-tight"
      >
        阅迹
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-[#E7E8E7] bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-[#22303F]">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-[#394A56]/70">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </div>
      {footer ? (
        <div className="mt-6 text-sm text-[#394A56]/70">{footer}</div>
      ) : null}
    </div>
  );
}
