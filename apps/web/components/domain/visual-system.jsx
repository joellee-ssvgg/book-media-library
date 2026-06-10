import { cn } from "@/lib/utils";
import { CoverImage } from "@/components/domain/cover-image";
import { PublicTopbar } from "@/components/layout/public-topbar";
import { privateNavItems } from "@/lib/navigation";

export { PublicTopbar, privateNavItems };

export function ProfileAvatar({ initial = "J", src, alt = "", className }) {
  return (
    <div className={cn("avatar-seal", src && "overflow-hidden", className)}>
      {src ? (
        <CoverImage src={src} alt={alt} sizes="80px" className="size-full rounded-full" />
      ) : (
        initial
      )}
    </div>
  );
}

export function BookCover({ title, variant = "navy", className }) {
  return (
    <div className={cn("book-cover", `cover-${variant}`, className)}>
      <span>{title}</span>
    </div>
  );
}

export function PanelTitle({ title, suffix, className }) {
  return (
    <div className={cn("flex items-baseline gap-3", className)}>
      <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">{title}</h2>
      {suffix ? (
        <span className="font-ui text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[var(--ink-faint)]">{suffix}</span>
      ) : null}
    </div>
  );
}

export function StatLine({ items }) {
  return (
    <div className="grid min-w-0 grid-cols-3 divide-x divide-border text-center md:text-left">
      {items.map((item) => (
        <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-3" key={item.label}>
          <p className="font-ui text-xs text-muted-foreground">{item.label}</p>
          <p className="font-display text-2xl font-semibold text-[var(--ink)]">
            {item.value}
            {item.unit ? <span className="ml-1 font-ui text-sm font-normal text-muted-foreground">{item.unit}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}
