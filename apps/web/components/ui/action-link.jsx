import Link from "next/link";
import { cn } from "@/lib/utils";

function ActionLink({ href, className, children, ...props }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export { ActionLink };
