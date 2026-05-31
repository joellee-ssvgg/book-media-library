"use client";

import { useState } from "react";
import { ReadingMapClient } from "./components/reading-map-client";
import { MovieCalendar } from "./components/movie-calendar";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "map", label: "阅读地图" },
  { key: "movies", label: "观影月历" },
];

export default function TracesPage() {
  const [tab, setTab] = useState("map");

  return (
    <div className="page-frame">
      <SectionHeader eyebrow="TRACES" title="足迹" />
      <p className="ink-subtitle mt-2 text-sm">
        {tab === "map"
          ? "在地图上探索你读过世界各地的哪些书。"
          : "把看过的电影按日期摆进月历，长期留存，可以翻回过去的月份。"}
      </p>

      <nav className="media-tabs mt-6" aria-label="足迹切换">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn("media-tab", tab === t.key && "media-tab-active")}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "map" ? (
          <div className="flex h-[calc(100vh-22rem)] min-h-[420px] flex-col gap-4 lg:flex-row">
            <ReadingMapClient />
          </div>
        ) : (
          <MovieCalendar />
        )}
      </div>
    </div>
  );
}
