import { getData, setData, uid } from './store';
import type { Trip } from '../types';
import { parseImport } from './transfer';
import { ensureLibraryItem, getLibraryItem, putWithId } from './library';
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
 * bundled library items into the library (dedup by id; mints ids for id-less
 * legacy rows) and rewires the trip's references. Throws on invalid input.
 * Returns the new trip id.
 */
export function importTripFromText(text: string): string {
  const { trip, libraryItems } = parseImport(text, uid, Date.now());

  const keyToId = new Map<string, string>();
  for (const li of libraryItems) {
    if (li.id) {
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
    } else {
      keyToId.set(li.nameKey, ensureLibraryItem(li.name, li.category, li.tagKeys).id);
    }
  }

  const items = trip.items
    .map((it) => ({ ...it, libraryId: keyToId.get(it.libraryId) ?? '' }))
    .filter((it) => it.libraryId);

  const stored: Trip = { ...trip, items };
  setData((d) => d.trips.push(stored));
  return trip.id;
}
