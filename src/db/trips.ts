import { db, uid, CURRENT_SCHEMA_VERSION, type StoredTrip } from './db';
import type { Trip } from '../types';
import { parseTrip } from './transfer';

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

/** Import a trip from exported JSON text as a new, independent trip. Throws on
 *  invalid input (see `parseTrip`). Returns the new trip id. */
export async function importTripFromText(text: string): Promise<string> {
  const trip = parseTrip(text, uid, now());
  await db.trips.add({ ...trip, schemaVersion: CURRENT_SCHEMA_VERSION });
  return trip.id;
}

/** Deep-clone a trip with fresh ids so the copy is fully independent (SPEC §8). */
export async function cloneTrip(id: string): Promise<string | undefined> {
  const src = await db.trips.get(id);
  if (!src) return undefined;

  // Remap tag ids so item.tagIds references stay consistent.
  const tagIdMap = new Map<string, string>();
  const tags = src.tags.map((t) => {
    const newId = uid();
    tagIdMap.set(t.id, newId);
    return { ...t, id: newId };
  });

  const items = src.items.map((it) => ({
    ...it,
    id: uid(),
    packed: false,
    tagIds: it.tagIds.map((t) => tagIdMap.get(t) ?? t).filter(Boolean),
  }));

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
