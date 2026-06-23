import { describe, it, expect } from 'vitest';
import { suggestItems } from './suggest';
import type { LibraryItem, Tag, Trip } from '../types';

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

function lib(over: Partial<LibraryItem> & Pick<LibraryItem, 'id' | 'name'>): LibraryItem {
  return {
    nameKey: over.name.toLowerCase(),
    category: 'Clothing',
    tagKeys: [],
    custom: false,
    count: 0,
    lastUsed: 0,
    ...over,
  };
}

// Small deterministic library so assertions don't depend on the seeded one.
const library: LibraryItem[] = [
  lib({ id: 'd:passport', name: 'Passport', category: 'Documents', essential: true, quantity: { kind: 'perTrip', count: 1 } }),
  lib({ id: 'd:toothbrush', name: 'Toothbrush', category: 'Toiletries & Health', essential: true, quantity: { kind: 'none' } }),
  lib({ id: 'd:boardshorts', name: 'Boardshorts', tagKeys: ['surfing'], quantity: { kind: 'bucket', weekend: 1, week: 2, long: 3 } }),
  lib({ id: 'd:merino', name: 'Merino base layer', tagKeys: ['hiking', 'cold'], quantity: { kind: 'perTrip', count: 1 } }),
];

describe('suggestItems', () => {
  it('suggests essentials even when no tags are set', () => {
    const passport = suggestItems(makeTrip(), library).find((s) => s.item.id === 'd:passport');
    expect(passport).toBeDefined();
    expect(passport?.essential).toBe(true);
    expect(passport?.reasonTags).toEqual([]);
  });

  it('omits tag-only items when no matching tag is active', () => {
    const ids = suggestItems(makeTrip(), library).map((s) => s.item.id);
    expect(ids).not.toContain('d:boardshorts');
    expect(ids).not.toContain('d:merino');
  });

  it('suggests a tag item when its tag is active, citing that tag as the reason', () => {
    const res = suggestItems(makeTrip({ tags: [tag('surfing')] }), library);
    const bs = res.find((s) => s.item.id === 'd:boardshorts');
    expect(bs).toBeDefined();
    expect(bs?.reasonTags.map((t) => t.label)).toEqual(['surfing']);
    expect(bs?.essential).toBe(false);
  });

  it('matches on a single one of an item’s tags (union, not intersection)', () => {
    const merino = suggestItems(makeTrip({ tags: [tag('hiking')] }), library).find(
      (s) => s.item.id === 'd:merino',
    );
    expect(merino?.reasonTags.map((t) => t.label)).toEqual(['hiking']);
    expect(merino?.score).toBe(1);
  });

  it('scores by the number of matched tags', () => {
    const merino = suggestItems(
      makeTrip({ tags: [tag('hiking'), tag('cold', 'weather')] }),
      library,
    ).find((s) => s.item.id === 'd:merino');
    expect(merino?.reasonTags.map((t) => t.label).sort()).toEqual(['cold', 'hiking']);
    expect(merino?.score).toBe(2);
  });

  it('ranks more matches first, then tag matches above essentials', () => {
    const order = suggestItems(
      makeTrip({ tags: [tag('surfing'), tag('hiking'), tag('cold', 'weather')] }),
      library,
    ).map((s) => s.item.id);
    // merino matches 2 tags, boardshorts 1 → merino first; both above the essentials.
    expect(order.indexOf('d:merino')).toBeLessThan(order.indexOf('d:boardshorts'));
    expect(order.indexOf('d:boardshorts')).toBeLessThan(order.indexOf('d:passport'));
  });

  it('breaks score ties by usage count, then alphabetically', () => {
    const used = [
      lib({ id: 'd:a', name: 'Anorak', tagKeys: ['rainy'], count: 0 }),
      lib({ id: 'd:b', name: 'Boots', tagKeys: ['rainy'], count: 5 }),
    ];
    const order = suggestItems(makeTrip({ tags: [tag('rainy', 'weather')] }), used).map(
      (s) => s.item.id,
    );
    expect(order).toEqual(['d:b', 'd:a']); // more-used Boots first despite the name
  });

  it('breaks ties alphabetically when usage is equal', () => {
    const names = suggestItems(makeTrip(), library).map((s) => s.item.name);
    expect(names).toEqual(['Passport', 'Toothbrush']);
  });

  it('hides items already on the trip’s list (by excluded library id)', () => {
    const ids = suggestItems(makeTrip(), library, new Set(['d:passport'])).map((s) => s.item.id);
    expect(ids).not.toContain('d:passport');
    expect(ids).toContain('d:toothbrush');
  });

  it('suggests a matching custom item too (library is the source of truth)', () => {
    const withCustom = [
      ...library,
      lib({ id: 'c:wax', name: 'Surf wax', custom: true, tagKeys: ['surfing'] }),
    ];
    const ids = suggestItems(makeTrip({ tags: [tag('surfing')] }), withCustom).map((s) => s.item.id);
    expect(ids).toContain('c:wax');
  });

  it('defaults to quantity 1 when an item carries no quantity rule', () => {
    const noRule = [lib({ id: 'c:x', name: 'Thingamajig', tagKeys: ['surfing'] })];
    const q = suggestItems(makeTrip({ tags: [tag('surfing')] }), noRule)[0].quantity;
    expect(q).toBe(1);
  });

  it('computes the suggested quantity from trip length', () => {
    const bs = suggestItems(
      makeTrip({ tags: [tag('surfing')], startDate: '2026-06-01', endDate: '2026-06-07' }),
      library,
    ).find((s) => s.item.id === 'd:boardshorts');
    expect(bs?.quantity).toBe(2); // 7-day trip → week bucket
  });
});
