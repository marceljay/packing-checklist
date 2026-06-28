import { getData, setData } from './store';
import { CATEGORIES, isBuiltinCategory, type Category } from '../types';

/**
 * Category management over the JSON document. Categories have no separate id —
 * identity is the trimmed name carried on each library item's `category`. A small
 * registry (`customCategories` for empty/added ones, `removedCategories` to hide
 * deleted/renamed built-ins) lets categories be added, renamed, and deleted while
 * every rename/delete rewrites the items so associations never drift.
 */

/** Where items go when their category is deleted; never itself deletable. */
export const FALLBACK_CATEGORY = 'Comfort & Misc';

/**
 * Every category to show, in order: built-ins (minus tombstoned) in canonical
 * order, then user/imported customs, then any category still present on an item.
 * De-duplicated, first-seen order. Drives the manager and the add/edit pickers.
 */
export function listCategories(): Category[] {
  const d = getData();
  const removed = new Set(d.removedCategories ?? []);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (c: string) => {
    if (c && !removed.has(c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  };
  for (const c of CATEGORIES) add(c);
  for (const c of d.customCategories ?? []) add(c);
  for (const item of d.library) add(item.category);
  return out;
}

/** The user/imported custom categories registry (for export). */
export function listCustomCategories(): string[] {
  return getData().customCategories ?? [];
}

/** Add a category (so it can exist with no items yet). No-op if already present;
 *  re-adding a tombstoned built-in just un-hides it instead of making a custom. */
export function addCategory(name: string): void {
  const c = name.trim();
  if (!c) return;
  setData((d) => {
    d.removedCategories = (d.removedCategories ?? []).filter((x) => x !== c);
    if (isBuiltinCategory(c)) return; // a built-in: un-tombstoning is enough
    if (!(d.customCategories ?? []).includes(c)) {
      d.customCategories = [...(d.customCategories ?? []), c];
    }
  });
}

/**
 * Rename a category everywhere: rewrite every library item `from → to`, drop the
 * old name from the registry (tombstone if built-in), and ensure the new name is
 * registered. Renaming onto an existing name merges into it. No-op for a blank
 * target or a rename onto itself. Items keep their place.
 */
export function renameCategory(from: string, to: string): void {
  const f = from.trim();
  const t = to.trim();
  if (!t || f === t) return;
  setData((d) => {
    d.library = d.library.map((i) => (i.category === f ? { ...i, category: t } : i));
    if (isBuiltinCategory(f)) d.removedCategories = [...new Set([...(d.removedCategories ?? []), f])];
    else d.customCategories = (d.customCategories ?? []).filter((x) => x !== f);
    if (isBuiltinCategory(t)) {
      d.removedCategories = (d.removedCategories ?? []).filter((x) => x !== t);
    } else if (!(d.customCategories ?? []).includes(t)) {
      d.customCategories = [...(d.customCategories ?? []), t];
    }
  });
}

/**
 * Delete a category: reassign every item carrying it to {@link FALLBACK_CATEGORY}
 * (items are never lost), then tombstone it (built-in) or drop it (custom). The
 * fallback category itself can't be deleted.
 */
export function deleteCategory(name: string): void {
  const c = name.trim();
  if (!c || c === FALLBACK_CATEGORY) return;
  setData((d) => {
    d.library = d.library.map((i) => (i.category === c ? { ...i, category: FALLBACK_CATEGORY } : i));
    if (isBuiltinCategory(c)) d.removedCategories = [...new Set([...(d.removedCategories ?? []), c])];
    else d.customCategories = (d.customCategories ?? []).filter((x) => x !== c);
  });
}
