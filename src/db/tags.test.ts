import { describe, it, expect, beforeEach } from 'vitest';
import { setData, getData } from './store';
import {
  seedTagMeta,
  listTagMeta,
  getTagGroup,
  isDefaultTag,
  setTagGroup,
  setTagDefault,
  renameTag,
  deleteTag,
} from './tags';
import type { LibraryItem, Trip } from '../types';
import { BUILTIN_TAGS } from '../data/tags';

beforeEach(() => {
  setData((d) => {
    d.trips = [];
    d.library = [];
    d.removedDefaultIds = [];
    d.tagMeta = [];
    d.removedTagKeys = [];
  });
});

const item = (name: string, tagKeys: string[]): LibraryItem => ({
  id: `c:${name}`,
  nameKey: name.toLowerCase(),
  name,
  category: 'Comfort & Misc',
  tagKeys,
  custom: true,
  count: 0,
  lastUsed: 0,
});

const tripWithTags = (...labels: string[]): Trip =>
  ({ tags: labels.map((l, i) => ({ id: `t${i}`, label: l, type: 'custom' })), items: [] } as unknown as Trip);

const setLibrary = (...items: LibraryItem[]) => setData((d) => void (d.library = items));
const setTrips = (...trips: Trip[]) => setData((d) => void (d.trips = trips));
const groupOf = (key: string) => listTagMeta().find((t) => t.key === key);

describe('seedTagMeta', () => {
  it('seeds every built-in as a default tag with its group', () => {
    seedTagMeta();
    const hot = groupOf('hot');
    const hiking = groupOf('hiking');
    expect(hot).toEqual({ key: 'hot', group: 'weather', default: true });
    expect(hiking).toEqual({ key: 'hiking', group: 'activity', default: true });
    expect(listTagMeta()).toHaveLength(BUILTIN_TAGS.length);
  });

  it('backfills library tags as group "other", not default', () => {
    setLibrary(item('Drone', ['photography', 'gadgets']));
    seedTagMeta();
    // photography is a built-in (activity); gadgets is new → other/non-default
    expect(groupOf('photography')).toEqual({ key: 'photography', group: 'activity', default: true });
    expect(groupOf('gadgets')).toEqual({ key: 'gadgets', group: 'other', default: false });
  });

  it('is idempotent and never overwrites an existing entry', () => {
    seedTagMeta();
    setTagGroup('hot', 'other'); // user re-groups a built-in
    seedTagMeta(); // a later boot
    expect(groupOf('hot')).toEqual({ key: 'hot', group: 'other', default: true });
    expect(listTagMeta()).toHaveLength(BUILTIN_TAGS.length);
  });
});

describe('getters', () => {
  it('default to "other"/false for unknown tags', () => {
    expect(getTagGroup('nope')).toBe('other');
    expect(isDefaultTag('nope')).toBe(false);
  });
});

describe('setters', () => {
  it('set group and default, creating an entry if missing', () => {
    setTagGroup('diving', 'activity');
    setTagDefault('diving', true);
    expect(groupOf('diving')).toEqual({ key: 'diving', group: 'activity', default: true });
  });
});

describe('renameTag', () => {
  it('rewrites the registry, library items, and trips; dedups', () => {
    setTagGroup('beach', 'activity');
    setLibrary(item('Towel', ['beach']), item('Hat', ['beach', 'sun']));
    setTrips(tripWithTags('beach', 'sun'));

    renameTag('beach', 'seaside');

    expect(groupOf('beach')).toBeUndefined();
    expect(groupOf('seaside')?.group).toBe('activity');
    expect(getData().library.map((i) => i.tagKeys)).toEqual([['seaside'], ['seaside', 'sun']]);
    expect(getData().trips[0].tags.map((t) => t.label)).toEqual(['seaside', 'sun']);
  });

  it('dedups when renaming onto a tag a trip/item already has', () => {
    setLibrary(item('Hat', ['beach', 'seaside']));
    setTrips(tripWithTags('beach', 'seaside'));
    renameTag('beach', 'seaside');
    expect(getData().library[0].tagKeys).toEqual(['seaside']);
    expect(getData().trips[0].tags.map((t) => t.label)).toEqual(['seaside']);
  });
});

describe('deleteTag', () => {
  it('removes the tag everywhere; orphaned items fall back to misc; items are kept', () => {
    setTagGroup('beach', 'activity');
    setLibrary(item('Towel', ['beach']), item('Hat', ['beach', 'sun']), item('Book', []));
    setTrips(tripWithTags('beach', 'sun'));

    deleteTag('beach');

    // registry: gone, misc created
    expect(groupOf('beach')).toBeUndefined();
    expect(groupOf('misc')).toEqual({ key: 'misc', group: 'other', default: false });
    // items kept; Towel orphaned → misc; Hat keeps sun; Book untouched (still untagged)
    const lib = getData().library;
    expect(lib).toHaveLength(3);
    expect(lib.find((i) => i.name === 'Towel')?.tagKeys).toEqual(['misc']);
    expect(lib.find((i) => i.name === 'Hat')?.tagKeys).toEqual(['sun']);
    expect(lib.find((i) => i.name === 'Book')?.tagKeys).toEqual([]);
    // trips: tag removed
    expect(getData().trips[0].tags.map((t) => t.label)).toEqual(['sun']);
  });

  it('does not create misc when nothing was orphaned', () => {
    setLibrary(item('Hat', ['beach', 'sun']));
    deleteTag('beach');
    expect(groupOf('misc')).toBeUndefined();
    expect(getData().library[0].tagKeys).toEqual(['sun']);
  });
});

describe('built-in tag edits survive a reload (tombstones)', () => {
  it('deleting a built-in tombstones it so the next boot does not re-seed it', () => {
    seedTagMeta();
    expect(groupOf('hot')).toBeDefined();
    deleteTag('hot');
    expect(getData().removedTagKeys).toContain('hot');
    seedTagMeta(); // a later boot
    expect(groupOf('hot')).toBeUndefined();
  });

  it('renaming a built-in tombstones the old key (no resurrection on boot)', () => {
    seedTagMeta();
    renameTag('hot', 'warm');
    expect(getData().removedTagKeys).toContain('hot');
    seedTagMeta();
    expect(groupOf('hot')).toBeUndefined();
    expect(groupOf('warm')).toBeDefined();
  });

  it('does not tombstone a custom (non-built-in) tag', () => {
    setTagGroup('gadgets', 'other');
    deleteTag('gadgets');
    expect(getData().removedTagKeys).not.toContain('gadgets');
  });
});
