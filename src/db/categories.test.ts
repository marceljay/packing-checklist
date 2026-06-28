import { describe, it, expect, beforeEach } from 'vitest';
import { setData, getData } from './store';
import { listCategories, addCategory, renameCategory, deleteCategory, FALLBACK_CATEGORY } from './categories';
import { CATEGORIES, type LibraryItem } from '../types';

beforeEach(() => {
  setData((d) => {
    d.trips = [];
    d.library = [];
    d.removedDefaultIds = [];
    d.tagMeta = [];
    d.removedTagKeys = [];
    d.customCategories = [];
    d.removedCategories = [];
  });
});

const item = (name: string, category: string): LibraryItem => ({
  id: `c:${name}`,
  nameKey: name.toLowerCase(),
  name,
  category,
  tagKeys: [],
  custom: true,
  count: 0,
  lastUsed: 0,
});
const setLibrary = (...items: LibraryItem[]) => setData((d) => void (d.library = items));

describe('listCategories', () => {
  it('returns built-ins first, then customs, then item-only categories', () => {
    setData((d) => void (d.customCategories = ['Camping']));
    setLibrary(item('Tent', 'Camping'), item('Drone', 'Hobbies'));
    const cats = listCategories();
    expect(cats.slice(0, CATEGORIES.length)).toEqual([...CATEGORIES]);
    expect(cats).toContain('Camping');
    expect(cats).toContain('Hobbies'); // present on an item but not registered
    // no duplicates
    expect(new Set(cats).size).toBe(cats.length);
  });

  it('hides tombstoned built-ins', () => {
    setData((d) => void (d.removedCategories = ['Footwear']));
    expect(listCategories()).not.toContain('Footwear');
  });
});

describe('addCategory', () => {
  it('adds a new custom category that has no items', () => {
    addCategory('  Camping ');
    expect(getData().customCategories).toEqual(['Camping']);
    expect(listCategories()).toContain('Camping');
  });

  it('is a no-op for a duplicate, and un-tombstones a built-in instead of duplicating', () => {
    addCategory('Camping');
    addCategory('Camping');
    expect(getData().customCategories).toEqual(['Camping']);

    setData((d) => void (d.removedCategories = ['Footwear']));
    addCategory('Footwear');
    expect(getData().removedCategories).not.toContain('Footwear');
    expect(getData().customCategories).not.toContain('Footwear'); // stays a built-in
  });
});

describe('renameCategory', () => {
  it('rewrites items and the registry; built-in source is tombstoned', () => {
    setLibrary(item('Boots', 'Footwear'), item('Sandals', 'Footwear'));
    renameCategory('Footwear', 'Shoes');
    expect(getData().library.map((i) => i.category)).toEqual(['Shoes', 'Shoes']);
    expect(getData().removedCategories).toContain('Footwear'); // built-in hidden
    expect(getData().customCategories).toContain('Shoes'); // new name registered
    const cats = listCategories();
    expect(cats).toContain('Shoes');
    expect(cats).not.toContain('Footwear');
  });

  it('renaming a custom drops the old name; renaming onto an existing name merges', () => {
    setData((d) => void (d.customCategories = ['Camping']));
    setLibrary(item('Tent', 'Camping'), item('Boots', 'Footwear'));
    renameCategory('Camping', 'Footwear'); // onto a built-in
    expect(getData().customCategories).not.toContain('Camping');
    expect(getData().library.map((i) => i.category).sort()).toEqual(['Footwear', 'Footwear']);
  });

  it('no-ops on blank target or rename onto itself', () => {
    setLibrary(item('Boots', 'Footwear'));
    renameCategory('Footwear', '   ');
    renameCategory('Footwear', 'Footwear');
    expect(getData().library[0].category).toBe('Footwear');
    expect(getData().removedCategories).toEqual([]);
  });
});

describe('deleteCategory', () => {
  it('reassigns items to the fallback and tombstones a built-in', () => {
    setLibrary(item('Boots', 'Footwear'), item('Hat', 'Clothing'));
    deleteCategory('Footwear');
    expect(getData().library.find((i) => i.name === 'Boots')?.category).toBe(FALLBACK_CATEGORY);
    expect(getData().library.find((i) => i.name === 'Hat')?.category).toBe('Clothing');
    expect(getData().removedCategories).toContain('Footwear');
  });

  it('drops a custom category and reassigns its items', () => {
    setData((d) => void (d.customCategories = ['Camping']));
    setLibrary(item('Tent', 'Camping'));
    deleteCategory('Camping');
    expect(getData().customCategories).not.toContain('Camping');
    expect(getData().library[0].category).toBe(FALLBACK_CATEGORY);
  });

  it('refuses to delete the fallback category', () => {
    setLibrary(item('Pillow', FALLBACK_CATEGORY));
    deleteCategory(FALLBACK_CATEGORY);
    expect(getData().library[0].category).toBe(FALLBACK_CATEGORY);
    expect(getData().removedCategories).toEqual([]);
  });
});
