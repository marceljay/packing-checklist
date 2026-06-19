import { describe, it, expect } from 'vitest';
import { suggestItems } from './suggest';
import type { CatalogItem, Item, Tag, Trip } from '../types';

function makeTrip(over: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Test trip',
    destinations: [],
    tags: [],
    items: [],
    settings: { laundryAvailable: false },
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

function tag(label: string, type: Tag['type'] = 'activity'): Tag {
  return { id: `tag-${label}`, label, type };
}

// Small deterministic catalog so assertions don't depend on the real one.
const catalog: CatalogItem[] = [
  {
    id: 'passport',
    name: 'Passport',
    category: 'Documents',
    always: true,
    tagKeys: [],
    quantity: { kind: 'perTrip', count: 1 },
  },
  {
    id: 'toothbrush',
    name: 'Toothbrush',
    category: 'Toiletries & Health',
    always: true,
    tagKeys: [],
    quantity: { kind: 'none' },
  },
  {
    id: 'boardshorts',
    name: 'Boardshorts',
    category: 'Clothing',
    tagKeys: [{ key: 'surfing', weight: 3 }],
    quantity: { kind: 'bucket', weekend: 1, week: 2, long: 3 },
  },
  {
    id: 'merino',
    name: 'Merino base layer',
    category: 'Clothing',
    tagKeys: [
      { key: 'hiking', weight: 2 },
      { key: 'cold', weight: 2 },
    ],
    quantity: { kind: 'perTrip', count: 1 },
  },
];

describe('suggestItems', () => {
  it('suggests essentials even when no tags are set', () => {
    const passport = suggestItems(makeTrip(), catalog).find((s) => s.catalog.id === 'passport');
    expect(passport).toBeDefined();
    expect(passport?.essential).toBe(true);
    expect(passport?.reasonTags).toEqual([]);
  });

  it('omits tag-only items when no matching tag is active', () => {
    const ids = suggestItems(makeTrip(), catalog).map((s) => s.catalog.id);
    expect(ids).not.toContain('boardshorts');
    expect(ids).not.toContain('merino');
  });

  it('suggests a tag item when its tag is active, citing that tag as the reason', () => {
    const res = suggestItems(makeTrip({ tags: [tag('surfing')] }), catalog);
    const bs = res.find((s) => s.catalog.id === 'boardshorts');
    expect(bs).toBeDefined();
    expect(bs?.reasonTags.map((t) => t.label)).toEqual(['surfing']);
    expect(bs?.essential).toBe(false);
  });

  it('matches on a single one of an item’s tags (union, not intersection)', () => {
    const merino = suggestItems(makeTrip({ tags: [tag('hiking')] }), catalog).find(
      (s) => s.catalog.id === 'merino',
    );
    expect(merino?.reasonTags.map((t) => t.label)).toEqual(['hiking']);
    expect(merino?.score).toBe(2);
  });

  it('collects every matching tag as a reason and sums their weights', () => {
    const merino = suggestItems(
      makeTrip({ tags: [tag('hiking'), tag('cold', 'weather')] }),
      catalog,
    ).find((s) => s.catalog.id === 'merino');
    expect(merino?.reasonTags.map((t) => t.label).sort()).toEqual(['cold', 'hiking']);
    expect(merino?.score).toBe(4);
  });

  it('ranks higher-weighted matches first and essentials last', () => {
    const order = suggestItems(
      makeTrip({ tags: [tag('surfing'), tag('hiking')] }),
      catalog,
    ).map((s) => s.catalog.id);
    expect(order.indexOf('boardshorts')).toBeLessThan(order.indexOf('merino'));
    expect(order.indexOf('merino')).toBeLessThan(order.indexOf('passport'));
  });

  it('breaks score ties alphabetically by name', () => {
    const names = suggestItems(makeTrip(), catalog).map((s) => s.catalog.name);
    expect(names).toEqual(['Passport', 'Toothbrush']);
  });

  it('hides items already on the trip’s list', () => {
    const existing: Item = {
      id: 'i1',
      name: 'Passport',
      category: 'Documents',
      tagIds: [],
      quantitySuggested: 1,
      quantityTaken: 1,
      packed: false,
      source: 'suggested',
      catalogId: 'passport',
    };
    const ids = suggestItems(makeTrip({ items: [existing] }), catalog).map((s) => s.catalog.id);
    expect(ids).not.toContain('passport');
  });

  it('computes the suggested quantity from trip length', () => {
    const bs = suggestItems(
      makeTrip({ tags: [tag('surfing')], startDate: '2026-06-01', endDate: '2026-06-07' }),
      catalog,
    ).find((s) => s.catalog.id === 'boardshorts');
    expect(bs?.quantity).toBe(2); // 7-day trip → week bucket
  });
});
