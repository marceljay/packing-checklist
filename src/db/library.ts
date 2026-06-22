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
 * are seeded into it (flagged `custom:false`); user items are `custom:true`. Each
 * row has a stable short `id` that trips reference; the Dexie primary key is the
 * `nameKey` (a rename re-keys it but preserves `id`).
 */

/** Read the set of every short id currently in use (for collision-free minting). */
async function takenIds(): Promise<Set<string>> {
  const rows = await db.library.toArray();
  return new Set(rows.map((r) => r.id).filter(Boolean));
}

/**
 * Seed the built-in defaults into the library (idempotent — only adds items whose
 * nameKey isn't already present, so user edits/removals are never clobbered). Each
 * new row gets a freshly minted short id. Called once at app start.
 */
export async function seedLibrary(): Promise<void> {
  const seeds = catalogToLibraryItems(CATALOG);
  await db.transaction('rw', db.library, async () => {
    const existing = new Set(await db.library.toCollection().primaryKeys());
    const taken = await takenIds();
    const missing = seeds
      .filter((s) => !existing.has(s.nameKey))
      .map((s) => {
        const id = shortId(s.name, taken);
        taken.add(id);
        return { ...s, id };
      });
    if (missing.length > 0) await db.library.bulkAdd(missing);
  });
}

/** All library items (unordered — sort at the call site).
 *  Normalizes old rows lacking `tagKeys`/`custom` so callers always see them. */
export async function listLibrary(): Promise<LibraryItem[]> {
  const rows = await db.library.toArray();
  return rows.map((row) => ({ ...row, tagKeys: row.tagKeys ?? [], custom: row.custom ?? true }));
}

/** Look up a library row by its stable short id. */
export async function getLibraryItem(id: string): Promise<LibraryItem | undefined> {
  return db.library.where('id').equals(id).first();
}

/**
 * Resolve a library item by name, or create it (with a fresh short id) if new.
 * Merges any new `tagKeys` into an existing row. Does NOT bump usage — use
 * {@link rememberItem} for that. Returns the row so callers get its `id`.
 */
export async function ensureLibraryItem(
  name: string,
  category: Category,
  tagKeys: string[] = [],
): Promise<LibraryItem> {
  const clean = name.trim();
  const nameKey = tagKey(clean);
  return db.transaction('rw', db.library, async () => {
    const existing = await db.library.get(nameKey);
    if (existing) {
      const merged = [...new Set([...(existing.tagKeys ?? []), ...tagKeys])];
      const id = existing.id ?? shortId(clean, await takenIds());
      const row: LibraryItem = { ...existing, id, tagKeys: merged };
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

/** Record a use of an item (upsert by nameKey, bump count, merge tagKeys, mint an
 *  id if missing). Returns the row so callers can reference its `id`. */
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

/** Edit a saved library item by id. A provided `tagKeys` REPLACES the stored set. */
export async function updateItemById(
  id: string,
  patch: { category?: Category; tagKeys?: string[] },
): Promise<void> {
  await db.transaction('rw', db.library, async () => {
    const existing = await db.library.where('id').equals(id).first();
    if (!existing) return;
    await db.library.put({ ...existing, tagKeys: existing.tagKeys ?? [], ...patch });
  });
}

/**
 * Rename a library item by id. The `nameKey` (Dexie primary key) is derived from
 * the name, so a rename re-keys the row — but the stable `id` is preserved, so
 * trip references survive. Rejects (returns false) a rename whose new name
 * collides with a different existing item, which would otherwise orphan refs.
 */
export async function renameLibraryItemById(id: string, newName: string): Promise<boolean> {
  const clean = newName.trim();
  if (!clean) return false;
  const newKey = tagKey(clean);
  return db.transaction('rw', db.library, async () => {
    const existing = await db.library.where('id').equals(id).first();
    if (!existing) return false;
    if (newKey === existing.nameKey) {
      await db.library.put({ ...existing, name: clean });
      return true;
    }
    const collision = await db.library.get(newKey);
    if (collision) return false; // a different item already owns this name
    await db.library.delete(existing.nameKey);
    await db.library.put({ ...existing, nameKey: newKey, name: clean });
    return true;
  });
}

/** Remove an item from the library by id (does not touch any trip). */
export async function forgetItemById(id: string): Promise<void> {
  await db.transaction('rw', db.library, async () => {
    const existing = await db.library.where('id').equals(id).first();
    if (existing) await db.library.delete(existing.nameKey);
  });
}

/**
 * Convert any pre-v2 trips (whose items carried their own name/category/tagIds)
 * into the reference shape (`libraryId` + per-trip state), creating/resolving the
 * backing library rows. Idempotent: trips already at the current schema version
 * are skipped. Run once at startup, after {@link seedLibrary}.
 */
export async function migrateTripsToLibraryRefs(): Promise<void> {
  const trips = await db.trips.toArray();
  for (const trip of trips) {
    if ((trip.schemaVersion ?? 0) >= CURRENT_SCHEMA_VERSION) continue;

    const items: Item[] = [];
    const seen = new Set<string>();
    for (const raw of trip.items ?? []) {
      // Already a reference? keep as-is.
      if (raw && typeof raw === 'object' && 'libraryId' in raw) {
        const it = raw as Item;
        if (!seen.has(it.libraryId)) {
          seen.add(it.libraryId);
          items.push(it);
        }
        continue;
      }
      const legacy = raw as { name?: string; quantitySuggested?: unknown; quantityTaken?: unknown; packed?: unknown };
      const ref = legacyItemToRef(legacy as Parameters<typeof legacyItemToRef>[0], trip.tags ?? []);
      if (!ref.name) continue; // drop nameless junk
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
