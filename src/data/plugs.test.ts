import { describe, it, expect } from 'vitest';
import { plugInfo, powerSummary } from './plugs';

describe('plugInfo', () => {
  it('looks up by country code, case-insensitively', () => {
    expect(plugInfo('pt')?.types).toEqual(['C', 'F']);
    expect(plugInfo('US')?.voltage).toBe(120);
  });

  it('returns undefined for unknown or missing codes', () => {
    expect(plugInfo('ZZ')).toBeUndefined();
    expect(plugInfo(undefined)).toBeUndefined();
  });
});

describe('powerSummary', () => {
  it('aggregates plug types and voltages across known countries', () => {
    const s = powerSummary(['GB', 'US']);
    expect(s.plugTypes).toEqual(['A', 'B', 'G']);
    expect(s.voltages).toEqual([120, 230]);
    expect(s.known.map((k) => k.code)).toEqual(['GB', 'US']);
    expect(s.unknown).toEqual([]);
  });

  it('separates countries with no data', () => {
    const s = powerSummary(['PT', 'ZZ']);
    expect(s.known.map((k) => k.code)).toEqual(['PT']);
    expect(s.unknown).toEqual(['ZZ']);
  });

  it('de-dupes plug types and voltages', () => {
    const s = powerSummary(['FR', 'DE']); // both ~C/F, 230 V
    expect(s.plugTypes).toEqual(['C', 'E', 'F']);
    expect(s.voltages).toEqual([230]);
  });
});
