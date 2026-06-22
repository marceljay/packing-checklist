import { describe, it, expect, beforeEach } from 'vitest';
import { serializeTrip, parseImport } from './transfer';
import type { LibraryItem, Trip } from '../types';

function sampleTrip(): Trip {
  return {
    id: 'orig-trip',
    name: 'Portugal surf',
    startDate: '2026-09-01',
    endDate: '2026-09-08',
    destinations: [{ id: 'd1', label: 'Lisbon, Portugal', isPrimary: true }],
    tags: [{ id: 'tag-surf', label: 'surfing', type: 'activity' }],
    items: [{ libraryId: 'boa42', quantitySuggested: 2, quantityTaken: 2, packed: false }],
    settings: { laundryAvailable: true },
    createdAt: 1,
    updatedAt: 2,
  };
}

function sampleLibrary(): LibraryItem[] {
  return [
    {
      id: 'boa42',
      nameKey: 'boardshorts',
      name: 'Boardshorts',
      category: 'Clothing',
      tagKeys: ['surfing'],
      custom: true,
      count: 1,
      lastUsed: 0,
    },
    // an extra, unreferenced row that must NOT be bundled
    {
      id: 'soc11',
      nameKey: 'socks',
      name: 'Socks',
      category: 'Clothing',
      tagKeys: [],
      custom: true,
      count: 0,
      lastUsed: 0,
    },
  ];
}

let counter = 0;
const genId = () => `new-${++counter}`;
const NOW = 1_000;

beforeEach(() => {
  counter = 0;
});

describe('serializeTrip / parseImport (v2 bundle)', () => {
  it('round-trips the trip content and the referenced library item', () => {
    const { trip, libraryItems } = parseImport(
      serializeTrip(sampleTrip(), sampleLibrary()),
      genId,
      NOW,
    );
    expect(trip.name).toBe('Portugal surf');
    expect(trip.startDate).toBe('2026-09-01');
    expect(trip.settings.laundryAvailable).toBe(true);
    expect(trip.tags.map((t) => t.label)).toEqual(['surfing']);
    expect(libraryItems.map((l) => l.name)).toEqual(['Boardshorts']);
    expect(libraryItems[0].tagKeys).toEqual(['surfing']);
  });

  it('only bundles library rows the trip references', () => {
    const text = serializeTrip(sampleTrip(), sampleLibrary());
    const envelope = JSON.parse(text) as { library: LibraryItem[] };
    expect(envelope.library.map((l) => l.name)).toEqual(['Boardshorts']);
  });

  it('keys item references by nameKey for the importer to resolve', () => {
    const { trip } = parseImport(serializeTrip(sampleTrip(), sampleLibrary()), genId, NOW);
    expect(trip.items).toHaveLength(1);
    expect(trip.items[0].libraryId).toBe('boardshorts'); // nameKey, not the local id
    expect(trip.items[0].quantityTaken).toBe(2);
  });

  it('assigns fresh trip / tag / destination ids and timestamps', () => {
    const { trip } = parseImport(serializeTrip(sampleTrip(), sampleLibrary()), genId, NOW);
    expect(trip.id).not.toBe('orig-trip');
    expect(trip.tags[0].id).not.toBe('tag-surf');
    expect(trip.destinations[0].id).not.toBe('d1');
    expect(trip.createdAt).toBe(NOW);
    expect(trip.updatedAt).toBe(NOW);
  });

  it('drops item references whose library row was not bundled', () => {
    const trip = sampleTrip();
    trip.items.push({ libraryId: 'ghost', quantitySuggested: null, quantityTaken: 1, packed: false });
    const { trip: parsed } = parseImport(serializeTrip(trip, sampleLibrary()), genId, NOW);
    expect(parsed.items.map((i) => i.libraryId)).toEqual(['boardshorts']);
  });

  it('imports a legacy v1 export (items carried name/category/tagIds)', () => {
    const legacy = {
      kind: 'packing-checklist/trip',
      version: 1,
      trip: {
        name: 'Old trip',
        tags: [{ id: 'tg', label: 'beach', type: 'activity' }],
        items: [
          {
            id: 'i1',
            name: 'Towel',
            category: 'Comfort & Misc',
            tagIds: ['tg'],
            quantityTaken: 1,
            packed: false,
          },
        ],
        settings: { laundryAvailable: false },
      },
    };
    const { trip, libraryItems } = parseImport(JSON.stringify(legacy), genId, NOW);
    expect(trip.name).toBe('Old trip');
    expect(libraryItems).toEqual([
      { nameKey: 'towel', name: 'Towel', category: 'Comfort & Misc', tagKeys: ['beach'], custom: true },
    ]);
    expect(trip.items[0].libraryId).toBe('towel');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseImport('{not json', genId, NOW)).toThrow();
  });

  it('throws on a file that is not a trip export', () => {
    expect(() => parseImport(JSON.stringify({ hello: 'world' }), genId, NOW)).toThrow();
  });
});
