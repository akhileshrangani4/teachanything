"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_LIMIT, MIN_LIMIT, ROW_HEIGHT_PX } from "./constants";

type OffsetSetter = (update: (prevOffset: number) => number) => void;

/**
 * Auto-sizes the page limit so conversation rows fill the available panel
 * height. Returns the computed `limit` and a callback ref for the results
 * container.
 */
export function usePanelRows(setOffset: OffsetSetter): {
  limit: number;
  setResultsRef: (el: HTMLDivElement | null) => void;
} {
  const [limit, setLimit] = useState(MIN_LIMIT);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Measure the results area and fit as many rows as will fit so the panel
  // doesn't leave whitespace. A callback ref (not useLayoutEffect+useRef) is
  // used so measurement re-attaches every time the list view re-mounts -- e.g.
  // after returning from a conversation detail. The old approach left a stale
  // ResizeObserver bound to the detached node, which fired with height 0 and
  // reset the page size to the minimum (the "10 -> 5 after going back" bug).
  const setResultsRef = useCallback(
    (el: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!el) return;
      const update = () => {
        const rows = Math.floor(el.clientHeight / ROW_HEIGHT_PX);
        if (rows <= 0) return; // ignore detached/zero-height measurements
        const clamped = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, rows));
        setLimit((prev) => {
          if (prev === clamped) return prev;
          setOffset((prevOffset) => Math.floor(prevOffset / clamped) * clamped);
          return clamped;
        });
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      observerRef.current = observer;
    },
    [setOffset],
  );

  return { limit, setResultsRef };
}
