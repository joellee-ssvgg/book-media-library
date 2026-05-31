"use client";

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, Check } from "lucide-react";
import { lookupCountryCode } from "@/lib/reading-map/country-lookup";
import { cn } from "@/lib/utils";

export const COUNTRY_LIST = [
  "日本", "中国", "美国", "英国", "法国", "德国", "俄罗斯", "韩国",
  "印度", "意大利", "西班牙", "巴西", "加拿大", "澳大利亚", "荷兰",
  "瑞典", "挪威", "丹麦", "芬兰", "瑞士", "比利时", "奥地利", "爱尔兰",
  "葡萄牙", "波兰", "捷克", "匈牙利", "希腊", "土耳其", "以色列",
  "埃及", "南非", "尼日利亚", "肯尼亚", "摩洛哥", "阿根廷", "墨西哥",
  "哥伦比亚", "智利", "秘鲁", "古巴", "泰国", "越南", "印度尼西亚",
  "马来西亚", "新加坡", "菲律宾", "伊朗", "伊拉克", "沙特阿拉伯",
  "阿联酋", "新西兰", "冰岛", "乌克兰", "罗马尼亚",
];

const PANEL_MIN_WIDTH = 184;
const PANEL_MAX_HEIGHT = 288;
const SEARCH_BAR_HEIGHT = 44;

/**
 * 国家下拉选择器。受控组件，value 为中文国家名（或空字符串）。
 * 面板用 portal 渲染到最近的 dialog（或 body），避免被弹窗内的滚动容器裁剪。
 * dropDirection: "up" | "down" — 偏好展开方向，空间不足时自动翻转。
 */
export function CountryPicker({ value, onChange, disabled, dropDirection = "down" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return COUNTRY_LIST;
    const q = query.toLowerCase();
    return COUNTRY_LIST.filter(
      (name) =>
        name.toLowerCase().includes(q) ||
        (lookupCountryCode(name) || "").toLowerCase().includes(q)
    );
  }, [query]);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const dialog = trigger.closest('[role="dialog"]');
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp =
      dropDirection === "up"
        ? spaceAbove > 160 || spaceAbove >= spaceBelow
        : spaceBelow < 220 && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, PANEL_MIN_WIDTH);
    const avail = openUp ? spaceAbove : spaceBelow;
    const listMaxHeight = Math.max(96, Math.min(PANEL_MAX_HEIGHT, avail - 12) - SEARCH_BAR_HEIGHT);

    if (dialog) {
      const box = dialog.getBoundingClientRect();
      let left = rect.left - box.left;
      left = Math.max(0, Math.min(left, box.width - width));
      const style = { position: "absolute", left, width };
      if (openUp) {
        style.bottom = box.bottom - rect.top + 4;
      } else {
        style.top = rect.bottom - box.top + 4;
      }
      setLayout({ target: dialog, style, listMaxHeight });
    } else {
      let left = Math.min(rect.left, window.innerWidth - width - 8);
      left = Math.max(8, left);
      const style = { position: "fixed", left, width, zIndex: 100 };
      if (openUp) {
        style.bottom = window.innerHeight - rect.top + 4;
      } else {
        style.top = rect.bottom + 4;
      }
      setLayout({ target: document.body, style, listMaxHeight });
    }
  }, [dropDirection]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return undefined;
    const onMove = () => reposition();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const onDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, reposition]);

  const handleSelect = (name) => {
    onChange(name);
    setQuery("");
    setOpen(false);
  };

  const panel =
    open && layout
      ? createPortal(
          <div
            ref={panelRef}
            style={layout.style}
            className="z-[100] flex flex-col overflow-hidden rounded-md border border-border bg-[var(--paper)] shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
              <Search className="size-3.5 text-[var(--ink-faint)]" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="搜索国家..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="w-full bg-transparent font-ui text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: layout.listMaxHeight }}>
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center font-ui text-xs text-[var(--ink-soft)]">
                  没有匹配的国家
                </div>
              ) : (
                filtered.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSelect(name)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left font-ui text-sm transition-colors hover:bg-accent",
                      value === name ? "text-[var(--blue)]" : "text-[var(--ink)]"
                    )}
                  >
                    {value === name ? (
                      <Check className="size-3.5 shrink-0" strokeWidth={2} />
                    ) : (
                      <span className="size-3.5 shrink-0" />
                    )}
                    <span className="truncate">{name}</span>
                    <span className="ml-auto shrink-0 font-ui text-xs text-[var(--ink-faint)]">
                      {lookupCountryCode(name)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          layout.target
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-[var(--paper-deep)] px-3 font-ui text-sm text-[var(--ink)] disabled:opacity-50"
      >
        {value || <span className="text-[var(--ink-faint)]">选择国家...</span>}
        <span className="text-[var(--ink-faint)]">{open ? "▲" : "▼"}</span>
      </button>
      {panel}
    </div>
  );
}
