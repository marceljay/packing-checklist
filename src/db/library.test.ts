import { describe, it, expect, beforeEach } from 'vitest';
import {
  seedLibrary,
  listLibrary,
  getLibraryItem,
  rememberItem,
  ensureLibraryItem,
  editLibraryItem,
  forgetItemById,
  restoreDefaults,
} from './library';
import { getData, setData } from './store';

const defaults = () => listLibrary().filter((i) => !i.custom);
const aDefault = () => defaults()[0];

beforeEach(() => {
  setData((d) => {
    d.library = [];
    d.trips = [];
    d.removedDefaultIds = [];
  });
});

describe('seedLibrary', () => {
  it('seeds the built-in defaults on first run', () => {
    seedLibrary();
    expect(defaults().length).toBeGreaterThan(0);
  });

  it('is idempotent — re-seeding adds no duplicates', () => {
    seedLibrary();
    const n = listLibrary().length;
    seedLibrary();
    expect(listLibrary().length).toBe(n);
  });
});

describe('trip-page mutations reflect in the library', () => {
  it('rememberItem stores a new custom item with its tags', () => {
    const row = rememberItem('Sunscreen', 'Toiletries & Health', ['beach']);
    const found = getLibraryItem(row.id);
    expect(found?.name).toBe('Sunscreen');
    expect(found?.tagKeys).toEqual(['beach']);
    expect(found?.custom).toBe(true);
  });

  it('ensureLibraryItem merges new tags into an existing item', () => {
    const a = ensureLibraryItem('Hat', 'Clothing', ['sun']);
    const b = ensureLibraryItem('Hat', 'Clothing', ['beach']);
    expect(b.id).toBe(a.id); // same row, resolved by name
    expect(getLibraryItem(a.id)?.tagKeys.sort()).toEqual(['beach', 'sun']);
  });

  it('stores and clears a default quantity rule', () => {
    const row = rememberItem('Contact lenses', 'Toiletries & Health', []);
    editLibraryItem(row.id, { quantity: { kind: 'perTrip', count: 14 } });
    expect(getLibraryItem(row.id)?.quantity).toEqual({ kind: 'perTrip', count: 14 });
    editLibraryItem(row.id, { quantity: null });
    expect(getLibraryItem(row.id)?.quantity).toBeUndefined();
  });

  it('editing a default item forks it and reflects the new tags', () => {
    seedLibrary();
    const def = aDefault();
    const res = editLibraryItem(def.id, { tagKeys: ['xyztag'] });
    expect(res.ok).toBe(true);
    expect(res.id).not.toBe(def.id); // forked into a new custom id
    expect(getLibraryItem(res.id)?.tagKeys).toContain('xyztag');
    expect(getLibraryItem(def.id)).toBeUndefined(); // old default slot freed
  });
});

describe('removed/edited defaults survive a reload (do not get re-seeded)', () => {
  it('a deleted default is not resurrected by the boot seeder', () => {
    seedLibrary();
    const def = aDefault();
    forgetItemById(def.id);
    expect(getData().removedDefaultIds).toContain(def.id);

    seedLibrary(); // simulate next boot
    expect(getLibraryItem(def.id)).toBeUndefined();
  });

  it('an edited (forked) default does not reappear as a duplicate on reload', () => {
    seedLibrary();
    const def = aDefault();
    const before = listLibrary().length;
    editLibraryItem(def.id, { tagKeys: ['mine'] }); // forks → freed slot tombstoned

    seedLibrary(); // simulate next boot
    // No pristine default came back; count is unchanged (fork replaced in place).
    expect(getLibraryItem(def.id)).toBeUndefined();
    expect(listLibrary().filter((i) => i.nameKey === def.nameKey)).toHaveLength(1);
    expect(listLibrary().length).toBe(before);
  });
});

describe('restoreDefaults', () => {
  it('re-adds removed defaults and clears the tombstones', () => {
    seedLibrary();
    const def = aDefault();
    forgetItemById(def.id);
    expect(getLibraryItem(def.id)).toBeUndefined();

    restoreDefaults();
    expect(getLibraryItem(def.id)).toBeDefined();
    expect(getData().removedDefaultIds).toEqual([]);
  });

  it('leaves custom items untouched', () => {
    const mine = rememberItem('My thing', 'Comfort & Misc', []);
    restoreDefaults();
    expect(getLibraryItem(mine.id)?.name).toBe('My thing');
  });
});
