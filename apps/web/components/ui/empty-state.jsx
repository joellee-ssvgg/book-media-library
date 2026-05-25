import { cn } from "@/lib/utils";

function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center", className)}>
      {Icon && <Icon className="mb-3 h-10 w-10 text-muted-foreground/50" strokeWidth={1.5} />}
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { EmptyState };
