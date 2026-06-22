import type { Trip, LibraryItem } from '../types';

/**
 * The whole app state as one JSON document (persisted in localStorage by
 * `store.ts`). Replaces the Dexie/IndexedDB stores: migrations are pure object
 * transforms here, not schema upgrades.
 */
export interface AppData {
  schemaVersion: number;
  trips: Trip[];
  library: LibraryItem[];
}

/** Document format version. Bump + handle in `migrate` when the shape changes. */
export const CURRENT_SCHEMA_VERSION = 1;

export function emptyData(): AppData {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, trips: [], library: [] };
}

/**
 * Normalize an arbitrary parsed value into a valid {@link AppData}. Tolerant of
 * missing/garbage input (returns empty) so a corrupt document can never crash the
 * app. Future schema bumps add their transforms here.
 */
export function migrate(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return emptyData();
  const o = raw as Partial<AppData>;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    trips: Array.isArray(o.trips) ? o.trips : [],
    library: Array.isArray(o.library) ? o.library : [],
  };
}
