"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, ListPlus, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";

const tabs = [
  { label: "库", href: "/library", icon: BookOpen },
  { label: "书桌", href: "/dashboard", icon: LayoutDashboard },
  { label: "快记", href: "/add/book", icon: Plus, isAdd: true },
  { label: "清单", href: "/lists", icon: ListPlus },
  { label: "我", href: "/settings/public", icon: User },
];

function MobileBottomTab() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-background/95 backdrop-blur-sm md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        if (tab.isAdd) {
          return (
            <Link key={tab.label} href={tab.href} className="flex flex-col items-center gap-0.5 no-underline">
              <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
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
              "flex flex-col items-center gap-0.5 text-[10px] no-underline transition-colors",
              active ? "text-primary" : "text-muted-foreground"
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

export function AppShell({ children, publicProfileHref }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar publicProfileHref={publicProfileHref} />
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <MobileBottomTab />
    </div>
  );
}
