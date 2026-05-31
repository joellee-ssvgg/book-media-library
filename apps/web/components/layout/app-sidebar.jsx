"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { privateNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/domain/visual-system";

const groupedNav = privateNavItems.reduce((groups, item) => {
  groups[item.group] = groups[item.group] ? [...groups[item.group], item] : [item];
  return groups;
}, {});

export function AppSidebar({ publicProfileHref, displayName = "阅迹用户", avatarUrl = "" }) {
  const pathname = usePathname();
  const initial = displayName.trim().charAt(0).toUpperCase() || "阅";

  return (
    <aside className="sticky top-0 hidden h-screen overflow-hidden border-r border-border bg-background/82 px-6 py-8 md:flex md:w-[270px] md:flex-col">
      <Link
        href="/settings/public"
        className="flex items-center gap-4 rounded-md no-underline transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="编辑我的主页"
      >
        <ProfileAvatar src={avatarUrl || undefined} initial={initial} alt="头像" className="size-16 text-3xl" />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-semibold text-[var(--ink)]">{displayName}</p>
          <p className="font-ui text-sm text-muted-foreground">编辑我的主页</p>
        </div>
      </Link>

      <nav className="mt-12 grid gap-8" aria-label="私有区导航">
        {Object.entries(groupedNav).map(([group, items]) => (
          <div className="grid gap-1" key={group}>
            <p className="meta-label font-ui px-2 pb-2 text-sm text-muted-foreground">{group}</p>
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/library" && pathname.startsWith(item.href + "/"));

              return (
                <Link
                  className={cn(
                    "font-ui relative flex h-11 items-center gap-3 rounded-md px-3 text-base text-[var(--ink-soft)] no-underline transition duration-200 ease-out hover:bg-accent hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-accent text-primary before:absolute before:-left-6 before:h-9 before:w-1 before:rounded-full before:bg-primary",
                  )}
                  href={item.href}
                  key={`${group}:${item.title}`}
                >
                  <Icon className="size-5 stroke-[1.6]" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="ink-wash -left-12 bottom-0 h-56 w-80" aria-hidden="true" />

      <div className="z-10 mt-auto grid gap-3 border-t border-border pt-5">
        <Link className="font-ui flex items-center gap-2 text-sm text-muted-foreground no-underline transition-colors hover:text-primary" href={publicProfileHref}>
          <span>查看公开主页</span>
          <ExternalLink className="size-3.5" />
        </Link>
        <Link className="font-ui flex items-center gap-2 text-sm text-muted-foreground no-underline transition-colors hover:text-destructive" href="/auth/sign-out">
          <LogOut className="size-3.5" />
          <span>退出登录</span>
        </Link>
      </div>
    </aside>
  );
}
