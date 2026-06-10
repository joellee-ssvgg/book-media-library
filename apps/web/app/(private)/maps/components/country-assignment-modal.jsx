"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, X, Plus, Loader2, BookOpen } from "lucide-react";
import { lookupCountryCode } from "@/lib/reading-map/country-lookup";
import { addBookCountryAction, removeBookCountryAction } from "@/actions/reading-map";
import { CoverImage } from "@/components/domain/cover-image";
import { CountryPicker } from "@/components/domain/country-picker";
import { useRouter } from "next/navigation";

function EntryRow({ entry, onAddCountry, onRemoveCountry, actionPending }) {
  const [selectedCountry, setSelectedCountry] = useState("");
  const isPending = actionPending === entry.entry_id;

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-[var(--paper-deep)] px-3 py-2">
      {/* Cover */}
      {entry.cover_url ? (
        <CoverImage
          src={entry.cover_url}
          sizes="40px"
          className="size-10 shrink-0 rounded-sm border border-border bg-muted shadow-sm"
        />
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-sm border border-border bg-muted text-[var(--ink-faint)]">
          <BookOpen className="size-5" strokeWidth={1.5} />
        </div>
      )}

      {/* Title */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-ui text-sm font-medium text-[var(--ink)]">{entry.title}</p>
        <div className="flex flex-wrap gap-1">
          {entry.countries?.map((c) => (
            <span
              key={c.country_code}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-ui text-xs text-[var(--ink-soft)]"
            >
              {c.country_name}
              <button
                type="button"
                onClick={() => onRemoveCountry(entry.entry_id, c.country_code)}
                disabled={isPending}
                className="hover:text-[var(--danger)]"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Add country */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="w-36">
          <CountryPicker
            value={selectedCountry}
            onChange={setSelectedCountry}
            disabled={isPending}
            dropDirection="up"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (selectedCountry) {
              onAddCountry(entry.entry_id, selectedCountry);
              setSelectedCountry("");
            }
          }}
          disabled={!selectedCountry || isPending}
          className="grid size-9 place-items-center rounded-md bg-[var(--blue)] text-white disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <Plus className="size-4" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}

export function CountryAssignmentModal({ open, onOpenChange, entries }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingEntry, setPendingEntry] = useState(null);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (!searchQuery) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.title?.toLowerCase().includes(q) ||
        e.countries?.some((c) => c.country_name.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  const handleAddCountry = useCallback(
    async (entryId, countryName) => {
      setPendingEntry(entryId);
      const code = lookupCountryCode(countryName);
      if (!code) {
        setPendingEntry(null);
        return;
      }
      const form = new FormData();
      form.append("entryId", entryId);
      form.append("countryCode", code);
      form.append("countryName", countryName);
      await addBookCountryAction(form);
      setPendingEntry(null);
      router.refresh();
    },
    [router]
  );

  const handleRemoveCountry = useCallback(
    async (entryId, countryCode) => {
      setPendingEntry(entryId);
      const form = new FormData();
      form.append("entryId", entryId);
      form.append("countryCode", countryCode);
      await removeBookCountryAction(form);
      setPendingEntry(null);
      router.refresh();
    },
    [router]
  );

  const entriesWithCountry = filteredEntries.filter((e) => e.countries?.length > 0);
  const entriesWithoutCountry = filteredEntries.filter(
    (e) => !e.countries || e.countries.length === 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>管理书籍国家</DialogTitle>
        <DialogDescription>为你的书籍分配国家，它们会出现在世界地图上。</DialogDescription>

        <div className="flex items-center gap-2 rounded-md border border-border bg-[var(--paper-deep)] px-3 py-2">
          <Search className="size-4 text-[var(--ink-faint)]" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="搜索书名或国家..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent font-ui text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
          />
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {entriesWithoutCountry.length > 0 && (
            <>
              <p className="font-ui text-xs font-semibold text-[var(--ink-soft)]">
                未分配国家 ({entriesWithoutCountry.length})
              </p>
              {entriesWithoutCountry.map((entry) => (
                <EntryRow
                  key={entry.entry_id}
                  entry={entry}
                  onAddCountry={handleAddCountry}
                  onRemoveCountry={handleRemoveCountry}
                  actionPending={pendingEntry}
                />
              ))}
            </>
          )}

          {entriesWithCountry.length > 0 && (
            <>
              <p className="mt-4 font-ui text-xs font-semibold text-[var(--ink-soft)]">
                已分配国家 ({entriesWithCountry.length})
              </p>
              {entriesWithCountry.map((entry) => (
                <EntryRow
                  key={entry.entry_id}
                  entry={entry}
                  onAddCountry={handleAddCountry}
                  onRemoveCountry={handleRemoveCountry}
                  actionPending={pendingEntry}
                />
              ))}
            </>
          )}

          {filteredEntries.length === 0 && (
            <div className="py-12 text-center font-ui text-sm text-[var(--ink-soft)]">
              {searchQuery ? "没有匹配的书籍" : "还没有书籍，先去添加一些书吧"}
            </div>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
          完成
        </Button>
      </DialogContent>
    </Dialog>
  );
}
