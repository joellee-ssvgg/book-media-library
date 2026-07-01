"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LibraryDashboardClient } from "@/components/domain/library-dashboard-client";
import { AddWorkModal } from "@/components/domain/add-work-modal";
import { MovieRecommendations } from "@/components/domain/movie-recommendations";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { key: "", label: "全部" },
  { key: "watching", label: "在看" },
  { key: "want_to_watch", label: "想看" },
  { key: "watched", label: "看过" },
];

export default function FilmsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState("");

  return (
    <div className="page-frame">
      <SectionHeader
        eyebrow="COLLECTION"
        title="影视库"
        action={
          <Button size="lg" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />添加一部电影
          </Button>
        }
      />
      <nav className="media-tabs mt-8" aria-label="影视状态">
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
        <LibraryDashboardClient mode="library" mediaType="movie" status={status} onAddWork={() => setModalOpen(true)} />
      </div>
      <MovieRecommendations />
      <AddWorkModal open={modalOpen} onOpenChange={setModalOpen} defaultTab="movie" />
    </div>
  );
}
