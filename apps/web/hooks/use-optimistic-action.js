"use client";

import { useState, useCallback } from "react";

export function useOptimisticAction(currentValue, action) {
  const [optimistic, setOptimistic] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (nextValue) => {
      if (isPending) return;
      setIsPending(true);
      setOptimistic(nextValue);
      setError(null);
      try {
        await action(nextValue);
      } catch (e) {
        setOptimistic(null);
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setIsPending(false);
        setOptimistic(null);
      }
    },
    [action, isPending],
  );

  return { value: optimistic ?? currentValue, execute, isPending, error };
}
