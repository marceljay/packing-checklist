import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';

const DB_NAME = 'packing-checklist';

beforeEach(async () => {
  await Dexie.delete(DB_NAME);
});

describe('library primary-key migration (nameKey -> id)', () => {
  it('upgrades a v4 library to the id-keyed store without losing rows', async () => {
    // Seed a database in the pre-migration (v4) shape: library keyed by nameKey.
    const old = new Dexie(DB_NAME);
    old.version(4).stores({ trips: 'id, updatedAt', library: 'nameKey, id, count, lastUsed' });
    await old.open();
    await old.table('library').bulkPut([
      { id: 'pas81', nameKey: 'passport', name: 'Passport', category: 'Documents', tagKeys: [], custom: false, count: 0, lastUsed: 0 },
      { id: 'tsh41', nameKey: 'tshirt', name: 'T-shirt', category: 'Clothing', tagKeys: ['casual'], custom: true, count: 2, lastUsed: 5 },
    ]);
    old.close();

    // Open the real app database, which runs the v5/v6/v7 upgrade chain.
    const { db } = await import('./db');
    await db.open();

    const rows = await db.library.orderBy('id').toArray();
    expect(rows.map((r) => r.id).sort()).toEqual(['pas81', 'tsh41']);
    // id is now the primary key — look-ups by id resolve directly.
    expect((await db.library.get('tsh41'))?.name).toBe('T-shirt');
    expect((await db.library.get('tsh41'))?.tagKeys).toEqual(['casual']);
    db.close();
  });
});
