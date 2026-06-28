import { describe, it, expect, beforeEach } from 'vitest';
import {
  seedLibrary,
  listLibrary,
  getLibraryItem,
  rememberItem,
  ensureLibraryItem,
  editLibraryItem,
  forgetItemById,
  restoreDefaults,
  replaceLibrary,
  applyLibraryImport,
} from './library';
import { planLibraryImport, type ParsedLibraryItem } from './libraryTransfer';
import { listTagMeta, setTagGroup } from './tags';
import { getData, setData } from './store';
import { CATALOG } from '../data/catalog';
import { defaultId } from '../types';

const defaults = () => listLibrary().filter((i) => !i.custom);
const aDefault = () => defaults()[0];

beforeEach(() => {
  setData((d) => {
    d.library = [];
    d.trips = [];
    d.removedDefaultIds = [];
    d.tagMeta = [];
    d.removedTagKeys = [];
    d.customCategories = [];
    d.removedCategories = [];
  });
});

describe('seedLibrary', () => {
  it('seeds the built-in defaults on first run', () => {
    seedLibrary();
    expect(defaults().length).toBeGreaterThan(0);
  });

  it('is idempotent — re-seeding adds no duplicates', () => {
    seedLibrary();
    const n = listLibrary().length;
    seedLibrary();
    expect(listLibrary().length).toBe(n);
  });

  it('re-syncs a pristine default to the catalog (e.g. updated quantity) but keeps usage stats', () => {
    seedLibrary();
    const def = aDefault();
    // Simulate a stale persisted rule + accrued usage from an older app version.
    setData((d) => {
      const row = d.library.find((i) => i.id === def.id)!;
      row.quantity = { kind: 'perDay', factor: 1, max: 1 };
      row.count = 5;
      row.lastUsed = 123;
    });
    seedLibrary();
    const refreshed = getLibraryItem(def.id)!;
    const catalogRule = CATALOG.find((c) => defaultId(c.id) === def.id)!.quantity;
    expect(refreshed.quantity).toEqual(catalogRule); // re-synced from catalog
    expect(refreshed.count).toBe(5); // usage preserved
    expect(refreshed.lastUsed).toBe(123);
  });

  it('does not touch an edited (forked → custom) item', () => {
    seedLibrary();
    const def = aDefault();
    const res = editLibraryItem(def.id, { quantity: { kind: 'perTrip', count: 99 } });
    seedLibrary();
    expect(getLibraryItem(res.id)?.quantity).toEqual({ kind: 'perTrip', count: 99 });
  });
});

describe('trip-page mutations reflect in the library', () => {
  it('rememberItem stores a new custom item with its tags', () => {
    const row = rememberItem('Sunscreen', 'Toiletries & Health', ['beach']);
    const found = getLibraryItem(row.id);
    expect(found?.name).toBe('Sunscreen');
    expect(found?.tagKeys).toEqual(['beach']);
    expect(found?.custom).toBe(true);
  });

  it('ensureLibraryItem merges new tags into an existing item', () => {
    const a = ensureLibraryItem('Hat', 'Clothing', ['sun']);
    const b = ensureLibraryItem('Hat', 'Clothing', ['beach']);
    expect(b.id).toBe(a.id); // same row, resolved by name
    expect(getLibraryItem(a.id)?.tagKeys.sort()).toEqual(['beach', 'sun']);
  });

  it('stores and clears a default quantity rule', () => {
    const row = rememberItem('Contact lenses', 'Toiletries & Health', []);
    editLibraryItem(row.id, { quantity: { kind: 'perTrip', count: 14 } });
    expect(getLibraryItem(row.id)?.quantity).toEqual({ kind: 'perTrip', count: 14 });
    editLibraryItem(row.id, { quantity: null });
    expect(getLibraryItem(row.id)?.quantity).toBeUndefined();
  });

  it('toggles the essential flag on and off', () => {
    const row = rememberItem('Phone charger', 'Electronics', []);
    editLibraryItem(row.id, { essential: true });
    expect(getLibraryItem(row.id)?.essential).toBe(true);
    editLibraryItem(row.id, { essential: false });
    expect(getLibraryItem(row.id)?.essential).toBeUndefined();
  });

  it('editing a default item forks it and reflects the new tags', () => {
    seedLibrary();
    const def = aDefault();
    const res = editLibraryItem(def.id, { tagKeys: ['xyztag'] });
    expect(res.ok).toBe(true);
    expect(res.id).not.toBe(def.id); // forked into a new custom id
    expect(getLibraryItem(res.id)?.tagKeys).toContain('xyztag');
    expect(getLibraryItem(def.id)).toBeUndefined(); // old default slot freed
  });
});

describe('removed/edited defaults survive a reload (do not get re-seeded)', () => {
  it('a deleted default is not resurrected by the boot seeder', () => {
    seedLibrary();
    const def = aDefault();
    forgetItemById(def.id);
    expect(getData().removedDefaultIds).toContain(def.id);

    seedLibrary(); // simulate next boot
    expect(getLibraryItem(def.id)).toBeUndefined();
  });

  it('an edited (forked) default does not reappear as a duplicate on reload', () => {
    seedLibrary();
    const def = aDefault();
    const before = listLibrary().length;
    editLibraryItem(def.id, { tagKeys: ['mine'] }); // forks → freed slot tombstoned

    seedLibrary(); // simulate next boot
    // No pristine default came back; count is unchanged (fork replaced in place).
    expect(getLibraryItem(def.id)).toBeUndefined();
    expect(listLibrary().filter((i) => i.nameKey === def.nameKey)).toHaveLength(1);
    expect(listLibrary().length).toBe(before);
  });
});

describe('restoreDefaults', () => {
  it('re-adds removed defaults and clears the tombstones', () => {
    seedLibrary();
    const def = aDefault();
    forgetItemById(def.id);
    expect(getLibraryItem(def.id)).toBeUndefined();

    restoreDefaults();
    expect(getLibraryItem(def.id)).toBeDefined();
    expect(getData().removedDefaultIds).toEqual([]);
  });

  it('leaves custom items untouched', () => {
    const mine = rememberItem('My thing', 'Comfort & Misc', []);
    restoreDefaults();
    expect(getLibraryItem(mine.id)?.name).toBe('My thing');
  });

  it('clears tag/category tombstones and resets built-in tag metadata', () => {
    setData((d) => {
      d.removedTagKeys = ['hot'];
      d.removedCategories = ['Footwear'];
      d.tagMeta = [{ key: 'hot', group: 'other', default: false }]; // user re-grouped a built-in
    });
    restoreDefaults();
    expect(getData().removedTagKeys).toEqual([]);
    expect(getData().removedCategories).toEqual([]);
    // built-in 'hot' reset to its seed values (weather / default)
    expect(getData().tagMeta.find((t) => t.key === 'hot')).toEqual({ key: 'hot', group: 'weather', default: true });
  });
});

describe('library import modes', () => {
  const parsed = (over: Partial<ParsedLibraryItem> & Pick<ParsedLibraryItem, 'name'>): ParsedLibraryItem => ({
    nameKey: over.name.toLowerCase(),
    category: 'Clothing',
    tagKeys: [],
    custom: true,
    count: 0,
    lastUsed: 0,
    ...over,
  });

  describe('replaceLibrary', () => {
    it('wipes the library and loads the incoming items, preserving ids', () => {
      rememberItem('Old thing', 'Comfort & Misc', []);
      replaceLibrary([parsed({ id: 'c:a', name: 'Anchor' }), parsed({ id: 'c:b', name: 'Buoy' })]);
      expect(listLibrary().map((i) => i.id).sort()).toEqual(['c:a', 'c:b']);
    });

    it('mints ids for id-less or clashing incoming rows', () => {
      replaceLibrary([parsed({ name: 'No id' }), parsed({ id: 'c:dup', name: 'One' }), parsed({ id: 'c:dup', name: 'Two' })]);
      const ids = listLibrary().map((i) => i.id);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3); // all unique
    });

    it('reports the count and any new non-built-in categories', () => {
      const r = replaceLibrary([
        parsed({ id: 'c:a', name: 'Tent', category: 'Camping' }),
        parsed({ id: 'c:b', name: 'Shirt', category: 'Clothing' }),
      ]);
      expect(r).toEqual({ count: 2, newCategories: ['Camping'] });
    });

    it('replaces the tag registry, backfilling tags the file omitted', () => {
      setTagGroup('old', 'activity'); // pre-existing local entry, should be wiped
      replaceLibrary(
        [parsed({ id: 'c:a', name: 'Tent', tagKeys: ['camp', 'rain'] })],
        [{ key: 'camp', group: 'weather', default: true }],
      );
      const meta = listTagMeta();
      expect(meta.find((m) => m.key === 'old')).toBeUndefined();
      expect(meta.find((m) => m.key === 'camp')).toEqual({ key: 'camp', group: 'weather', default: true });
      // 'rain' is used by an item but absent from the file → backfilled as other/non-default
      expect(meta.find((m) => m.key === 'rain')).toEqual({ key: 'rain', group: 'other', default: false });
    });

    it('replaces custom categories with the file\'s (built-ins excluded)', () => {
      setData((d) => void (d.customCategories = ['Old']));
      replaceLibrary([parsed({ id: 'c:a', name: 'Tent' })], [], ['Camping', 'Clothing']);
      // 'Clothing' is built-in → not stored as a custom; 'Old' wiped
      expect(getData().customCategories).toEqual(['Camping']);
    });
  });

  describe('applyLibraryImport', () => {
    function setup() {
      setData((d) => {
        d.library = [
          { id: 'c:mine', nameKey: 'gloves', name: 'Gloves', category: 'Clothing', tagKeys: ['snow'], custom: true, count: 2, lastUsed: 1 },
        ];
      });
    }

    it('adds fresh items and skips id matches', () => {
      setup();
      const incoming = [parsed({ id: 'c:mine', name: 'Gloves' }), parsed({ id: 'c:new', name: 'Crampons' })];
      const plan = planLibraryImport(incoming, listLibrary());
      const r = applyLibraryImport(plan, []);
      expect(r).toEqual({ added: 1, replaced: 0, skipped: 1, newCategories: [] });
      expect(getLibraryItem('c:new')?.name).toBe('Crampons');
    });

    it('"mine" keeps the existing item; "theirs" overwrites it (same id)', () => {
      setup();
      const incoming = [parsed({ id: 'c:theirs', name: 'Gloves', category: 'Gear & Equipment', tagKeys: ['surf'] })];
      const plan = planLibraryImport(incoming, listLibrary());

      const mine = applyLibraryImport(plan, ['mine']);
      expect(mine).toEqual({ added: 0, replaced: 0, skipped: 1, newCategories: [] });
      expect(getLibraryItem('c:mine')?.category).toBe('Clothing');

      const theirs = applyLibraryImport(plan, ['theirs']);
      expect(theirs).toEqual({ added: 0, replaced: 1, skipped: 0, newCategories: [] });
      const row = getLibraryItem('c:mine'); // id kept, content overwritten
      expect(row?.category).toBe('Gear & Equipment');
      expect(row?.tagKeys).toEqual(['surf']);
      expect(getLibraryItem('c:theirs')).toBeUndefined();
    });

    it('"both" keeps mine and adds theirs as a separate item', () => {
      setup();
      const incoming = [parsed({ id: 'c:theirs', name: 'Gloves', tagKeys: ['surf'] })];
      const plan = planLibraryImport(incoming, listLibrary());
      const r = applyLibraryImport(plan, ['both']);
      expect(r).toEqual({ added: 1, replaced: 0, skipped: 0, newCategories: [] });
      expect(listLibrary().filter((i) => i.nameKey === 'gloves')).toHaveLength(2);
    });

    it('reports new non-built-in categories among added/changed items', () => {
      setup();
      const incoming = [
        parsed({ id: 'c:new', name: 'Tent', category: 'Camping' }),
        parsed({ id: 'c:new2', name: 'Socks', category: 'Clothing' }),
      ];
      const plan = planLibraryImport(incoming, listLibrary());
      const r = applyLibraryImport(plan, []);
      expect(r.added).toBe(2);
      expect(r.newCategories).toEqual(['Camping']); // 'Clothing' is built-in
    });

    it('merges tag registry entries: adds new keys, keeps local grouping', () => {
      setup();
      setTagGroup('snow', 'activity'); // local grouping the import must not clobber
      const incoming = [parsed({ id: 'c:new', name: 'Crampons', tagKeys: ['ice'] })];
      const plan = planLibraryImport(incoming, listLibrary());
      applyLibraryImport(plan, [], [
        { key: 'snow', group: 'weather', default: true }, // conflict → keep local
        { key: 'climb', group: 'activity', default: true }, // new → added
      ]);
      const meta = listTagMeta();
      expect(meta.find((m) => m.key === 'snow')).toEqual({ key: 'snow', group: 'activity', default: false });
      expect(meta.find((m) => m.key === 'climb')).toEqual({ key: 'climb', group: 'activity', default: true });
      // 'ice' used by an added item but absent from the file's registry → backfilled
      expect(meta.find((m) => m.key === 'ice')).toEqual({ key: 'ice', group: 'other', default: false });
    });

    it('merges custom categories: adds new, keeps existing, skips built-ins', () => {
      setup();
      setData((d) => void (d.customCategories = ['Camping']));
      const incoming = [parsed({ id: 'c:new', name: 'Tent' })];
      const plan = planLibraryImport(incoming, listLibrary());
      applyLibraryImport(plan, [], [], ['Camping', 'Hobbies', 'Clothing']);
      expect(getData().customCategories).toEqual(['Camping', 'Hobbies']); // Clothing built-in, Camping kept
    });
  });
});
