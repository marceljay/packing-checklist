import { describe, it, expect } from 'vitest';
import { serializeLibrary, parseLibrary } from './libraryTransfer';
import type { LibraryItem } from '../types';

function row(over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'pas81',
    nameKey: 'passport',
    name: 'Passport',
    category: 'Documents',
    tagKeys: ['intl'],
    custom: false,
    essential: true,
    count: 3,
    lastUsed: 9,
    ...over,
  };
}

describe('serializeLibrary / parseLibrary', () => {
  it('round-trips every row with its id, tags and counts', () => {
    const items = [row(), row({ id: 'soc11', nameKey: 'socks', name: 'Socks', category: 'Clothing', tagKeys: [], custom: true, essential: undefined, count: 0, lastUsed: 0 })];
    const parsed = parseLibrary(serializeLibrary(items));
    expect(parsed.map((p) => p.id)).toEqual(['pas81', 'soc11']);
    expect(parsed[0]).toMatchObject({ name: 'Passport', category: 'Documents', tagKeys: ['intl'], essential: true, count: 3 });
    expect(parsed[1].custom).toBe(true);
  });

  it('normalizes name into nameKey and lowercases tag keys', () => {
    const parsed = parseLibrary(JSON.stringify({ items: [{ name: '  Sun Hat ', category: 'Clothing', tagKeys: ['Beach'] }] }));
    expect(parsed[0]).toMatchObject({ nameKey: 'sun hat', name: 'Sun Hat', tagKeys: ['beach'], count: 0 });
  });

  it('defaults a bad category and drops blank-named rows', () => {
    const parsed = parseLibrary(JSON.stringify({ items: [{ name: 'X', category: 'Nope' }, { name: '   ' }] }));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].category).toBe('Comfort & Misc');
  });

  it('accepts a bare items array', () => {
    const parsed = parseLibrary(JSON.stringify([{ name: 'Towel', category: 'Comfort & Misc' }]));
    expect(parsed[0].name).toBe('Towel');
  });

  it('throws on invalid JSON and on non-library files', () => {
    expect(() => parseLibrary('{nope')).toThrow();
    expect(() => parseLibrary(JSON.stringify({ hello: 'world' }))).toThrow();
  });
});
