import { describe, it, expect } from 'vitest';
import { convTemp, formatPrecip, formatWind, convWeight, formatWeight } from './units';

describe('convTemp', () => {
  it('rounds Celsius unchanged in metric', () => {
    expect(convTemp(21.4, 'metric')).toBe(21);
    expect(convTemp(-3.6, 'metric')).toBe(-4);
  });

  it('converts to Fahrenheit in imperial', () => {
    expect(convTemp(0, 'imperial')).toBe(32);
    expect(convTemp(100, 'imperial')).toBe(212);
    expect(convTemp(25, 'imperial')).toBe(77);
  });
});

describe('formatPrecip', () => {
  it('shows millimetres in metric', () => {
    expect(formatPrecip(12.6, 'metric')).toBe('13 mm');
  });

  it('shows inches to one decimal in imperial', () => {
    expect(formatPrecip(25.4, 'imperial')).toBe('1.0 in');
    expect(formatPrecip(50.8, 'imperial')).toBe('2.0 in');
  });
});

describe('formatWind', () => {
  it('shows km/h in metric', () => {
    expect(formatWind(35.4, 'metric')).toBe('35 km/h');
  });

  it('converts to mph in imperial', () => {
    expect(formatWind(160.9344, 'imperial')).toBe('100 mph');
  });
});

describe('convWeight / formatWeight', () => {
  it('converts grams to kg (metric) and lb (imperial)', () => {
    expect(convWeight(1000, 'metric')).toBeCloseTo(1);
    expect(convWeight(453.59237, 'imperial')).toBeCloseTo(1);
  });

  it('keeps one decimal under 10 units and rounds above', () => {
    expect(formatWeight(7500, 'metric')).toBe('7.5 kg');
    expect(formatWeight(12000, 'metric')).toBe('12 kg');
    expect(formatWeight(453.59237, 'imperial')).toBe('1.0 lb');
  });
});
