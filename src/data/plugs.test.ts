import { describe, it, expect } from 'vitest';
import { plugInfo, powerSummary, travelPowerAdvice } from './plugs';

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

describe('travelPowerAdvice', () => {
  it('flags an adapter and converter for US → UK (A/B 120V → G 230V)', () => {
    const a = travelPowerAdvice('US', ['GB']);
    expect(a.home?.code).toBe('US');
    expect(a.needsAdapter).toBe(true);
    expect(a.adapterFor).toEqual(['G']); // G isn't on a US plug
    expect(a.needsConverter).toBe(true);
    expect(a.voltageMismatch).toEqual([230]);
  });

  it('needs no adapter or converter within the same plug/voltage region (DE → FR)', () => {
    const a = travelPowerAdvice('DE', ['FR']); // both C/F-ish, 230V
    expect(a.needsAdapter).toBe(false);
    expect(a.adapterFor).toEqual([]);
    expect(a.needsConverter).toBe(false);
    expect(a.voltageMismatch).toEqual([]);
  });

  it('flags an adapter but no converter when only the plug differs (GB → FR, both 230V)', () => {
    const a = travelPowerAdvice('GB', ['FR']);
    expect(a.needsAdapter).toBe(true);
    expect(a.adapterFor).toEqual(['C', 'E']);
    expect(a.needsConverter).toBe(false);
  });

  it('treats 100–127V as one region and 220–240V as another (JP → AU)', () => {
    const a = travelPowerAdvice('JP', ['AU']); // 100V A/B → 230V I
    expect(a.needsConverter).toBe(true);
    expect(a.voltageMismatch).toEqual([230]);
  });

  it('gives no advice without a home country', () => {
    const a = travelPowerAdvice(undefined, ['GB']);
    expect(a.home).toBeUndefined();
    expect(a.needsAdapter).toBe(false);
    expect(a.needsConverter).toBe(false);
  });

  it('ignores destinations with no plug data', () => {
    const a = travelPowerAdvice('US', ['ZZ']);
    expect(a.needsAdapter).toBe(false);
    expect(a.needsConverter).toBe(false);
  });

  it('covers expanded Type-G countries (GB → CY: same plug & region)', () => {
    expect(plugInfo('CY')?.types).toEqual(['G']);
    const a = travelPowerAdvice('GB', ['CY']);
    expect(a.needsAdapter).toBe(false);
    expect(a.needsConverter).toBe(false);
  });

  it('advises adapter + converter for US → Kenya (A/B 120V → G 240V)', () => {
    expect(plugInfo('KE')?.voltage).toBe(240);
    const a = travelPowerAdvice('US', ['KE']);
    expect(a.needsAdapter).toBe(true);
    expect(a.needsConverter).toBe(true);
  });
});
