"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { privateNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const groupedNav = privateNavItems.reduce((groups, item) => {
  groups[item.group] = groups[item.group] ? [...groups[item.group], item] : [item];
  return groups;
}, {});

export function AppSidebar({ publicProfileHref }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen border-r border-border bg-background px-5 py-6 md:flex md:w-[240px] md:flex-col">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-full bg-muted text-sm font-medium text-foreground">
          J
        </div>
        <div>
          <p className="text-base font-medium">Joel Lee</p>
          <p className="text-xs text-muted-foreground">本地书房</p>
        </div>
      </div>

      <nav className="mt-10 grid gap-6" aria-label="私有区导航">
        {Object.entries(groupedNav).map(([group, items]) => (
          <div className="grid gap-1" key={group}>
            <p className="meta-label px-2 pb-1 text-[10px] text-muted-foreground">{group}</p>
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/library" && pathname.startsWith(item.href + "/"));

              return (
                <Link
                  className={cn(
                    "relative flex h-9 items-center gap-3 rounded-md px-2 text-sm text-muted-foreground no-underline transition duration-200 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-[#E7E8E7]/50 text-foreground before:absolute before:-left-5 before:h-7 before:w-[3px] before:rounded-full before:bg-[#2C6485]",
                  )}
                  href={item.href}
                  key={`${group}:${item.title}`}
                >
                  <Icon className="size-4 stroke-[1.5]" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto grid gap-2 border-t border-border pt-4">
        <Link className="flex items-center gap-2 text-sm text-muted-foreground no-underline transition-colors hover:text-primary" href={publicProfileHref}>
          <span>查看公开主页</span>
          <ExternalLink className="size-3.5" />
        </Link>
        <a className="flex items-center gap-2 text-sm text-muted-foreground no-underline transition-colors hover:text-destructive" href="/auth/sign-out">
          <LogOut className="size-3.5" />
          <span>退出登录</span>
        </a>
      </div>
    </aside>
  );
}
