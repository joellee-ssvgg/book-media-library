"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, Film, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function AddWorkModal({ open, onOpenChange, defaultTab = "book" }) {
  const [tab, setTab] = useState(defaultTab);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query || query.length < 2) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${tab === "book" ? "book" : "movie"}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, tab]);

  const visibleResults = !query || query.length < 2 ? [] : results;

  const handleAdd = useCallback(async (item) => {
    setAdded(item.externalId);
    setTimeout(() => setAdded(null), 2000);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加到我的库</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-md bg-muted p-1">
          <button
            onClick={() => { setTab("book"); setResults([]); setQuery(""); }}
            className={cn("flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors", tab === "book" ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            <BookOpen className="mr-1.5 inline size-4" />图书
          </button>
          <button
            onClick={() => { setTab("movie"); setResults([]); setQuery(""); }}
            className={cn("flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors", tab === "movie" ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            <Film className="mr-1.5 inline size-4" />电影
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tab === "book" ? "搜索书名或作者..." : "搜索电影名..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
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

        <p className="text-center text-xs text-muted-foreground">
          找不到？<a href={tab === "book" ? "/add/book" : "/add/movie"} className="text-primary hover:underline">手动添加 →</a>
        </p>
      </DialogContent>
    </Dialog>
  );
}

function SearchResultCard({ item, onAdd, added }) {
  return (
    <div className="flex gap-3 border-b border-border px-1 py-3 last:border-0">
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
        {item.coverUrl && <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.creators?.join(", ")} {item.releaseYear && `· ${item.releaseYear}`}
        </p>
      </div>
      <Button size="sm" variant={added ? "ghost" : "outline"} onClick={() => onAdd(item)} disabled={added}>
        {added ? <Check className="size-4" /> : <Plus className="size-4" />}
      </Button>
    </div>
  );
}
