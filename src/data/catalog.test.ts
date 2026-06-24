import { describe, it, expect } from 'vitest';
import { CATALOG } from './catalog';
import { catalogToLibraryItems } from './seed';
import { suggestItems } from '../engine/suggest';
import type { Tag, Trip } from '../types';

function tripWith(tags: Tag[]): Trip {
  return {
    id: 't1',
    name: 'Test',
    destinations: [],
    tags,
    items: [],
    settings: { laundryAvailable: false },
    createdAt: 0,
    updatedAt: 0,
  };
}

const weatherTag = (label: string): Tag => ({ id: `tag-${label}`, label, type: 'weather' });

describe('CATALOG — tropical protection', () => {
  const library = catalogToLibraryItems(CATALOG);

  it('has a tropical group surfacing insect/mosquito protection', () => {
    const ids = suggestItems(tripWith([weatherTag('tropical')]), library).map((s) => s.item.id);
    expect(ids).toContain('d:insect-repellent');
    expect(ids).toContain('d:mosquito-net');
    expect(ids).toContain('d:rehydration-salts');
  });

  it('does not surface tropical-only gear without the tag', () => {
    const ids = suggestItems(tripWith([]), library).map((s) => s.item.id);
    expect(ids).not.toContain('d:mosquito-net');
  });
});
