import { getData, setData, uid } from './store';
import { isEmptyTrip, type Trip } from '../types';
import { parseImport, parseAllTrips, serializeAllTrips, type ImportResult } from './transfer';
import { getLibraryItem, putWithId } from './library';
import type { LibraryItem } from '../types';

/** Trips live in the JSON document (`store.ts`); these are synchronous ops over it. */

export function listTrips(): Trip[] {
  return [...getData().trips].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getTrip(id: string): Trip | undefined {
  return getData().trips.find((t) => t.id === id);
}

export function createTrip(name = 'Untitled trip'): string {
  const ts = Date.now();
  const trip: Trip = {
    id: uid(),
    name,
    destinations: [],
    tags: [],
    items: [],
    settings: { laundryAvailable: false },
    createdAt: ts,
    updatedAt: ts,
  };
  setData((d) => d.trips.push(trip));
  return trip.id;
}

/** Persist a full trip aggregate, bumping updatedAt. */
export function saveTrip(trip: Trip): void {
  setData((d) => {
    const next = { ...trip, updatedAt: Date.now() };
    const i = d.trips.findIndex((t) => t.id === trip.id);
    if (i >= 0) d.trips[i] = next;
    else d.trips.push(next);
  });
}

export function deleteTrip(id: string): void {
  setData((d) => {
    d.trips = d.trips.filter((t) => t.id !== id);
  });
}

/** Drop trips the user created but never edited (see {@link isEmptyTrip}). Called
 *  when returning to the trips list so abandoned "New trip" stubs don't pile up. */
export function pruneEmptyTrips(): void {
  if (!getData().trips.some(isEmptyTrip)) return;
  setData((d) => {
    d.trips = d.trips.filter((t) => !isEmptyTrip(t));
  });
}

/** Deep-clone a trip with fresh ids so the copy is fully independent (SPEC §8). */
export function cloneTrip(id: string): string | undefined {
  const src = getTrip(id);
  if (!src) return undefined;
  const ts = Date.now();
  const copy: Trip = {
    ...structuredClone(src),
    id: uid(),
    name: `${src.name} (copy)`,
    tags: src.tags.map((t) => ({ ...t, id: uid() })),
    items: src.items.map((it) => ({ ...it, packed: false })),
    createdAt: ts,
    updatedAt: ts,
  };
  setData((d) => d.trips.push(copy));
  return copy.id;
}

/**
 * Import a trip from exported JSON text as a new, independent trip. Resolves the
 * bundled library items into the library (dedup by id) and rewires the trip's
 * references. Throws on invalid input. Returns the new trip id.
 */
export function importTripFromText(text: string): string {
  const result = parseImport(text, uid, Date.now());
  const stored = storeImported(result); // resolves library rows (its own setData calls)
  setData((d) => d.trips.push(stored));
  return result.trip.id;
}

/** Serialize every trip plus the library rows they reference — a full backup. */
export function exportAllTrips(): string {
  const { trips, library } = getData();
  return serializeAllTrips(trips, library);
}

/** Serialize a chosen subset of trips (by id) plus their referenced library rows.
 *  An empty id list exports all trips. */
export function exportTrips(ids: string[]): string {
  const { trips, library } = getData();
  const selected = ids.length > 0 ? trips.filter((t) => ids.includes(t.id)) : trips;
  return serializeAllTrips(selected, library);
}

/** Import a full-backup file: each trip is added as a new, independent trip with
 *  its library items resolved into the store. Returns how many trips were added. */
export function importAllTripsFromText(text: string): number {
  const results = parseAllTrips(text, uid, Date.now());
  if (results.length === 0) return 0;
  const stored = results.map(storeImported); // resolves library rows first
  setData((d) => {
    for (const t of stored) d.trips.push(t);
  });
  return results.length;
}

/** Resolve an import's library items into the store (dedup by id; an id clash with
 *  a different item mints a fresh id), rewire the trip's references, and return the
 *  ready trip. Library writes happen here; the trip itself is pushed by the caller. */
function storeImported({ trip, libraryItems }: ImportResult): Trip {
  const keyToId = new Map<string, string>();
  for (const li of libraryItems) {
    const existing = getLibraryItem(li.id);
    if (existing) {
      keyToId.set(li.id, existing.id);
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
    keyToId.set(li.id, putWithId(row).id);
  }

  const items = trip.items
    .map((it) => ({ ...it, libraryId: keyToId.get(it.libraryId) ?? '' }))
    .filter((it) => it.libraryId);

  return { ...trip, items };
}
