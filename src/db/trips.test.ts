import { describe, it, expect, beforeEach } from 'vitest';
import { getData, setData } from './store';
import { createTrip, getTrip, deleteTrip, cloneTrip, listTrips, pruneEmptyTrips, importTripFromText } from './trips';
import { serializeTrip } from './transfer';
import { listTagMeta, setTagGroup } from './tags';
import type { LibraryItem, Trip } from '../types';

/** The store is a module singleton; reset the document before each test. */
beforeEach(() => {
  setData((d) => {
    d.trips = [];
    d.library = [];
    d.tagMeta = [];
  });
});

describe('createTrip / deleteTrip', () => {
  it('creates a trip that is then retrievable', () => {
    const id = createTrip('Lisbon');
    expect(getTrip(id)?.name).toBe('Lisbon');
    expect(getData().trips).toHaveLength(1);
  });

  it('deletes only the matching trip', () => {
    const a = createTrip('A');
    const b = createTrip('B');
    deleteTrip(a);
    expect(getTrip(a)).toBeUndefined();
    expect(getTrip(b)?.name).toBe('B');
    expect(getData().trips).toHaveLength(1);
  });

  it('is a no-op when deleting an unknown id', () => {
    const id = createTrip('Keep');
    deleteTrip('does-not-exist');
    expect(getData().trips).toHaveLength(1);
    expect(getTrip(id)).toBeDefined();
  });
});

describe('cloneTrip', () => {
  it('copies a trip with a fresh id, "(copy)" name and reset packed state', () => {
    const src = createTrip('Trip');
    setData((d) => {
      const t = d.trips.find((x) => x.id === src)!;
      t.items = [{ libraryId: 'd:passport', quantitySuggested: null, quantityTaken: 2, packed: true }];
      t.tags = [{ id: 'tag1', label: 'beach', type: 'activity' }];
    });

    const copyId = cloneTrip(src)!;
    const copy = getTrip(copyId)!;

    expect(copyId).not.toBe(src);
    expect(copy.name).toBe('Trip (copy)');
    expect(copy.items[0].packed).toBe(false); // packed resets on a copy
    expect(copy.items[0].quantityTaken).toBe(2); // quantity preserved
    expect(copy.tags[0].id).not.toBe('tag1'); // tags get fresh ids
    expect(getData().trips).toHaveLength(2);
  });

  it('returns undefined for a missing trip', () => {
    expect(cloneTrip('nope')).toBeUndefined();
  });
});

describe('pruneEmptyTrips', () => {
  it('drops untouched stubs but keeps trips with content', () => {
    createTrip(); // default "Untitled trip" stub — empty
    const named = createTrip('Real');
    setData((d) => {
      const t = d.trips.find((x) => x.id === named)!;
      t.destinations = [{ id: 'dst', label: 'Rome', isPrimary: true }];
    });

    pruneEmptyTrips();

    const remaining = listTrips();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(named);
  });
});

describe('importTripFromText merges the bundled tag registry', () => {
  const lib: LibraryItem[] = [
    { id: 'boa42', nameKey: 'boardshorts', name: 'Boardshorts', category: 'Clothing', tagKeys: ['surfing'], custom: true, count: 0, lastUsed: 0 },
  ];
  const trip = (): Trip => ({
    id: 'src', name: 'Surf', destinations: [], items: [{ libraryId: 'boa42', quantitySuggested: null, quantityTaken: 1, packed: false }],
    tags: [{ id: 'g', label: 'surfing', type: 'activity' }],
    settings: { laundryAvailable: false }, createdAt: 1, updatedAt: 1,
  });

  it('adds new tag entries but keeps local grouping on conflict', () => {
    setTagGroup('surfing', 'other'); // local grouping to defend
    const text = serializeTrip(trip(), lib, [{ key: 'surfing', group: 'activity', default: true }]);
    importTripFromText(text);
    expect(listTagMeta().find((m) => m.key === 'surfing')?.group).toBe('other');
  });
});
