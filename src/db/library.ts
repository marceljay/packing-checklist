import { getData, setData } from './store';
import { customId, tagKey, type Category, type LibraryItem } from '../types';
import { forkDefault } from './appData';
import { CATALOG } from '../data/catalog';
import { catalogToLibraryItems } from '../data/seed';

/**
 * The item library lives in the JSON document (`store.ts`). Built-in defaults are
 * seeded (deterministic `d:<catalogId>` ids, `custom:false`); user items get a
 * collision-resistant `c:` id. Identity is the `id`; `nameKey` is only a
 * convenience for the typed-add "reuse same-named row" path and for search.
 */

/** Seed built-in defaults into the document (idempotent by id). */
export function seedLibrary(): void {
  const seeds = catalogToLibraryItems(CATALOG);
  setData((d) => {
    const have = new Set(d.library.map((i) => i.id));
    for (const s of seeds) if (!have.has(s.id)) d.library.push(s);
  });
}

/** All library items, normalized so callers always see tagKeys/custom. */
export function listLibrary(): LibraryItem[] {
  return getData().library.map((r) => ({ ...r, tagKeys: r.tagKeys ?? [], custom: r.custom ?? true }));
}

/** Look up a library row by its id. */
export function getLibraryItem(id: string): LibraryItem | undefined {
  return getData().library.find((i) => i.id === id);
}

/**
 * Resolve a library item by name, or create it (fresh `c:` id) if no row with that
 * normalized name exists. Merges any new tagKeys into the resolved row. Does NOT
 * bump usage — use {@link rememberItem}. Returns the row.
 */
export function ensureLibraryItem(name: string, category: Category, tagKeys: string[] = []): LibraryItem {
  const clean = name.trim();
  const nameKey = tagKey(clean);
  const existing = getData().library.find((i) => i.nameKey === nameKey);
  if (existing) {
    const merged = [...new Set([...(existing.tagKeys ?? []), ...tagKeys])];
    const row: LibraryItem = { ...existing, tagKeys: merged };
    setData((d) => {
      const i = d.library.findIndex((x) => x.id === row.id);
      if (i >= 0) d.library[i] = row;
    });
    return row;
  }
  const row: LibraryItem = {
    id: customId(),
    nameKey,
    name: clean,
    category,
    tagKeys: [...new Set(tagKeys)],
    custom: true,
    count: 0,
    lastUsed: 0,
  };
  setData((d) => d.library.push(row));
  return row;
}

/** Insert a library row preserving a given id (import). If the id is taken by a
 *  DIFFERENT item a fresh `c:` id is minted. Returns the stored row. */
export function putWithId(item: LibraryItem): LibraryItem {
  const clash = getData().library.find((i) => i.id === item.id);
  const id = clash && clash.nameKey !== item.nameKey ? customId() : item.id;
  const row = { ...item, id };
  setData((d) => {
    const i = d.library.findIndex((x) => x.id === row.id);
    if (i >= 0) d.library[i] = row;
    else d.library.push(row);
  });
  return row;
}

/** Record a use of an item (resolve/create by name, bump count). Returns the row. */
export function rememberItem(name: string, category: Category, tagKeys: string[] = []): LibraryItem {
  const row = ensureLibraryItem(name, category, tagKeys);
  const bumped: LibraryItem = { ...row, count: row.count + 1, lastUsed: Date.now() };
  setData((d) => {
    const i = d.library.findIndex((x) => x.id === bumped.id);
    if (i >= 0) d.library[i] = bumped;
  });
  return bumped;
}

/**
 * Edit a library item's shared fields by id. Editing a built-in **default forks it
 * into a custom** (new id, `custom:true`, trip refs rewired — see {@link forkDefault}),
 * so the pristine default can later be restored. A provided `tagKeys` REPLACES the
 * stored set. Rejects (returns `{ ok:false }`) a rename onto a name a DIFFERENT item
 * already uses. Returns the effective id (new if the default was forked).
 */
export function editLibraryItem(
  id: string,
  patch: { name?: string; category?: Category; tagKeys?: string[]; notes?: string },
): { ok: boolean; id: string } {
  let result = { ok: false, id };
  setData((d) => {
    const cur = d.library.find((i) => i.id === id);
    if (!cur) return;

    let newKey = cur.nameKey;
    if (patch.name !== undefined) {
      const clean = patch.name.trim();
      if (!clean) return;
      newKey = tagKey(clean);
      if (newKey !== cur.nameKey && d.library.some((i) => i.nameKey === newKey && i.id !== id)) {
        return; // name collision → abort, no changes
      }
    }

    const realId = cur.custom ? id : forkDefault(d, id, customId());
    const row = d.library.find((i) => i.id === realId)!;
    if (patch.name !== undefined) {
      row.name = patch.name.trim();
      row.nameKey = newKey;
    }
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.tagKeys !== undefined) row.tagKeys = [...new Set(patch.tagKeys)];
    if (patch.notes !== undefined) row.notes = patch.notes.trim() || undefined;
    result = { ok: true, id: realId };
  });
  return result;
}

/** Remove an item from the library by id (does not touch any trip). */
export function forgetItemById(id: string): void {
  setData((d) => {
    d.library = d.library.filter((i) => i.id !== id);
  });
}

/** Re-add any built-in defaults that are missing (deleted, or forked into customs),
 *  without touching the user's custom items. Idempotent — same as seeding. */
export function restoreDefaults(): void {
  seedLibrary();
}

/**
 * Merge parsed library rows (from an import) into the store. De-dups by id: a row
 * whose id already exists is left untouched; a new id is inserted preserving it; a
 * row without an id is resolved/created by name. Returns how many rows were added.
 */
export function importLibraryItems(
  items: {
    id?: string;
    nameKey: string;
    name: string;
    category: Category;
    tagKeys: string[];
    custom: boolean;
    essential?: boolean;
    quantity?: LibraryItem['quantity'];
    count?: number;
    lastUsed?: number;
  }[],
): number {
  let added = 0;
  for (const li of items) {
    if (li.id) {
      if (getLibraryItem(li.id)) continue; // already present — keep local copy
      putWithId({
        id: li.id,
        nameKey: li.nameKey,
        name: li.name,
        category: li.category,
        tagKeys: li.tagKeys,
        custom: li.custom,
        count: li.count ?? 0,
        lastUsed: li.lastUsed ?? 0,
        ...(li.essential ? { essential: true } : {}),
        ...(li.quantity ? { quantity: li.quantity } : {}),
      });
      added += 1;
    } else {
      const before = getData().library.find((i) => i.nameKey === li.nameKey);
      ensureLibraryItem(li.name, li.category, li.tagKeys);
      if (!before) added += 1;
    }
  }
  return added;
}
