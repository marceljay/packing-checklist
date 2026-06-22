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

/**
 * Editing a built-in default forks it into a user item: the row is re-keyed to a
 * fresh custom id (`newId`) and flagged `custom:true`, and every trip reference to
 * the old id is rewired to it — so the user's edit follows their trips while the
 * `d:<catalogId>` slot is freed (restoreable). No-op if the id is missing or the
 * item is already custom. Mutates `data` (call inside a store draft). Returns the
 * effective id (new if forked, else unchanged).
 */
export function forkDefault(data: AppData, oldId: string, newId: string): string {
  const item = data.library.find((i) => i.id === oldId);
  if (!item || item.custom) return oldId;
  item.id = newId;
  item.custom = true;
  for (const trip of data.trips) {
    for (const ref of trip.items) {
      if (ref.libraryId === oldId) ref.libraryId = newId;
    }
  }
  return newId;
}
