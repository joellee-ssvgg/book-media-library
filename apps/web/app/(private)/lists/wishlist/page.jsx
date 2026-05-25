"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WishlistPage() {
  const [filter, setFilter] = useState("all");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <SectionHeader eyebrow="LISTS" title="想读想看" />

      <div className="mt-6 flex gap-1 rounded-md bg-muted p-1 w-fit">
        {[
          { key: "all", label: "全部" },
          { key: "book", label: "图书" },
          { key: "movie", label: "影视" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              "rounded-sm px-4 py-1.5 text-sm font-medium transition-colors",
              filter === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <EmptyState
          icon={Heart}
          title="还没有想读或想看的内容"
          description="在搜索结果中点击「加入想读 / 想看」即可保存。"
        />
      </div>
    </div>
  );
}
