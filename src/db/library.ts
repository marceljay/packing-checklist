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

/** Edit a saved library item (name, category, and/or tagKeys). */
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

/** Remove an item from the library (does not touch any trip). */
export function forgetItem(nameKey: string): Promise<void> {
  return db.library.delete(nameKey);
}
