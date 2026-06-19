import { describe, it, expect, beforeEach } from 'vitest';
import { serializeTrip, parseTrip } from './transfer';
import type { Trip } from '../types';

function sampleTrip(): Trip {
  return {
    id: 'orig-trip',
    name: 'Portugal surf',
    startDate: '2026-09-01',
    endDate: '2026-09-08',
    destinations: [{ id: 'd1', label: 'Lisbon, Portugal', isPrimary: true }],
    tags: [{ id: 'tag-surf', label: 'surfing', type: 'activity' }],
    items: [
      {
        id: 'i1',
        name: 'Boardshorts',
        category: 'Clothing',
        tagIds: ['tag-surf'],
        quantitySuggested: 2,
        quantityTaken: 2,
        packed: false,
        source: 'suggested',
        catalogId: 'boardshorts',
      },
    ],
    settings: { laundryAvailable: true },
    createdAt: 1,
    updatedAt: 2,
  };
}

let counter = 0;
const genId = () => `new-${++counter}`;
const NOW = 1_000;

beforeEach(() => {
  counter = 0;
});

describe('serializeTrip / parseTrip', () => {
  it('round-trips the trip content', () => {
    const parsed = parseTrip(serializeTrip(sampleTrip()), genId, NOW);
    expect(parsed.name).toBe('Portugal surf');
    expect(parsed.startDate).toBe('2026-09-01');
    expect(parsed.items.map((i) => i.name)).toEqual(['Boardshorts']);
    expect(parsed.tags.map((t) => t.label)).toEqual(['surfing']);
    expect(parsed.settings.laundryAvailable).toBe(true);
  });

  it('assigns fresh ids and rewires item→tag references', () => {
    const parsed = parseTrip(serializeTrip(sampleTrip()), genId, NOW);
    expect(parsed.id).not.toBe('orig-trip');
    expect(parsed.tags[0].id).not.toBe('tag-surf');
    // the item should still point at the (remapped) surfing tag
    expect(parsed.items[0].tagIds).toEqual([parsed.tags[0].id]);
  });

  it('drops references to tags that no longer exist', () => {
    const trip = sampleTrip();
    trip.items[0].tagIds = ['tag-surf', 'ghost-tag'];
    const parsed = parseTrip(serializeTrip(trip), genId, NOW);
    expect(parsed.items[0].tagIds).toEqual([parsed.tags[0].id]);
  });

  it('stamps fresh timestamps', () => {
    const parsed = parseTrip(serializeTrip(sampleTrip()), genId, NOW);
    expect(parsed.createdAt).toBe(NOW);
    expect(parsed.updatedAt).toBe(NOW);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseTrip('{not json', genId, NOW)).toThrow();
  });

  it('throws on a file that is not a trip export', () => {
    expect(() => parseTrip(JSON.stringify({ hello: 'world' }), genId, NOW)).toThrow();
  });

  it('accepts a bare trip object without the envelope', () => {
    const bare = JSON.stringify(sampleTrip());
    const parsed = parseTrip(bare, genId, NOW);
    expect(parsed.name).toBe('Portugal surf');
  });
});
