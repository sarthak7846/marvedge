import { useRef, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDemosStore } from "@/app/store/demosStore";
import type { Demo } from "../types";

/**
 * Thin shim over the demosStore (strangler pattern). Returns the same shape it
 * always exposed so existing consumers keep working untouched, but the list
 * data now lives in the Zustand store. The store is seeded once from the
 * server-provided initial demos, then duration probing runs off store changes.
 */
export function useDemosData(initialDemos: Demo[]) {
  // Seed the store synchronously on first render so the initial list (and any
  // cached durations) are available before paint — matching the old useState
  // initializer, no empty flash.
  const didInit = useRef(false);
  if (!didInit.current) {
    useDemosStore.getState().initialize(initialDemos);
    didInit.current = true;
  }

  const { demos, loading, error, durationMap } = useDemosStore(
    useShallow((s) => ({
      demos: s.demos,
      loading: s.loading,
      error: s.error,
      durationMap: s.durationMap,
    }))
  );
  const deleteDemo = useDemosStore((s) => s.deleteDemo);
  const fetchDurations = useDemosStore((s) => s.fetchDurations);

  useEffect(() => {
    if (demos.length > 0) {
      fetchDurations(demos);
    }
  }, [demos, fetchDurations]);

  // Reset the store when the route unmounts so data and filters start fresh on
  // the next visit — matching the old per-mount useState lifecycle.
  useEffect(() => {
    return () => {
      useDemosStore.getState().reset();
    };
  }, []);

  return { demos, loading, error, durationMap, deleteDemo };
}
