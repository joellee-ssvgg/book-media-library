"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, Film, Plus, Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryPicker } from "@/components/domain/country-picker";
import { lookupCountryCode } from "@/lib/reading-map/country-lookup";

export function AddWorkModal({ open, onOpenChange, defaultTab = "book" }) {
  const [tab, setTab] = useState(defaultTab);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(null);
  const [country, setCountry] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query || query.length < 2) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${tab === "book" ? "book" : "movie"}`);
        const data = await res.json();
        setResults(data.results?.candidates || data.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, tab]);

  const visibleResults = !query || query.length < 2 ? [] : results;

  const [error, setError] = useState(null);

  const handleAdd = useCallback(async (item) => {
    setError(null);
    const countryCode = country ? lookupCountryCode(country) : null;
    try {
      const res = await fetch("/api/add-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: item.provider,
          externalId: item.externalId,
          type: tab === "book" ? "book" : "movie",
          countryCode: countryCode || undefined,
          countryName: countryCode ? country : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "添加失败");
        return;
      }
      setAdded(item.externalId);
    } catch (e) { setError(e.message); }
  }, [tab, country]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加到我的库</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-md border border-border bg-muted/70 p-1">
          <button
            onClick={() => { setTab("book"); setResults([]); setQuery(""); setCountry(""); }}
            className={cn("font-ui flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors", tab === "book" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <BookOpen className="mr-1.5 inline size-4" />图书
          </button>
          <button
            onClick={() => { setTab("movie"); setResults([]); setQuery(""); setCountry(""); }}
            className={cn("font-ui flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors", tab === "movie" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <Film className="mr-1.5 inline size-4" />电影
          </button>
        </div>

        <div className="relative">
          <label className="sr-only" htmlFor="add-work-search">
            {tab === "book" ? "搜索书名或作者" : "搜索电影名"}
          </label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="add-work-search"
            placeholder={tab === "book" ? "搜索书名或作者..." : "搜索电影名..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-2">
          <Globe className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <span className="font-ui shrink-0 text-xs text-muted-foreground">国家（可选）</span>
          <div className="flex-1">
            <CountryPicker value={country} onChange={setCountry} />
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {loading && <p className="py-8 text-center text-sm text-muted-foreground">搜索中...</p>}
          {!loading && visibleResults.length === 0 && query.length >= 2 && (
            <p className="py-8 text-center text-sm text-muted-foreground">未找到结果</p>
          )}
          {visibleResults.map((item) => (
            <SearchResultCard key={item.externalId} item={item} onAdd={handleAdd} added={added === item.externalId} />
          ))}
        </div>

        <p className="font-ui text-center text-xs text-muted-foreground">
          需要设置状态/评分？
          <Link href={tab === "book" ? "/add/book" : "/add/movie"} className="text-primary hover:underline">
            详细添加 →
          </Link>
        </p>
        {error && <p className="text-center text-xs text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

function SearchResultCard({ item, onAdd, added }) {
  return (
    <div className="flex gap-3 border-b border-border px-1 py-3 last:border-0">
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted shadow-sm">
        {item.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-display text-base font-semibold text-[var(--ink)]">{item.title}</p>
        <p className="font-ui truncate text-xs text-muted-foreground">
          {item.creators?.join(", ")} {item.releaseYear && `· ${item.releaseYear}`}
        </p>
      </div>
      <Button
        size="sm"
        variant={added ? "ghost" : "outline"}
        onClick={() => onAdd(item)}
        disabled={added}
        aria-label={added ? `已添加 ${item.title}` : `添加 ${item.title}`}
      >
        {added ? <Check className="size-4" /> : <Plus className="size-4" />}
      </Button>
    </div>
  );
}
