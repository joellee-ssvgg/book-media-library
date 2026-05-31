import { cn } from "@/lib/utils";

function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("ink-card-soft flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="relative mb-5">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 scale-150 rounded-full bg-[radial-gradient(circle,hsl(202_51%_71%/0.4),transparent_70%)] blur-md"
          />
          <div className="grid size-16 place-items-center rounded-full border border-[var(--line)] bg-[linear-gradient(180deg,hsl(202_44%_95%),hsl(202_40%_88%))] text-[var(--blue)] shadow-sm">
            <Icon className="size-7" strokeWidth={1.6} />
          </div>
        </div>
      )}
      <h3 className="font-display text-2xl font-semibold text-[var(--ink)]">{title}</h3>
      {description && <p className="ink-subtitle mt-2 max-w-md text-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export { EmptyState };
