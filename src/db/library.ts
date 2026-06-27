import { getData, setData } from './store';
import {
  customId,
  isBuiltinCategory,
  tagKey,
  type Category,
  type LibraryItem,
  type QuantityRule,
} from '../types';
import { forkDefault } from './appData';
import { CATALOG } from '../data/catalog';
import { catalogToLibraryItems } from '../data/seed';
import type { ParsedLibraryItem, LibraryImportPlan, ConflictResolution } from './libraryTransfer';
import { replaceTagMeta, mergeTagMeta } from './tags';
import type { TagMeta } from '../types';

/**
 * The item library lives in the JSON document (`store.ts`). Built-in defaults are
 * seeded (deterministic `d:<catalogId>` ids, `custom:false`); user items get a
 * collision-resistant `c:` id. Identity is the `id`; `nameKey` is only a
 * convenience for the typed-add "reuse same-named row" path and for search.
 */

/**
 * Seed built-in defaults on boot. Idempotent by id, and — crucially — skips
 * defaults the user has removed or edited (tombstoned in `removedDefaultIds`), so
 * deletions and edits survive a reload. New catalog defaults (from an app update)
 * are still added. Use {@link restoreDefaults} to bring tombstoned defaults back.
 */
export function seedLibrary(): void {
  const seeds = catalogToLibraryItems(CATALOG);
  setData((d) => {
    const have = new Set(d.library.map((i) => i.id));
    const removed = new Set(d.removedDefaultIds ?? []);
    for (const s of seeds) if (!have.has(s.id) && !removed.has(s.id)) d.library.push(s);
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
  patch: {
    name?: string;
    category?: Category;
    tagKeys?: string[];
    notes?: string;
    /** A rule sets the default add quantity; null clears it (back to 1). */
    quantity?: QuantityRule | null;
    /** Whether the item is suggested on every trip (an "essential"). */
    essential?: boolean;
  },
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
    if (patch.quantity !== undefined) row.quantity = patch.quantity ?? undefined;
    if (patch.essential !== undefined) row.essential = patch.essential || undefined;
    result = { ok: true, id: realId };
  });
  return result;
}

/** Remove an item from the library by id (does not touch any trip). Removing a
 *  built-in default tombstones it so the boot seeder won't bring it back. */
export function forgetItemById(id: string): void {
  setData((d) => {
    d.library = d.library.filter((i) => i.id !== id);
    if (id.startsWith('d:')) {
      d.removedDefaultIds = [...new Set([...(d.removedDefaultIds ?? []), id])];
    }
  });
}

/** Re-add any built-in defaults that are missing (deleted, or forked into customs),
 *  without touching the user's custom items. Clears the removed-defaults tombstones
 *  so the restored defaults stick. */
export function restoreDefaults(): void {
  const seeds = catalogToLibraryItems(CATALOG);
  setData((d) => {
    d.removedDefaultIds = [];
    const have = new Set(d.library.map((i) => i.id));
    for (const s of seeds) if (!have.has(s.id)) d.library.push(s);
  });
}

/** Categories carried by `cats` that are neither built-in nor already present in
 *  `prior` — i.e. the brand-new sections an import introduces. First-seen order. */
function newCategoriesFrom(cats: Iterable<string>, prior: LibraryItem[]): string[] {
  const known = new Set<string>(prior.map((i) => i.category));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of cats) {
    if (!c || isBuiltinCategory(c) || known.has(c) || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** Build a full library row from a parsed import item under a given id. */
function rowFromParsed(p: ParsedLibraryItem, id: string): LibraryItem {
  return {
    id,
    nameKey: p.nameKey,
    name: p.name,
    category: p.category,
    tagKeys: p.tagKeys,
    custom: p.custom,
    count: p.count,
    lastUsed: p.lastUsed,
    ...(p.essential ? { essential: true } : {}),
    ...(p.quantity ? { quantity: p.quantity } : {}),
  };
}

/**
 * Replace-all import: wipe the library and load the parsed items as-is (ids
 * preserved; clashing/absent ids get a fresh `c:` id). Clears the removed-default
 * tombstones, so built-ins missing from the file reappear on the next load.
 * Returns the count plus any new (non-built-in) categories the file introduces.
 */
export function replaceLibrary(
  incoming: ParsedLibraryItem[],
  tagMeta: TagMeta[] = [],
): { count: number; newCategories: string[] } {
  const newCategories = newCategoriesFrom(
    incoming.map((p) => p.category),
    getData().library,
  );
  setData((d) => {
    const rows: LibraryItem[] = [];
    const used = new Set<string>();
    for (const p of incoming) {
      const id = p.id && !used.has(p.id) ? p.id : customId();
      used.add(id);
      rows.push(rowFromParsed(p, id));
    }
    d.library = rows;
    d.removedDefaultIds = [];
  });
  // Replace the registry with the file's, then backfill any tag the rows use
  // but the file's registry omitted (so no imported item is left ungrouped).
  replaceTagMeta(tagMeta);
  mergeTagMeta(missingTagMeta(incoming, getData().tagMeta));
  return { count: incoming.length, newCategories };
}

/** Registry entries (group 'other', non-default) for every tag the parsed items
 *  use that the given registry doesn't yet cover — keeps imports fully grouped. */
function missingTagMeta(items: ParsedLibraryItem[], have: TagMeta[]): TagMeta[] {
  const known = new Set(have.map((t) => t.key));
  const out: TagMeta[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    for (const k of it.tagKeys) {
      if (!known.has(k) && !seen.has(k)) {
        seen.add(k);
        out.push({ key: k, group: 'other', default: false });
      }
    }
  }
  return out;
}

/**
 * Merge import with per-conflict resolution. Fresh items are added (id preserved
 * when free, else minted); id matches are skipped; each name conflict resolves to
 * **mine** (skip), **theirs** (overwrite the existing row's fields, keeping its id
 * so trip references survive), or **both** (add the incoming as a separate item).
 * `resolutions` is aligned to `plan.conflicts`. Returns a summary.
 */
export function applyLibraryImport(
  plan: LibraryImportPlan,
  resolutions: ConflictResolution[],
  tagMeta: TagMeta[] = [],
): { added: number; replaced: number; skipped: number; newCategories: string[] } {
  const prior = getData().library;
  // Categories of items actually added or overwritten — the import's footprint.
  const affectedCats: string[] = plan.fresh.map((p) => p.category);
  let added = 0;
  let replaced = 0;
  let skipped = plan.idMatches.length;
  setData((d) => {
    const insert = (p: ParsedLibraryItem) => {
      const id = p.id && !d.library.some((x) => x.id === p.id) ? p.id : customId();
      d.library.push(rowFromParsed(p, id));
    };
    for (const p of plan.fresh) {
      insert(p);
      added += 1;
    }
    plan.conflicts.forEach((c, i) => {
      const r = resolutions[i] ?? 'mine';
      if (r === 'mine') {
        skipped += 1;
      } else if (r === 'both') {
        insert(c.incoming);
        affectedCats.push(c.incoming.category);
        added += 1;
      } else {
        const row = d.library.find((x) => x.id === c.existing.id);
        if (row) {
          affectedCats.push(c.incoming.category);
          // Overwrite in place, keeping the existing id so trip refs survive.
          const p = c.incoming;
          row.name = p.name;
          row.nameKey = p.nameKey;
          row.category = p.category;
          row.tagKeys = p.tagKeys;
          row.custom = p.custom;
          row.count = p.count;
          row.lastUsed = p.lastUsed;
          row.essential = p.essential || undefined;
          row.quantity = p.quantity;
          replaced += 1;
        }
      }
    });
  });
  // Add registry entries for keys the file introduces; keep local grouping on
  // conflict. Then backfill any tag the items use that's still unregistered.
  mergeTagMeta(tagMeta);
  const added2 = [...plan.fresh, ...plan.conflicts.map((c) => c.incoming)];
  mergeTagMeta(missingTagMeta(added2, getData().tagMeta));
  return { added, replaced, skipped, newCategories: newCategoriesFrom(affectedCats, prior) };
}
