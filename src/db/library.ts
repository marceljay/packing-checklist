import { db } from './db';
import { tagKey, type Category, type LibraryItem } from '../types';

/**
 * Personal custom-item library. Lives outside any trip so a custom item the user
 * adds once resurfaces on future trips (see `rankLibrary` for ordering).
 */

/** All remembered items (unordered — rank with `rankLibrary` at the call site). */
export function listLibrary(): Promise<LibraryItem[]> {
  return db.library.toArray();
}

/** Record that a custom item was used: upsert by normalized name, bump count. */
export async function rememberItem(name: string, category: Category): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const nameKey = tagKey(clean);
  await db.transaction('rw', db.library, async () => {
    const existing = await db.library.get(nameKey);
    await db.library.put({
      nameKey,
      name: clean,
      category,
      count: (existing?.count ?? 0) + 1,
      lastUsed: Date.now(),
    });
  });
}

/** Remove an item from the library (does not touch any trip). */
export function forgetItem(nameKey: string): Promise<void> {
  return db.library.delete(nameKey);
}
