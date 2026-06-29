import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import { SUPPORTED_LANGUAGES } from './index';

type Json = Record<string, unknown>;

/** Flatten nested dictionaries to dotted leaf paths (`weather.tipHigh`). */
function leafKeys(obj: Json, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object'
      ? leafKeys(v as Json, path)
      : [path];
  });
}

const locales = { de, fr, es, pt } as const;
const enKeys = leafKeys(en as Json).sort();

describe('UI translations', () => {
  it('lists exactly the five supported languages', () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual(['en', 'de', 'fr', 'es', 'pt']);
  });

  for (const [code, dict] of Object.entries(locales)) {
    it(`${code} has the same key set as en`, () => {
      expect(leafKeys(dict as Json).sort()).toEqual(enKeys);
    });

    it(`${code} has no empty values`, () => {
      const empties = Object.entries(flatten(dict as Json)).filter(([, v]) => v.trim() === '');
      expect(empties.map(([k]) => k)).toEqual([]);
    });
  }
});

/** Flatten to a dotted-path → string map for the empty-value check. */
function flatten(obj: Json, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') Object.assign(out, flatten(v as Json, path));
    else out[path] = String(v);
  }
  return out;
}
