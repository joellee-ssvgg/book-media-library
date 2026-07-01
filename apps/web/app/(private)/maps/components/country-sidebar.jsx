"use client";

import { useMemo, useState } from "react";
import { Search, BookOpen, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { BookCard } from "./book-card";

function CountryRow({ countryCode, countryName, count, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(countryCode)}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
        isSelected
          ? "bg-[var(--blue)] text-white"
          : "hover:bg-accent text-[var(--ink)]"
      }`}
    >
      <span className="font-ui truncate text-sm font-medium">{countryName}</span>
      <span
        className={`ml-2 shrink-0 rounded-full px-2 py-0.5 font-ui text-xs ${
          isSelected
            ? "bg-white/20 text-white"
            : "bg-accent text-[var(--ink-soft)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

export function CountrySidebar({
  countryCounts,
  entries,
  selectedCountry,
  onCountryClick,
  pending,
  hasData,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const sortedCountries = useMemo(() => {
    return Object.entries(countryCounts)
      .map(([code, data]) => ({
        code,
        name: data.country_name,
        count: data.count,
      }))
      .filter((c) =>
        searchQuery
          ? c.name.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      )
      .sort((a, b) => b.count - a.count);
  }, [countryCounts, searchQuery]);

  const selectedCountryName = selectedCountry
    ? countryCounts[selectedCountry]?.country_name || selectedCountry
    : null;

  if (pending) {
    return (
      <div className="flex w-full shrink-0 flex-col lg:w-80">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Loader2 className="size-4 animate-spin text-[var(--ink-soft)]" strokeWidth={1.5} />
          <span className="font-ui text-sm text-[var(--ink-soft)]">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-[var(--paper)] lg:w-80">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">阅读足迹</h2>
        <p className="font-ui text-xs text-[var(--ink-soft)]">
          共 {Object.keys(countryCounts).length} 个国家 / 地区
        </p>
      </div>

      {/* Search */}
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-[var(--paper-deep)] px-2 py-1.5">
          <Search className="size-4 text-[var(--ink-faint)]" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="搜索国家..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent font-ui text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
          />
        </div>
      </div>

      {/* Country list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sortedCountries.length === 0 ? (
          searchQuery ? (
            <div className="px-3 py-8 text-center font-ui text-sm text-[var(--ink-soft)]">
              没有匹配的国家
            </div>
          ) : !hasData ? (
            <EmptyState
              icon={BookOpen}
              title="还没有阅读足迹"
              description="添加书籍并标注国家后，这里会显示你的阅读世界地图。"
            />
          ) : null
        ) : (
          <div className="space-y-0.5">
            {sortedCountries.map((c) => (
              <CountryRow
                key={c.code}
                countryCode={c.code}
                countryName={c.name}
                count={c.count}
                isSelected={selectedCountry === c.code}
                onClick={onCountryClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected country books */}
      {selectedCountry && entries.length > 0 && (
        <div className="border-t border-border px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-ui text-sm font-semibold text-[var(--ink)]">
              {selectedCountryName} ({entries.length})
            </h3>
            <button
              type="button"
              onClick={() => onCountryClick(selectedCountry)}
              className="font-ui text-xs text-[var(--ink-soft)] underline underline-offset-2 hover:text-[var(--ink)]"
            >
              清除筛选
            </button>
          </div>
          <div className="max-h-60 space-y-0.5 overflow-y-auto">
            {entries.map((entry, i) => (
              <BookCard key={entry.entry_id} entry={entry} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
