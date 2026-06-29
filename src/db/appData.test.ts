import { describe, it, expect } from 'vitest';
import { normalizeAppData, emptyData, forkDefault, CURRENT_SCHEMA_VERSION, type AppData } from './appData';
import type { LibraryItem, Trip } from '../types';

describe('normalizeAppData', () => {
  it('returns empty data for null/garbage input', () => {
    expect(normalizeAppData(null)).toEqual(emptyData());
    expect(normalizeAppData('nope')).toEqual(emptyData());
    expect(normalizeAppData(42)).toEqual(emptyData());
  });

  it('keeps valid trips and library arrays and stamps the current version', () => {
    const raw = { schemaVersion: 0, trips: [{ id: 't1' }], library: [{ id: 'd:passport' }] };
    const data = normalizeAppData(raw);
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.trips).toHaveLength(1);
    expect(data.library).toHaveLength(1);
  });

  it('defaults missing arrays to empty', () => {
    expect(normalizeAppData({})).toEqual(emptyData());
    expect(normalizeAppData({ trips: 'bad', library: null })).toEqual(emptyData());
  });
});

describe('forkDefault', () => {
  function data(): AppData {
    const lib: LibraryItem[] = [
      { id: 'd:passport', nameKey: 'passport', name: 'Passport', category: 'Documents', tagKeys: [], custom: false, count: 0, lastUsed: 0 },
      { id: 'c:abc', nameKey: 'socks', name: 'Socks', category: 'Clothing', tagKeys: [], custom: true, count: 0, lastUsed: 0 },
    ];
    const trips: Trip[] = [
      {
        id: 't1', name: 'Trip', destinations: [], tags: [],
        items: [
          { libraryId: 'd:passport', quantitySuggested: null, quantityTaken: 1, packed: false },
          { libraryId: 'c:abc', quantitySuggested: null, quantityTaken: 1, packed: false },
        ],
        settings: { laundryAvailable: false }, createdAt: 0, updatedAt: 0,
      },
    ];
    return { schemaVersion: CURRENT_SCHEMA_VERSION, trips, library: lib, tagMeta: [], removedTagKeys: [], customCategories: [], removedCategories: [] };
  }

  it('re-keys a default to custom and rewires trip references', () => {
    const d = data();
    const id = forkDefault(d, 'd:passport', 'c:new');
    expect(id).toBe('c:new');
    const row = d.library.find((i) => i.name === 'Passport')!;
    expect(row.id).toBe('c:new');
    expect(row.custom).toBe(true);
    expect(d.trips[0].items[0].libraryId).toBe('c:new');
    expect(d.trips[0].items[1].libraryId).toBe('c:abc'); // untouched
    expect(d.removedDefaultIds).toContain('d:passport'); // freed slot tombstoned
  });

  it('is a no-op for an already-custom item', () => {
    const d = data();
    expect(forkDefault(d, 'c:abc', 'c:new')).toBe('c:abc');
    expect(d.library.find((i) => i.id === 'c:abc')).toBeDefined();
  });

  it('is a no-op for a missing id', () => {
    const d = data();
    expect(forkDefault(d, 'nope', 'c:new')).toBe('nope');
  });
});
