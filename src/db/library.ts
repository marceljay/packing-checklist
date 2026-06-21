import { db } from './db';
import { tagKey, type Category, type LibraryItem } from '../types';

/**
 * Personal custom-item library. Lives outside any trip so a custom item the user
 * adds once resurfaces on future trips (see `rankLibrary` for ordering).
 */

/** All remembered items (unordered — rank with `rankLibrary` at the call site).
 *  Normalizes old rows lacking `tagKeys` so callers always see the field. */
export async function listLibrary(): Promise<LibraryItem[]> {
  const rows = await db.library.toArray();
  return rows.map((row) => ({ ...row, tagKeys: row.tagKeys ?? [] }));
}

/** Record that a custom item was used: upsert by normalized name, bump count,
 *  and merge tagKeys (union with any already stored). */
export async function rememberItem(
  name: string,
  category: Category,
  tagKeys: string[] = [],
): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const nameKey = tagKey(clean);
  await db.transaction('rw', db.library, async () => {
    const existing = await db.library.get(nameKey);
    const mergedKeys = existing?.tagKeys
      ? [...new Set([...existing.tagKeys, ...tagKeys])]
      : [...new Set(tagKeys)];
    await db.library.put({
      nameKey,
      name: clean,
      category,
      count: (existing?.count ?? 0) + 1,
      lastUsed: Date.now(),
      tagKeys: mergedKeys,
    });
  });
}

/** Edit a saved library item. A provided `tagKeys` REPLACES the stored set
 *  (not merged) — for explicit edits on the manage page. */
export async function updateItem(
  nameKey: string,
  patch: { name?: string; category?: Category; tagKeys?: string[] },
): Promise<void> {
  await db.transaction('rw', db.library, async () => {
    const existing = await db.library.get(nameKey);
    if (!existing) return;
    await db.library.put({ ...existing, tagKeys: existing.tagKeys ?? [], ...patch });
  });
}

/**
 * Rename a saved item. Because `nameKey` is derived from the name, a rename
 * re-keys the row so the invariant `nameKey === tagKey(name)` always holds
 * (the tray's "already on trip" check and de-duping depend on it). If the new
 * name collides with an existing item, the two are merged (counts summed, tags
 * unioned) rather than forking into duplicate rows.
 */
export async function renameLibraryItem(oldKey: string, newName: string): Promise<void> {
  const clean = newName.trim();
  if (!clean) return;
  const newKey = tagKey(clean);
  await db.transaction('rw', db.library, async () => {
    const existing = await db.library.get(oldKey);
    if (!existing) return;
    if (newKey === oldKey) {
      await db.library.put({ ...existing, name: clean });
      return;
    }
    const collision = await db.library.get(newKey);
    if (collision) {
      await db.library.put({
        ...collision,
        name: clean,
        count: collision.count + existing.count,
        lastUsed: Math.max(collision.lastUsed, existing.lastUsed),
        tagKeys: [...new Set([...(collision.tagKeys ?? []), ...(existing.tagKeys ?? [])])],
      });
    } else {
      await db.library.put({ ...existing, nameKey: newKey, name: clean });
    }
    await db.library.delete(oldKey);
  });
}

/** Remove an item from the library (does not touch any trip). */
export function forgetItem(nameKey: string): Promise<void> {
  return db.library.delete(nameKey);
}
