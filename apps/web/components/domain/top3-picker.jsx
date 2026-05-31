"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { BookCover } from "@/components/domain/visual-system";

const COVER_VARIANTS = ["navy", "blue", "cream"];
const MEDIA_LABELS = { book: "图书", movie: "电影" };

export function Top3Picker({ options = [], initialSelectedIds = [] }) {
  const byId = useMemo(() => new Map(options.map((option) => [option.entryId, option])), [options]);
  const [selected, setSelected] = useState(() =>
    initialSelectedIds.map((id) => byId.get(id)).filter(Boolean).slice(0, 3)
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const ids = new Set(selected.map((item) => item.entryId));
    const keyword = query.trim().toLowerCase();
    return options
      .filter((option) => !ids.has(option.entryId))
      .filter((option) => !keyword || option.title.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [options, query, selected]);

  const full = selected.length >= 3;

  function add(option) {
    setSelected((prev) => (prev.length >= 3 ? prev : [...prev, option]));
    setQuery("");
  }
  function removeAt(index) {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  }
  function move(index, direction) {
    setSelected((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="grid gap-4">
      {[0, 1, 2].map((slot) => (
        <input key={slot} type="hidden" name={`topEntryId${slot + 1}`} value={selected[slot]?.entryId ?? ""} />
      ))}

      {selected.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-[var(--paper-deep)] p-4 font-ui text-sm text-muted-foreground">
          还没有选择精选记录。在下方搜索并添加（最多 3 个）。
        </p>
      ) : (
        <div className="grid gap-2">
          {selected.map((item, index) => (
            <div className="ink-button-outline grid grid-cols-[32px_40px_1fr_auto] items-center gap-3 p-2" key={item.entryId}>
              <span className="grid size-7 place-items-center rounded-full border border-border bg-card font-ui text-sm text-primary">{index + 1}</span>
              <BookCover title={item.title} variant={COVER_VARIANTS[index % COVER_VARIANTS.length]} className="aspect-[2/3] w-10" />
              <span className="min-w-0">
                <span className="block truncate font-ui text-sm text-[var(--ink)]">{item.title}</span>
                <span className="font-ui text-xs text-muted-foreground">{MEDIA_LABELS[item.mediaType] ?? "作品"}</span>
              </span>
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-primary disabled:opacity-30" aria-label="上移">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === selected.length - 1} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-primary disabled:opacity-30" aria-label="下移">
                  <ArrowDown className="size-4" />
                </button>
                <button type="button" onClick={() => removeAt(index)} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-[var(--danger)]" aria-label="移除">
                  <X className="size-4" />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!full ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Search className="size-4" />
          </span>
          <input
            className="h-11 w-full rounded-md border border-input bg-card pl-9 pr-3 font-ui text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={options.length ? "搜索你的库，添加精选" : "你的库里还没有可展示的记录"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            disabled={options.length === 0}
          />
          {open && results.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
              {results.map((option) => (
                <li key={option.entryId}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      add(option);
                    }}
                    className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <BookCover title={option.title} variant="navy" className="aspect-[2/3] w-8" />
                    <span className="min-w-0">
                      <span className="block truncate font-ui text-sm text-[var(--ink)]">{option.title}</span>
                      <span className="font-ui text-xs text-muted-foreground">{MEDIA_LABELS[option.mediaType] ?? "作品"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
