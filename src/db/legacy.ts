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

/** Open the legacy DB at its current version (no upgrade). Resolves null if it
 *  can't be opened. Opening a non-existent name creates an empty DB — harmless,
 *  and reported as "nothing to import" since it has no object stores. */
function openLegacyDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open('packing-checklist');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

/** Read an entire object store into an array. */
function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Best-effort read of the legacy IndexedDB database (the pre-JSON-document
 * storage) via the raw IndexedDB API — no Dexie dependency. Returns the remapped
 * document, or null if there's nothing to import (fresh install, or read failure).
 */
export async function importLegacyIndexedDB(): Promise<AppData | null> {
  if (typeof indexedDB === 'undefined') return null;
  let db: IDBDatabase | null = null;
  try {
    db = await openLegacyDb();
    if (!db) return null;
    const names = Array.from(db.objectStoreNames);
    if (!names.includes('trips') && !names.includes('library')) return null;
    const oldTrips = names.includes('trips') ? await getAll<Trip>(db, 'trips') : [];
    const oldLibrary = names.includes('library') ? await getAll<LibraryItem>(db, 'library') : [];
    if (oldTrips.length === 0 && oldLibrary.length === 0) return null;
    return remapLegacyData(oldTrips, oldLibrary);
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
