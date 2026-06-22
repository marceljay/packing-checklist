import Dexie, { type Table } from 'dexie';
import { shortId, type Trip, type LibraryItem } from '../types';

/**
 * Local-only persistence (SPEC §9). The whole Trip aggregate is stored as one
 * row keyed by id; nested items/tags live inside it. A separate `library` store
 * holds the user's custom items globally so they aren't trapped in one trip.
 *
 * `schemaVersion` on each Trip lets us migrate saved data as the model evolves.
 */
// v2: trip items became references to library rows (`libraryId`) instead of
// carrying their own name/category/tagIds. `migrateTripsToLibraryRefs` upgrades
// older trips at startup.
export const CURRENT_SCHEMA_VERSION = 2;

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
    // v3: unify built-in defaults + customs in one store. Existing library rows
    // were all user customs → mark custom:true. Built-in defaults are seeded at
    // runtime (see seedLibrary). `custom` stays unindexed (booleans aren't valid
    // IndexedDB keys), so the index string is unchanged.
    this.version(3)
      .stores({
        trips: 'id, updatedAt',
        library: 'nameKey, count, lastUsed',
      })
      .upgrade(async (tx) => {
        await tx
          .table('library')
          .toCollection()
          .modify((row) => {
            row.custom = true;
            if (!Array.isArray(row.tagKeys)) row.tagKeys = [];
          });
      });
    // v4: library rows gain a stable short `id` (trips reference it; it survives
    // renames, unlike the nameKey primary key). Assign one to every existing row.
    this.version(4)
      .stores({
        trips: 'id, updatedAt',
        library: 'nameKey, id, count, lastUsed',
      })
      .upgrade(async (tx) => {
        const taken = new Set<string>();
        await tx
          .table('library')
          .toCollection()
          .modify((row) => {
            if (!row.id) row.id = shortId(row.name ?? row.nameKey ?? 'item', taken);
            taken.add(row.id);
          });
      });
  }
}

export const db = new PackingDB();

/** RFC4122-ish id; crypto.randomUUID is available in all PWA-capable browsers. */
export function uid(): string {
  return crypto.randomUUID();
}
