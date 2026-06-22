import { describe, it, expect } from 'vitest';
import { catalogToLibraryItems } from './seed';
import type { CatalogItem } from '../types';

const sample: CatalogItem[] = [
  {
    id: 'passport',
    name: 'Passport',
    category: 'Documents',
    always: true,
    tagKeys: [],
    quantity: { kind: 'perTrip', count: 1 },
  },
  {
    id: 'boardshorts',
    name: 'Boardshorts',
    category: 'Clothing',
    tagKeys: [
      { key: 'surfing', weight: 3 },
      { key: 'beach', weight: 1 },
    ],
    quantity: { kind: 'bucket', weekend: 1, week: 2, long: 3 },
  },
];

describe('catalogToLibraryItems', () => {
  it('flattens weighted tag keys to plain keys', () => {
    const [, boardshorts] = catalogToLibraryItems(sample);
    expect(boardshorts.tagKeys).toEqual(['surfing', 'beach']);
  });

  it('marks seeded items as not custom', () => {
    expect(catalogToLibraryItems(sample).every((i) => i.custom === false)).toBe(true);
  });

  it('carries essential from the catalog "always" flag', () => {
    const [passport, boardshorts] = catalogToLibraryItems(sample);
    expect(passport.essential).toBe(true);
    expect(boardshorts.essential).toBe(false);
  });

  it('carries the quantity rule and a normalized nameKey', () => {
    const [passport] = catalogToLibraryItems(sample);
    expect(passport.quantity).toEqual({ kind: 'perTrip', count: 1 });
    expect(passport.nameKey).toBe('passport');
    expect(passport.name).toBe('Passport');
    expect(passport.category).toBe('Documents');
  });

  it('starts seeded items at zero usage', () => {
    expect(catalogToLibraryItems(sample).every((i) => i.count === 0 && i.lastUsed === 0)).toBe(true);
  });

  it('assigns a deterministic d:<catalogId> id', () => {
    const [passport, boardshorts] = catalogToLibraryItems(sample);
    expect(passport.id).toBe('d:passport');
    expect(boardshorts.id).toBe('d:boardshorts');
  });
});
