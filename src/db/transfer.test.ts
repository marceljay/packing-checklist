import { describe, it, expect, beforeEach } from 'vitest';
import { serializeTrip, parseImport, serializeAllTrips, parseAllTrips } from './transfer';
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

  it('preserves the source id on item references (identity carries across devices)', () => {
    const { trip, libraryItems } = parseImport(
      serializeTrip(sampleTrip(), sampleLibrary()),
      genId,
      NOW,
    );
    expect(trip.items).toHaveLength(1);
    expect(trip.items[0].libraryId).toBe('boa42'); // the source id, not the name
    expect(trip.items[0].quantityTaken).toBe(2);
    expect(libraryItems[0].id).toBe('boa42');
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
    expect(parsed.items.map((i) => i.libraryId)).toEqual(['boa42']);
  });

  it('bundles only the registry entries the trip references, and round-trips them', () => {
    const meta = [
      { key: 'surfing', group: 'activity' as const, default: true }, // used by item + tag
      { key: 'beach', group: 'weather' as const, default: true }, //   unreferenced → excluded
    ];
    const { tagMeta } = parseImport(serializeTrip(sampleTrip(), sampleLibrary(), meta), genId, NOW);
    expect(tagMeta).toEqual([{ key: 'surfing', group: 'activity', default: true }]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseImport('{not json', genId, NOW)).toThrow();
  });

  it('throws on a file that is not a trip export', () => {
    expect(() => parseImport(JSON.stringify({ hello: 'world' }), genId, NOW)).toThrow();
  });
});

describe('serializeAllTrips / parseAllTrips (full backup)', () => {
  function secondTrip(): Trip {
    return {
      ...sampleTrip(),
      id: 'orig-trip-2',
      name: 'City break',
      items: [{ libraryId: 'soc11', quantitySuggested: 3, quantityTaken: 3, packed: false }],
    };
  }

  it('bundles the union of referenced library rows, deduped, none unreferenced', () => {
    const text = serializeAllTrips([sampleTrip(), secondTrip()], sampleLibrary());
    const env = JSON.parse(text) as { trips: Trip[]; library: LibraryItem[] };
    expect(env.trips.map((t) => t.name)).toEqual(['Portugal surf', 'City break']);
    expect(env.library.map((l) => l.id).sort()).toEqual(['boa42', 'soc11']);
  });

  it('round-trips every trip with fresh ids and preserved references', () => {
    const results = parseAllTrips(
      serializeAllTrips([sampleTrip(), secondTrip()], sampleLibrary()),
      genId,
      NOW,
    );
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.trip.name)).toEqual(['Portugal surf', 'City break']);
    expect(results[0].trip.id).not.toBe('orig-trip');
    expect(results[0].trip.items[0].libraryId).toBe('boa42');
    expect(results[1].trip.items[0].libraryId).toBe('soc11');
  });

  it('handles an empty backup', () => {
    expect(parseAllTrips(serializeAllTrips([], sampleLibrary()), genId, NOW)).toEqual([]);
  });

  it('throws on a file that is not a trips backup', () => {
    expect(() => parseAllTrips(JSON.stringify({ hello: 'world' }), genId, NOW)).toThrow();
  });
});
