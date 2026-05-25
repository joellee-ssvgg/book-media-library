"use client";

import { useEffect } from "react";

export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    function handler(e) {
      for (const s of shortcuts) {
        const modMatch = s.mod ? (e.metaKey || e.ctrlKey) : true;
        if (modMatch && e.key.toLowerCase() === s.key.toLowerCase() && !e.repeat) {
          e.preventDefault();
          s.action();
          break;
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
