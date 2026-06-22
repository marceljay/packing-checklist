import { useSyncExternalStore } from 'react';
import { migrate, emptyData, type AppData } from './appData';

/**
 * The whole app state is one JSON document in localStorage. This module owns it:
 * a synchronous in-memory copy, persistence, and subscription for React. Replaces
 * Dexie/IndexedDB — there is no schema to migrate, just `migrate()` on load.
 */

const KEY = 'packing-checklist';

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    // corrupt/unavailable storage → start empty rather than crash
  }
  return emptyData();
}

let data: AppData = load();
const listeners = new Set<() => void>();

/** True if a document has already been persisted (i.e. not a first run). */
export function hasStoredDoc(): boolean {
  try {
    return localStorage.getItem(KEY) != null;
  } catch {
    return false;
  }
}

export function getData(): AppData {
  return data;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // quota/unavailable — keep the in-memory copy working
  }
}

/** Apply an immutable mutation to the document, persist, and notify subscribers. */
export function setData(mutator: (draft: AppData) => void): void {
  const next = structuredClone(data);
  mutator(next);
  data = next;
  persist();
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reactive read of the whole document (replaces Dexie's useLiveQuery). The
 *  snapshot ref only changes when `setData` runs, so selectors can `useMemo`. */
export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData, getData);
}

/** RFC4122 id for trip-internal entities (trip, destination, context tag). */
export function uid(): string {
  return crypto.randomUUID();
}
