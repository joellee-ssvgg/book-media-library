"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LibraryDashboardClient } from "@/components/domain/library-dashboard-client";
import { AddWorkModal } from "@/components/domain/add-work-modal";
import { BookRecommendations } from "@/components/domain/book-recommendations";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { key: "", label: "全部" },
  { key: "reading", label: "在读" },
  { key: "want_to_read", label: "想读" },
  { key: "finished", label: "已读" },
];

export default function LibraryPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState("");

  return (
    <div className="page-frame">
      <SectionHeader
        eyebrow="COLLECTION"
        title="图书库"
        action={
          <Button size="lg" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />添加一本书
          </Button>
        }
      />
      <nav className="media-tabs mt-8" aria-label="图书状态">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={cn("media-tab", status === tab.key && "media-tab-active")}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="mt-8">
        <LibraryDashboardClient mode="library" mediaType="book" status={status} onAddWork={() => setModalOpen(true)} />
      </div>
      <BookRecommendations />
      <AddWorkModal open={modalOpen} onOpenChange={setModalOpen} defaultTab="book" />
    </div>
  );
}
