"use client";

import { useState, useEffect, useRef } from "react";

export function useDelayedLoading(delay = 300) {
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer.current);
  }, [delay]);

  return show;
}
