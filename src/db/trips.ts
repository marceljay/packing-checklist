import { db, uid, CURRENT_SCHEMA_VERSION, type StoredTrip } from './db';
import type { Trip } from '../types';
import { parseImport } from './transfer';
import { ensureLibraryItem, getLibraryItem, putWithId } from './library';
import type { LibraryItem } from '../types';

function now() {
  return Date.now();
}

export async function listTrips(): Promise<StoredTrip[]> {
  return db.trips.orderBy('updatedAt').reverse().toArray();
}

export async function getTrip(id: string): Promise<StoredTrip | undefined> {
  return db.trips.get(id);
}

export async function createTrip(name = 'Untitled trip'): Promise<string> {
  const ts = now();
  const trip: StoredTrip = {
    id: uid(),
    name,
    destinations: [],
    tags: [],
    items: [],
    settings: { laundryAvailable: false },
    createdAt: ts,
    updatedAt: ts,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  await db.trips.add(trip);
  return trip.id;
}

/** Persist a full trip aggregate, bumping updatedAt. */
export async function saveTrip(trip: Trip): Promise<void> {
  await db.trips.put({
    ...trip,
    updatedAt: now(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

export async function deleteTrip(id: string): Promise<void> {
  await db.trips.delete(id);
}

/**
 * Import a trip from exported JSON text as a new, independent trip. Resolves the
 * bundled library items into the local library (dedupe by name; mints fresh local
 * ids) and rewires the trip's item references to those ids. Throws on invalid
 * input (see `parseImport`). Returns the new trip id.
 */
export async function importTripFromText(text: string): Promise<string> {
  const { trip, libraryItems } = parseImport(text, uid, now());

  // Resolve each bundled library item into the store. v2 items carry an id —
  // dedup by it (reuse if present, else insert preserving the id). Legacy items
  // have no id and fall back to name resolution. Map placeholder -> local id.
  const keyToId = new Map<string, string>();
  for (const li of libraryItems) {
    if (li.id) {
      const existing = await getLibraryItem(li.id);
      if (existing) {
        keyToId.set(li.id, existing.id); // same item already here
        continue;
      }
      const row: LibraryItem = {
        id: li.id,
        nameKey: li.nameKey,
        name: li.name,
        category: li.category,
        tagKeys: li.tagKeys,
        custom: li.custom,
        count: 0,
        lastUsed: 0,
        ...(li.essential ? { essential: true } : {}),
        ...(li.quantity ? { quantity: li.quantity } : {}),
      };
      const stored = await putWithId(row);
      keyToId.set(li.id, stored.id);
    } else {
      const row = await ensureLibraryItem(li.name, li.category, li.tagKeys);
      keyToId.set(li.nameKey, row.id);
    }
  }

  const items = trip.items
    .map((it) => ({ ...it, libraryId: keyToId.get(it.libraryId) ?? '' }))
    .filter((it) => it.libraryId);

  const stored: StoredTrip = { ...trip, items, schemaVersion: CURRENT_SCHEMA_VERSION };
  await db.trips.add(stored);
  return trip.id;
}

/** Deep-clone a trip with fresh ids so the copy is fully independent (SPEC §8). */
export async function cloneTrip(id: string): Promise<string | undefined> {
  const src = await db.trips.get(id);
  if (!src) return undefined;

  // Fresh ids for the trip's context tags; items are library references and reset
  // their packed state for the new copy.
  const tags = src.tags.map((t) => ({ ...t, id: uid() }));
  const items = src.items.map((it) => ({ ...it, packed: false }));

  const ts = now();
  const copy: StoredTrip = {
    ...src,
    id: uid(),
    name: `${src.name} (copy)`,
    tags,
    items,
    createdAt: ts,
    updatedAt: ts,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  await db.trips.add(copy);
  return copy.id;
}
