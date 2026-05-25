"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LibraryDashboardClient } from "@/components/domain/library-dashboard-client";
import { AddWorkModal } from "@/components/domain/add-work-modal";

export default function FilmsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <SectionHeader
        eyebrow="LIBRARY"
        title="影视库"
        action={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />添加一部电影
          </Button>
        }
      />
      <div className="mt-8">
        <LibraryDashboardClient mode="library" mediaType="movie" />
      </div>
      <AddWorkModal open={modalOpen} onOpenChange={setModalOpen} defaultTab="movie" />
    </div>
  );
}
