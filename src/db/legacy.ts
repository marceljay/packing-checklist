import Dexie from 'dexie';
import { customId, defaultId, tagKey, type CatalogItem, type Item, type LibraryItem, type Trip } from '../types';
import { CATALOG } from '../data/catalog';
import { CURRENT_SCHEMA_VERSION, type AppData } from './appData';

/**
 * One-time migration off the old Dexie/IndexedDB stores into the JSON document.
 * The id-remapping is a pure function so it's unit-testable without IndexedDB:
 * library rows that match a catalog item (by nameKey) become deterministic
 * `d:<catalogId>` defaults; everything else becomes a `c:` custom. Trip item
 * references are rewired to the new ids; unresolved refs are dropped.
 */
export function remapLegacyData(
  oldTrips: Trip[],
  oldLibrary: LibraryItem[],
  catalog: CatalogItem[] = CATALOG,
  mkCustomId: () => string = customId,
): AppData {
  const catalogIdByNameKey = new Map(catalog.map((c) => [tagKey(c.name), c.id]));

  const idMap = new Map<string, string>(); // old library id -> new id
  const library: LibraryItem[] = [];
  const seen = new Set<string>();

  for (const row of oldLibrary) {
    const nameKey = row.nameKey ?? tagKey(row.name ?? '');
    const catId = catalogIdByNameKey.get(nameKey);
    const newId = catId ? defaultId(catId) : mkCustomId();
    idMap.set(row.id, newId);
    if (seen.has(newId)) continue; // collapse duplicate defaults
    seen.add(newId);
    library.push({
      ...row,
      id: newId,
      nameKey,
      tagKeys: row.tagKeys ?? [],
      custom: !catId,
    });
  }

  const trips: Trip[] = oldTrips.map((t) => {
    const items: Item[] = [];
    const used = new Set<string>();
    for (const it of t.items ?? []) {
      const newId = idMap.get(it.libraryId);
      if (!newId || used.has(newId)) continue;
      used.add(newId);
      items.push({ ...it, libraryId: newId });
    }
    return {
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      destinations: t.destinations ?? [],
      tags: t.tags ?? [],
      items,
      settings: t.settings ?? { laundryAvailable: false },
      ...(t.weather ? { weather: t.weather } : {}),
      createdAt: t.createdAt ?? Date.now(),
      updatedAt: t.updatedAt ?? Date.now(),
    };
  });

  return { schemaVersion: CURRENT_SCHEMA_VERSION, trips, library };
}

/**
 * Best-effort read of the legacy IndexedDB database. Returns the remapped document,
 * or null if there's nothing to import (fresh install, or read failure).
 */
export async function importLegacyIndexedDB(): Promise<AppData | null> {
  const idb = new Dexie('packing-checklist');
  try {
    await idb.open(); // dynamic open: reads the existing schema
    const names = idb.tables.map((t) => t.name);
    if (!names.includes('trips') && !names.includes('library')) return null;
    const oldTrips = names.includes('trips') ? ((await idb.table('trips').toArray()) as Trip[]) : [];
    const oldLibrary = names.includes('library')
      ? ((await idb.table('library').toArray()) as LibraryItem[])
      : [];
    if (oldTrips.length === 0 && oldLibrary.length === 0) return null;
    return remapLegacyData(oldTrips, oldLibrary);
  } catch {
    return null;
  } finally {
    idb.close();
  }
}
