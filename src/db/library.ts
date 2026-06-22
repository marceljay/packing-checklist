import { db, CURRENT_SCHEMA_VERSION, type StoredTrip } from './db';
import {
  shortId,
  tagKey,
  legacyItemToRef,
  type Category,
  type Item,
  type LibraryItem,
} from '../types';
import { CATALOG } from '../data/catalog';
import { catalogToLibraryItems } from '../data/seed';

/**
 * The `library` store is the single source of truth for items. Built-in defaults
 * are seeded (flagged `custom:false`); user items are `custom:true`. Identity is
 * the stable short `id` (the Dexie primary key) — two items may share a name. The
 * `nameKey` index supports name-based resolution for the typed-add path.
 */

/** The set of every short id currently in use (for collision-free minting). */
async function takenIds(): Promise<Set<string>> {
  return new Set((await db.library.toArray()).map((r) => r.id).filter(Boolean));
}

/** Mint a fresh, collision-free short id for a new library row. */
export async function mintLibraryId(name: string): Promise<string> {
  return shortId(name, await takenIds());
}

/**
 * Seed the built-in defaults (idempotent by `nameKey` — only adds defaults the
 * user doesn't already have, so edits/removals are never clobbered). Each new row
 * gets a freshly minted short id. Called once at app start.
 */
export async function seedLibrary(): Promise<void> {
  const seeds = catalogToLibraryItems(CATALOG);
  await db.transaction('rw', db.library, async () => {
    const rows = await db.library.toArray();
    const existingKeys = new Set(rows.map((r) => r.nameKey));
    const taken = new Set(rows.map((r) => r.id).filter(Boolean));
    const missing = seeds
      .filter((s) => !existingKeys.has(s.nameKey))
      .map((s) => {
        const id = shortId(s.name, taken);
        taken.add(id);
        return { ...s, id };
      });
    if (missing.length > 0) await db.library.bulkAdd(missing);
  });
}

/** All library items (unordered — sort at the call site). Normalizes old rows. */
export async function listLibrary(): Promise<LibraryItem[]> {
  const rows = await db.library.toArray();
  return rows.map((row) => ({ ...row, tagKeys: row.tagKeys ?? [], custom: row.custom ?? true }));
}

/** Look up a library row by its primary-key id. */
export async function getLibraryItem(id: string): Promise<LibraryItem | undefined> {
  return db.library.get(id);
}

/**
 * Resolve a library item by name, or create it (fresh short id) if no row with
 * that normalized name exists. Merges any new `tagKeys` into the resolved row.
 * Does NOT bump usage — use {@link rememberItem}. Returns the row.
 */
export async function ensureLibraryItem(
  name: string,
  category: Category,
  tagKeys: string[] = [],
): Promise<LibraryItem> {
  const clean = name.trim();
  const nameKey = tagKey(clean);
  return db.transaction('rw', db.library, async () => {
    const existing = await db.library.where('nameKey').equals(nameKey).first();
    if (existing) {
      const merged = [...new Set([...(existing.tagKeys ?? []), ...tagKeys])];
      const row: LibraryItem = { ...existing, tagKeys: merged };
      await db.library.put(row);
      return row;
    }
    const row: LibraryItem = {
      id: shortId(clean, await takenIds()),
      nameKey,
      name: clean,
      category,
      tagKeys: [...new Set(tagKeys)],
      custom: true,
      count: 0,
      lastUsed: 0,
    };
    await db.library.put(row);
    return row;
  });
}

/** Insert a library row preserving a given id (used by import to keep identity
 *  across devices). If the id is already taken by a DIFFERENT item, a fresh id is
 *  minted. Returns the stored row. */
export async function putWithId(item: LibraryItem): Promise<LibraryItem> {
  return db.transaction('rw', db.library, async () => {
    const clash = await db.library.get(item.id);
    const id = clash && clash.nameKey !== item.nameKey ? shortId(item.name, await takenIds()) : item.id;
    const row = { ...item, id };
    await db.library.put(row);
    return row;
  });
}

/** Record a use of an item (resolve/create by name, bump count). Returns the row. */
export async function rememberItem(
  name: string,
  category: Category,
  tagKeys: string[] = [],
): Promise<LibraryItem> {
  const row = await ensureLibraryItem(name, category, tagKeys);
  const bumped: LibraryItem = { ...row, count: row.count + 1, lastUsed: Date.now() };
  await db.library.put(bumped);
  return bumped;
}

/** Edit a library item by id. A provided `tagKeys` REPLACES the stored set. */
export async function updateItemById(
  id: string,
  patch: { category?: Category; tagKeys?: string[] },
): Promise<void> {
  await db.transaction('rw', db.library, async () => {
    const existing = await db.library.get(id);
    if (!existing) return;
    await db.library.put({ ...existing, tagKeys: existing.tagKeys ?? [], ...patch });
  });
}

/**
 * Rename a library item by id (id is stable, so this is an in-place update of the
 * name + nameKey). Rejects (returns false) a manual rename onto a name a DIFFERENT
 * item already uses, keeping the typed-edit paths free of accidental duplicates
 * (import may still create same-named rows by design).
 */
export async function renameLibraryItemById(id: string, newName: string): Promise<boolean> {
  const clean = newName.trim();
  if (!clean) return false;
  const newKey = tagKey(clean);
  return db.transaction('rw', db.library, async () => {
    const existing = await db.library.get(id);
    if (!existing) return false;
    if (newKey !== existing.nameKey) {
      const collision = await db.library.where('nameKey').equals(newKey).first();
      if (collision && collision.id !== id) return false;
    }
    await db.library.put({ ...existing, name: clean, nameKey: newKey });
    return true;
  });
}

/** Remove an item from the library by id (does not touch any trip). */
export async function forgetItemById(id: string): Promise<void> {
  await db.library.delete(id);
}

/**
 * Convert any pre-v2 trips (whose items carried their own name/category/tagIds)
 * into the reference shape (`libraryId` + per-trip state), resolving/creating the
 * backing library rows. Idempotent. Run once at startup, after {@link seedLibrary}.
 */
export async function migrateTripsToLibraryRefs(): Promise<void> {
  const trips = await db.trips.toArray();
  for (const trip of trips) {
    if ((trip.schemaVersion ?? 0) >= CURRENT_SCHEMA_VERSION) continue;

    const items: Item[] = [];
    const seen = new Set<string>();
    for (const raw of trip.items ?? []) {
      if (raw && typeof raw === 'object' && 'libraryId' in raw) {
        const it = raw as Item;
        if (!seen.has(it.libraryId)) {
          seen.add(it.libraryId);
          items.push(it);
        }
        continue;
      }
      const legacy = raw as {
        name?: string;
        quantitySuggested?: unknown;
        quantityTaken?: unknown;
        packed?: unknown;
      };
      const ref = legacyItemToRef(legacy as Parameters<typeof legacyItemToRef>[0], trip.tags ?? []);
      if (!ref.name) continue;
      const row = await ensureLibraryItem(ref.name, ref.category, ref.tagKeys);
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      items.push({
        libraryId: row.id,
        quantitySuggested:
          typeof legacy.quantitySuggested === 'number' ? legacy.quantitySuggested : null,
        quantityTaken: typeof legacy.quantityTaken === 'number' ? legacy.quantityTaken : 1,
        packed: legacy.packed === true,
      });
    }

    const next: StoredTrip = { ...trip, items, schemaVersion: CURRENT_SCHEMA_VERSION };
    await db.trips.put(next);
  }
}
