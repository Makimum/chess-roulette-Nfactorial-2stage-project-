import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cma_board_size";

/** Range 0..100; mapped to a max-width clamp on the board container. */
export function useBoardSize(defaultValue = 70) {
  const [size, setSize] = useState<number>(defaultValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = Number(raw);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) setSize(n);
    }
  }, []);

  const update = useCallback((value: number) => {
    setSize(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  }, []);

  // Map 0..100 → CSS max-width clamp, between ~360px and ~720px.
  const minPx = 320;
  const maxPx = 720;
  const px = Math.round(minPx + ((maxPx - minPx) * size) / 100);
  const maxWidth = `min(100%, ${px}px)`;

  return { size, setSize: update, maxWidth };
}
