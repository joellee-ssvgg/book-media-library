"use client";

import { useSyncExternalStore } from "react";

export function useMobile(breakpoint = 768) {
  const subscribe = (callback) => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
  };
  const getSnapshot = () =>
    window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
