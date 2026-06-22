import { describe, it, expect } from 'vitest';
import {
  tagKey,
  tripDurationDays,
  destinationCode,
  computeQuantity,
  itemsByCategory,
  ensureTripTags,
  renameLibraryTag,
  removeLibraryTag,
  libraryByTag,
  searchLibrary,
  type Item,
  type Tag,
  type Category,
  type LibraryItem,
  type QuantityRule,
} from './types';

function item(name: string, category: Category, over: Partial<Item> = {}): Item {
  return {
    id: name,
    name,
    category,
    tagIds: [],
    quantitySuggested: null,
    quantityTaken: 1,
    packed: false,
    source: 'custom',
    ...over,
  };
}

describe('tagKey', () => {
  it('lowercases and trims a label', () => {
    expect(tagKey('  Beach  ')).toBe('beach');
  });

  it('normalizes case so labels match regardless of capitalization', () => {
    expect(tagKey('HiKiNg')).toBe('hiking');
  });
});

describe('tripDurationDays', () => {
  it('counts days inclusively between start and end', () => {
    expect(tripDurationDays({ startDate: '2026-06-01', endDate: '2026-06-07' })).toBe(7);
  });

  it('returns 1 for a same-day trip', () => {
    expect(tripDurationDays({ startDate: '2026-06-01', endDate: '2026-06-01' })).toBe(1);
  });

  it('returns null when either date is missing', () => {
    expect(tripDurationDays({ startDate: '2026-06-01' })).toBeNull();
    expect(tripDurationDays({})).toBeNull();
  });

  it('returns null when the end precedes the start', () => {
    expect(tripDurationDays({ startDate: '2026-06-07', endDate: '2026-06-01' })).toBeNull();
  });
});

describe('destinationCode', () => {
  it('uses the first three letters of the primary destination', () => {
    expect(
      destinationCode({ name: 'x', destinations: [{ id: '1', label: 'Portugal', isPrimary: true }] }),
    ).toBe('POR');
  });

  it('prefers an explicit country code over the label', () => {
    expect(
      destinationCode({
        name: 'x',
        destinations: [{ id: '1', label: 'Lisbon', countryCode: 'pt', isPrimary: true }],
      }),
    ).toBe('PT');
  });

  it('strips spaces and punctuation before taking three letters', () => {
    expect(
      destinationCode({ name: 'x', destinations: [{ id: '1', label: 'New York', isPrimary: true }] }),
    ).toBe('NEW');
  });

  it('reads the primary destination, not merely the first', () => {
    expect(
      destinationCode({
        name: 'x',
        destinations: [
          { id: '1', label: 'Faro', isPrimary: false },
          { id: '2', label: 'Berlin', isPrimary: true },
        ],
      }),
    ).toBe('BER');
  });

  it('falls back to the trip name when there is no destination', () => {
    expect(destinationCode({ name: 'Road trip', destinations: [] })).toBe('ROA');
  });

  it('falls back to TRP when nothing usable is present', () => {
    expect(destinationCode({ name: '', destinations: [] })).toBe('TRP');
    expect(destinationCode({ name: '123', destinations: [] })).toBe('TRP');
  });
});

describe('computeQuantity', () => {
  describe('per-day rules', () => {
    const perDay: QuantityRule = { kind: 'perDay', factor: 1, max: 10 };

    it('scales with trip length', () => {
      expect(computeQuantity(perDay, 5, false)).toBe(5);
    });

    it('caps at max for long trips', () => {
      expect(computeQuantity(perDay, 30, false)).toBe(10);
    });

    it('rounds partial days up', () => {
      expect(computeQuantity({ kind: 'perDay', factor: 0.5, max: 10 }, 3, false)).toBe(2);
    });

    it('applies a lower laundry cap only when laundry is available', () => {
      const rule: QuantityRule = { kind: 'perDay', factor: 1, max: 10, laundryCap: 7 };
      expect(computeQuantity(rule, 14, false)).toBe(10);
      expect(computeQuantity(rule, 14, true)).toBe(7);
    });

    it('never returns less than 1', () => {
      expect(computeQuantity(perDay, 0, false)).toBe(1);
    });

    it('defaults to a 7-day trip when length is unknown', () => {
      expect(computeQuantity(perDay, null, false)).toBe(7);
    });
  });

  it('returns a fixed count for per-trip rules', () => {
    expect(computeQuantity({ kind: 'perTrip', count: 1 }, 20, false)).toBe(1);
  });

  describe('bucket rules', () => {
    const bucket: QuantityRule = { kind: 'bucket', weekend: 1, week: 2, long: 3 };

    it('picks the weekend bucket for 3 days or fewer', () => {
      expect(computeQuantity(bucket, 3, false)).toBe(1);
    });

    it('picks the week bucket for 4 to 9 days', () => {
      expect(computeQuantity(bucket, 9, false)).toBe(2);
    });

    it('picks the long bucket beyond 9 days', () => {
      expect(computeQuantity(bucket, 10, false)).toBe(3);
    });

    it('defaults unknown length to the week bucket', () => {
      expect(computeQuantity(bucket, null, false)).toBe(2);
    });
  });

  it('returns 1 for none rules', () => {
    expect(computeQuantity({ kind: 'none' }, 10, false)).toBe(1);
  });
});

describe('itemsByCategory', () => {
  it('groups items under their category in canonical order', () => {
    const groups = itemsByCategory([
      item('Sunscreen', 'Toiletries & Health'),
      item('Passport', 'Documents'),
      item('T-shirt', 'Clothing'),
    ]);
    expect(groups.map((g) => g.category)).toEqual([
      'Documents',
      'Clothing',
      'Toiletries & Health',
    ]);
  });

  it('keeps every item with its category', () => {
    const groups = itemsByCategory([
      item('Passport', 'Documents'),
      item('Visa', 'Documents'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.name)).toEqual(['Passport', 'Visa']);
  });

  it('omits empty categories', () => {
    const groups = itemsByCategory([item('Passport', 'Documents')]);
    expect(groups.map((g) => g.category)).toEqual(['Documents']);
  });

  it('returns nothing for an empty list', () => {
    expect(itemsByCategory([])).toEqual([]);
  });
});

describe('ensureTripTags', () => {
  function tag(label: string, id: string): Tag {
    return { id, label, type: 'custom' };
  }

  it('returns empty arrays when no keys are supplied', () => {
    const result = ensureTripTags([tag('beach', 't1')], [], () => 'x');
    expect(result.tags).toEqual([tag('beach', 't1')]);
    expect(result.tagIds).toEqual([]);
  });

  it('reuses an existing tag whose label matches the key', () => {
    const result = ensureTripTags([tag('beach', 't1')], ['beach'], () => 'new');
    expect(result.tags).toEqual([tag('beach', 't1')]);
    expect(result.tagIds).toEqual(['t1']);
  });

  it('creates a new custom tag for an unknown key', () => {
    const result = ensureTripTags([], ['hiking'], () => 'gen-1');
    expect(result.tags).toEqual([{ id: 'gen-1', label: 'hiking', type: 'custom' }]);
    expect(result.tagIds).toEqual(['gen-1']);
  });

  it('reuses existing and creates new tags in a single call', () => {
    const result = ensureTripTags([tag('beach', 't1')], ['beach', 'hiking'], () => 'gen-1');
    expect(result.tags).toEqual([
      tag('beach', 't1'),
      { id: 'gen-1', label: 'hiking', type: 'custom' },
    ]);
    expect(result.tagIds).toEqual(['t1', 'gen-1']);
  });

  it('de-duplicates repeated keys (no duplicate tags or ids)', () => {
    let counter = 0;
    const result = ensureTripTags([], ['hiking', 'hiking'], () => `id-${++counter}`);
    expect(result.tags).toEqual([{ id: 'id-1', label: 'hiking', type: 'custom' }]);
    expect(result.tagIds).toEqual(['id-1']);
  });

  it('matches existing tags case-insensitively via tagKey normalization', () => {
    const result = ensureTripTags([tag('Beach', 't1')], ['beach'], () => 'x');
    expect(result.tags).toEqual([tag('Beach', 't1')]);
    expect(result.tagIds).toEqual(['t1']);
  });

  it('generates unique ids per new tag using the genId callback', () => {
    let counter = 0;
    const genId = () => `id-${++counter}`;
    const result = ensureTripTags([], ['hiking', 'surfing'], genId);
    expect(result.tags.map((t) => t.id)).toEqual(['id-1', 'id-2']);
    expect(result.tagIds).toEqual(['id-1', 'id-2']);
  });
});

describe('renameLibraryTag', () => {
  function lib(name: string, tagKeys: string[]): LibraryItem {
    return {
      nameKey: tagKey(name),
      name,
      category: 'Comfort & Misc',
      count: 1,
      lastUsed: 0,
      tagKeys,
      custom: true,
    };
  }

  it('replaces the old key with the new key on items that have it', () => {
    const items = [lib('Towel', ['beach', 'hiking']), lib('Sunscreen', ['beach'])];
    const result = renameLibraryTag(items, 'beach', 'swim');
    expect(result[0].tagKeys).toEqual(['swim', 'hiking']);
    expect(result[1].tagKeys).toEqual(['swim']);
  });

  it('leaves items untouched that do not have the key', () => {
    const items = [lib('Passport', ['documents']), lib('Towel', ['beach'])];
    const result = renameLibraryTag(items, 'beach', 'swim');
    expect(result[0].tagKeys).toEqual(['documents']);
    expect(result[1].tagKeys).toEqual(['swim']);
  });

  it('does not mutate the input items', () => {
    const items = [lib('Towel', ['beach'])];
    renameLibraryTag(items, 'beach', 'swim');
    expect(items[0].tagKeys).toEqual(['beach']);
  });

  it('normalizes both from and to keys via tagKey', () => {
    const items = [lib('Towel', ['beach'])];
    const result = renameLibraryTag(items, '  Beach  ', '  Swim  ');
    expect(result[0].tagKeys).toEqual(['swim']);
  });

  it('de-duplicates if the new key already exists on the item', () => {
    const items = [lib('Towel', ['beach', 'swim'])];
    const result = renameLibraryTag(items, 'beach', 'swim');
    expect(result[0].tagKeys).toEqual(['swim']);
  });

  it('returns an empty array when given an empty array', () => {
    expect(renameLibraryTag([], 'beach', 'swim')).toEqual([]);
  });
});

describe('removeLibraryTag', () => {
  function lib(name: string, tagKeys: string[]): LibraryItem {
    return {
      nameKey: tagKey(name),
      name,
      category: 'Comfort & Misc',
      count: 1,
      lastUsed: 0,
      tagKeys,
      custom: true,
    };
  }

  it('removes the key from every item that has it', () => {
    const items = [lib('Towel', ['beach', 'hiking']), lib('Sunscreen', ['beach'])];
    const result = removeLibraryTag(items, 'beach');
    expect(result[0].tagKeys).toEqual(['hiking']);
    expect(result[1].tagKeys).toEqual([]);
  });

  it('leaves items untouched that do not have the key', () => {
    const items = [lib('Passport', ['documents']), lib('Towel', ['beach'])];
    const result = removeLibraryTag(items, 'beach');
    expect(result[0].tagKeys).toEqual(['documents']);
    expect(result[1].tagKeys).toEqual([]);
  });

  it('does not mutate the input items', () => {
    const items = [lib('Towel', ['beach'])];
    removeLibraryTag(items, 'beach');
    expect(items[0].tagKeys).toEqual(['beach']);
  });

  it('normalizes the key via tagKey', () => {
    const items = [lib('Towel', ['beach'])];
    const result = removeLibraryTag(items, '  Beach  ');
    expect(result[0].tagKeys).toEqual([]);
  });

  it('returns an empty array when given an empty array', () => {
    expect(removeLibraryTag([], 'beach')).toEqual([]);
  });
});

describe('libraryByTag', () => {
  function lib(name: string, tags: string[]): LibraryItem {
    return {
      nameKey: tagKey(name),
      name,
      category: 'Comfort & Misc',
      count: 1,
      lastUsed: 0,
      tagKeys: tags,
      custom: true,
    };
  }

  it('groups items under their tag keys in sorted order', () => {
    const items = [lib('Towel', ['beach', 'hiking']), lib('Sunscreen', ['beach'])];
    const groups = libraryByTag(items);
    expect(groups.map((g) => g.tag)).toEqual(['beach', 'hiking']);
  });

  it('includes an item under each of its tags', () => {
    const towel = lib('Towel', ['beach', 'hiking']);
    const groups = libraryByTag([towel]);
    expect(groups).toHaveLength(2);
    expect(groups[0].tag).toBe('beach');
    expect(groups[0].items).toContain(towel);
    expect(groups[1].tag).toBe('hiking');
    expect(groups[1].items).toContain(towel);
  });

  it('appends an untagged group when any item has no tags', () => {
    const items = [lib('Towel', ['beach']), lib('Passport', [])];
    const groups = libraryByTag(items);
    const last = groups[groups.length - 1];
    expect(last.tag).toBe('');
    expect(last.items.map((i) => i.name)).toEqual(['Passport']);
  });

  it('does not emit an untagged group when all items have at least one tag', () => {
    const items = [lib('Towel', ['beach']), lib('Sunscreen', ['beach'])];
    const groups = libraryByTag(items);
    expect(groups.every((g) => g.tag !== '')).toBe(true);
  });

  it('returns an empty array for an empty input', () => {
    expect(libraryByTag([])).toEqual([]);
  });

  it('places the untagged section after all named-tag sections', () => {
    const items = [
      lib('Passport', []),
      lib('Towel', ['beach']),
      lib('Sunscreen', ['alpha']),
    ];
    const groups = libraryByTag(items);
    expect(groups[groups.length - 1].tag).toBe('');
    expect(groups.map((g) => g.tag).filter((t) => t !== '')).toEqual(['alpha', 'beach']);
  });
});

describe('searchLibrary', () => {
  function lib(name: string, over: Partial<LibraryItem> = {}): LibraryItem {
    return {
      nameKey: tagKey(name),
      name,
      category: 'Comfort & Misc',
      count: 1,
      lastUsed: 0,
      tagKeys: [],
      custom: true,
      ...over,
    };
  }

  it('returns all items unchanged for a blank query', () => {
    const items = [lib('Towel'), lib('Passport')];
    expect(searchLibrary(items, '')).toEqual(items);
    expect(searchLibrary(items, '   ')).toEqual(items);
  });

  it('matches by name, case-insensitively', () => {
    const items = [lib('Sunscreen'), lib('Passport')];
    expect(searchLibrary(items, 'SUN').map((i) => i.name)).toEqual(['Sunscreen']);
  });

  it('matches a substring anywhere in the name', () => {
    const items = [lib('Toothbrush'), lib('Passport')];
    expect(searchLibrary(items, 'brush').map((i) => i.name)).toEqual(['Toothbrush']);
  });

  it('matches by tag key', () => {
    const items = [lib('Towel', { tagKeys: ['beach'] }), lib('Passport')];
    expect(searchLibrary(items, 'beach').map((i) => i.name)).toEqual(['Towel']);
  });

  it('matches by category', () => {
    const items = [lib('Charger', { category: 'Electronics' }), lib('Towel')];
    expect(searchLibrary(items, 'electron').map((i) => i.name)).toEqual(['Charger']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchLibrary([lib('Towel')], 'xyz')).toEqual([]);
  });

  it('preserves the input order of matches', () => {
    const items = [lib('Sun hat'), lib('Sunscreen'), lib('Passport')];
    expect(searchLibrary(items, 'sun').map((i) => i.name)).toEqual(['Sun hat', 'Sunscreen']);
  });
});
