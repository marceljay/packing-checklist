import Dexie, { type Table } from 'dexie';
import type { Trip } from '../types';

/**
 * Local-only persistence (SPEC §9). The whole Trip aggregate is stored as one
 * row keyed by id; nested items/bags/tags live inside it. A separate profile
 * store (frequent items, suggestion pool) arrives in a later phase.
 *
 * `schemaVersion` on each Trip lets us migrate saved data as the model evolves.
 */
export const CURRENT_SCHEMA_VERSION = 1;

export type StoredTrip = Trip & { schemaVersion: number };

class PackingDB extends Dexie {
  trips!: Table<StoredTrip, string>;

  constructor() {
    super('packing-checklist');
    this.version(1).stores({
      // Index id (primary) + updatedAt for sorting the trips list.
      trips: 'id, updatedAt',
    });
  }
}

export const db = new PackingDB();

/** RFC4122-ish id; crypto.randomUUID is available in all PWA-capable browsers. */
export function uid(): string {
  return crypto.randomUUID();
}
