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

/**
 * RFC4122 v4 id for trip-internal entities (trip, destination, context tag).
 * Built from `crypto.getRandomValues` (available in insecure contexts) rather
 * than `crypto.randomUUID()` (HTTPS-only) so the app also runs over plain http
 * and from a local file. Falls back to Math.random only if crypto is absent.
 */
export function uid(): string {
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(b);
  } else {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}
