import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  nearestClimateCity,
  monthWetPattern,
  climateDailyForRange,
  localSearchCities,
  type ClimateCity,
} from './climate';
import type { GeoResult } from './weather';

const city = (over: Partial<ClimateCity>): ClimateCity => ({
  name: 'Test',
  cc: 'XX',
  lat: 0,
  lon: 0,
  months: Array.from({ length: 12 }, (_, m) => ({ hi: 20 + m, lo: 10 + m, rain: 30, dry: 20 })),
  ...over,
});

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(40, -74, 40, -74)).toBe(0);
  });

  it('measures ~111 km per degree of latitude', () => {
    expect(haversineKm(0, 0, 0, 1)).toBeGreaterThan(110);
    expect(haversineKm(0, 0, 0, 1)).toBeLessThan(112);
  });

  it('approximates London → Paris (~344 km)', () => {
    const d = haversineKm(51.51, -0.13, 48.85, 2.35);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(360);
  });
});

describe('nearestClimateCity', () => {
  const cities = [
    city({ name: 'A', lat: 0, lon: 0 }),
    city({ name: 'B', lat: 10, lon: 10 }),
    city({ name: 'C', lat: 50, lon: 50 }),
  ];

  it('returns the closest city', () => {
    expect(nearestClimateCity(1, 1, cities)?.name).toBe('A');
    expect(nearestClimateCity(11, 9, cities)?.name).toBe('B');
  });

  it('returns null when nothing is within the distance cap', () => {
    expect(nearestClimateCity(0, 0, cities, 1)?.name).toBe('A'); // exact-ish
    expect(nearestClimateCity(80, 80, cities, 500)).toBeNull();
  });
});

describe('monthWetPattern', () => {
  it('has the requested length and exactly wetDays true entries', () => {
    const p = monthWetPattern(30, 12);
    expect(p).toHaveLength(30);
    expect(p.filter(Boolean)).toHaveLength(12);
  });

  it('is all dry when there are no wet days', () => {
    expect(monthWetPattern(31, 0).every((w) => !w)).toBe(true);
  });

  it('is all wet when every day is wet', () => {
    expect(monthWetPattern(28, 28).every(Boolean)).toBe(true);
  });
});

describe('climateDailyForRange', () => {
  const c = city({});

  it('uses the month normals for highs and lows, and never reports wind', () => {
    const d = climateDailyForRange(c, { startDate: '2026-03-01', endDate: '2026-03-07' });
    expect(d.tMax).toHaveLength(7);
    expect(d.tMax.every((t) => t === 22)).toBe(true); // March = month index 2 → hi 22
    expect(d.tMin.every((t) => t === 12)).toBe(true);
    expect(d.wind.every((w) => w === 0)).toBe(true);
  });

  it('distributes monthly rainfall across the window without exceeding it', () => {
    const d = climateDailyForRange(c, { startDate: '2026-03-01', endDate: '2026-03-31' });
    const total = d.precip.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeCloseTo(30, 5); // a full month recovers the monthly normal
  });

  it('switches month normals across a month boundary', () => {
    const d = climateDailyForRange(c, { startDate: '2026-03-30', endDate: '2026-04-02' });
    expect(d.tMax).toEqual([22, 22, 23, 23]); // Mar, Mar, Apr, Apr
  });

  it('labels each day with its ISO date', () => {
    const d = climateDailyForRange(c, { startDate: '2026-03-30', endDate: '2026-04-02' });
    expect(d.dates).toEqual(['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02']);
  });
});

describe('localSearchCities', () => {
  const cities: GeoResult[] = [
    { name: 'Tokyo', lat: 35.7, lon: 139.7, countryCode: 'JP' },
    { name: 'Toronto', lat: 43.7, lon: -79.4, countryCode: 'CA' },
    { name: 'Berlin', lat: 52.5, lon: 13.4, countryCode: 'DE' },
  ];

  it('matches by name prefix, case-insensitively', () => {
    const r = localSearchCities('to', 5, cities).map((c) => c.name);
    expect(r).toContain('Tokyo');
    expect(r).toContain('Toronto');
    expect(r).not.toContain('Berlin');
  });

  it('respects the result limit', () => {
    expect(localSearchCities('t', 1, cities)).toHaveLength(1);
  });

  it('returns nothing for a blank query', () => {
    expect(localSearchCities('', 5, cities)).toEqual([]);
  });
});
