"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LibraryDashboardClient } from "@/components/domain/library-dashboard-client";
import { AddWorkModal } from "@/components/domain/add-work-modal";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function todayLabel() {
  const d = new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${WEEKDAYS[d.getDay()]}`;
}

export default function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="page-frame">
      <SectionHeader
        eyebrow="PRIVATE STUDY"
        title="今日书桌"
        action={
          <Button size="lg" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />快速记录
          </Button>
        }
      />
      <p className="ink-subtitle mt-3 text-lg">今天想继续什么，随手记下来。</p>
      {/* 日期含服务端/客户端时区差，suppressHydrationWarning 容忍即可 */}
      <p suppressHydrationWarning className="font-ui mt-1 text-sm tracking-wide text-[var(--ink-faint)]">
        {todayLabel()}
      </p>
      <div className="mt-10">
        <LibraryDashboardClient mode="dashboard" />
      </div>
      <AddWorkModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
