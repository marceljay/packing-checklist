import { describe, it, expect } from 'vitest';
import { remapLegacyData } from './legacy';
import type { CatalogItem, LibraryItem, Trip } from '../types';

const catalog: CatalogItem[] = [
  { id: 'passport', name: 'Passport', category: 'Documents', always: true, tagKeys: [], quantity: { kind: 'perTrip', count: 1 } },
];

function oldRow(over: Partial<LibraryItem>): LibraryItem {
  return { id: 'x', nameKey: 'x', name: 'X', category: 'Comfort & Misc', tagKeys: [], custom: true, count: 0, lastUsed: 0, ...over };
}

let n = 0;
const mkCustomId = () => `c:test${++n}`;

describe('remapLegacyData', () => {
  it('maps catalog-matching rows to deterministic d:<catalogId> defaults', () => {
    const lib = [oldRow({ id: 'pas81', nameKey: 'passport', name: 'Passport', category: 'Documents', custom: false })];
    const data = remapLegacyData([], lib, catalog, mkCustomId);
    expect(data.library[0].id).toBe('d:passport');
    expect(data.library[0].custom).toBe(false);
  });

  it('maps unknown rows to fresh c: customs', () => {
    n = 0;
    const lib = [oldRow({ id: 'glo10', nameKey: 'gloves', name: 'Gloves' })];
    const data = remapLegacyData([], lib, catalog, mkCustomId);
    expect(data.library[0].id).toBe('c:test1');
    expect(data.library[0].custom).toBe(true);
  });

  it('rewires trip item references to the new ids and drops unresolved ones', () => {
    n = 0;
    const lib = [
      oldRow({ id: 'pas81', nameKey: 'passport', name: 'Passport', category: 'Documents', custom: false }),
      oldRow({ id: 'glo10', nameKey: 'gloves', name: 'Gloves' }),
    ];
    const trips: Trip[] = [
      {
        id: 't1',
        name: 'Trip',
        destinations: [],
        tags: [],
        items: [
          { libraryId: 'pas81', quantitySuggested: 1, quantityTaken: 1, packed: false },
          { libraryId: 'glo10', quantitySuggested: null, quantityTaken: 2, packed: true },
          { libraryId: 'ghost', quantitySuggested: null, quantityTaken: 1, packed: false },
        ],
        settings: { laundryAvailable: false },
        createdAt: 1,
        updatedAt: 2,
      },
    ];
    const data = remapLegacyData(trips, lib, catalog, mkCustomId);
    expect(data.trips[0].items.map((i) => i.libraryId)).toEqual(['d:passport', 'c:test1']);
    expect(data.trips[0].items[1].quantityTaken).toBe(2);
  });
});
