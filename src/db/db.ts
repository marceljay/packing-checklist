import Dexie, { type Table } from 'dexie';
import type { Trip, LibraryItem } from '../types';

/**
 * Local-only persistence (SPEC §9). The whole Trip aggregate is stored as one
 * row keyed by id; nested items/tags live inside it. A separate `library` store
 * holds the user's custom items globally so they aren't trapped in one trip.
 *
 * `schemaVersion` on each Trip lets us migrate saved data as the model evolves.
 */
export const CURRENT_SCHEMA_VERSION = 1;

export type StoredTrip = Trip & { schemaVersion: number };

class PackingDB extends Dexie {
  trips!: Table<StoredTrip, string>;
  library!: Table<LibraryItem, string>;

  constructor() {
    super('packing-checklist');
    this.version(1).stores({
      // Index id (primary) + updatedAt for sorting the trips list.
      trips: 'id, updatedAt',
    });
    // v2: personal custom-item library, keyed by normalized name.
    // `tagKeys` is a non-indexed column on LibraryItem — Dexie stores it without
    // a schema change, so no version bump is needed for it.
    this.version(2).stores({
      trips: 'id, updatedAt',
      library: 'nameKey, count, lastUsed',
    });
  }
}

export const db = new PackingDB();

/** RFC4122-ish id; crypto.randomUUID is available in all PWA-capable browsers. */
export function uid(): string {
  return crypto.randomUUID();
}
