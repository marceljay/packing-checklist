import { db, uid, CURRENT_SCHEMA_VERSION, type StoredTrip } from './db';
import type { Bag, Trip } from '../types';

/** Two sensible default bags on every new trip (SPEC §4.3). */
function defaultBags(): Bag[] {
  return [
    { id: uid(), name: 'Carry-on', type: 'carry-on' },
    { id: uid(), name: 'Checked', type: 'checked' },
  ];
}

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
    bags: defaultBags(),
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

/** Deep-clone a trip with fresh ids so the copy is fully independent (SPEC §8). */
export async function cloneTrip(id: string): Promise<string | undefined> {
  const src = await db.trips.get(id);
  if (!src) return undefined;

  // Remap nested ids so references (item.bagId, item.tagIds) stay consistent.
  const bagIdMap = new Map<string, string>();
  const bags = src.bags.map((b) => {
    const newId = uid();
    bagIdMap.set(b.id, newId);
    return { ...b, id: newId };
  });

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
    bagId: it.bagId ? bagIdMap.get(it.bagId) : undefined,
    tagIds: it.tagIds.map((t) => tagIdMap.get(t) ?? t).filter(Boolean),
  }));

  const ts = now();
  const copy: StoredTrip = {
    ...src,
    id: uid(),
    name: `${src.name} (copy)`,
    bags,
    tags,
    items,
    createdAt: ts,
    updatedAt: ts,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  await db.trips.add(copy);
  return copy.id;
}
