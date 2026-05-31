"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, LayoutDashboard, ListPlus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";

const tabs = [
  { label: "书桌", href: "/dashboard", icon: LayoutDashboard },
  { label: "图书", href: "/library", icon: BookOpen },
  { label: "快记", href: "/add/book", icon: Plus, isAdd: true },
  { label: "清单", href: "/lists", icon: ListPlus },
  { label: "主页", href: "/settings/public", icon: Home },
];

function MobileBottomTab() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/92 px-2 shadow-[0_-12px_30px_rgba(8,38,74,0.08)] backdrop-blur-md md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        if (tab.isAdd) {
          return (
            <Link key={tab.label} href={tab.href} className="flex flex-col items-center gap-0.5 no-underline">
              <div className="ink-button grid size-10 place-items-center rounded-full p-0 text-primary-foreground">
                <Icon className="size-4" />
              </div>
            </Link>
          );
        }
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              "font-ui flex min-w-12 flex-col items-center gap-0.5 rounded-md px-1 py-1 text-[10px] no-underline transition-colors",
              active ? "bg-accent text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2 : 1.5} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, publicProfileHref, displayName, avatarUrl }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar publicProfileHref={publicProfileHref} displayName={displayName} avatarUrl={avatarUrl} />
      <main className="min-w-0 flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <MobileBottomTab />
    </div>
  );
}
