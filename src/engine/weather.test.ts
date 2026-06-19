import { describe, it, expect } from 'vitest';
import { deriveWeatherTags, forecastRange, type DailyWeather } from './weather';

function daily(over: Partial<DailyWeather>): DailyWeather {
  return { tMax: [], tMin: [], precip: [], wind: [], ...over };
}

describe('deriveWeatherTags', () => {
  it('returns no tags for empty data', () => {
    expect(deriveWeatherTags(daily({}))).toEqual([]);
  });

  it('flags hot for warm, dry days', () => {
    const tags = deriveWeatherTags(
      daily({ tMax: [28, 30, 29], tMin: [18, 19, 17], precip: [0, 0, 0], wind: [10, 12, 8] }),
    );
    expect(tags).toContain('hot');
  });

  it('flags cold when it freezes', () => {
    const tags = deriveWeatherTags(
      daily({ tMax: [2, 3, 1], tMin: [-2, -5, -3], precip: [0, 0, 1], wind: [10, 9, 8] }),
    );
    expect(tags).toEqual(['cold']);
  });

  it('flags rainy when precipitation accumulates', () => {
    const tags = deriveWeatherTags(
      daily({ tMax: [15, 16, 14, 15], tMin: [10, 11, 9, 10], precip: [5, 8, 2, 6], wind: [10, 9, 8, 7] }),
    );
    expect(tags).toContain('rainy');
    expect(tags).not.toContain('sunny');
  });

  it('flags sunny for mild, dry days', () => {
    const tags = deriveWeatherTags(
      daily({ tMax: [21, 22], tMin: [12, 13], precip: [0, 0], wind: [10, 8] }),
    );
    expect(tags).toEqual(['sunny']);
  });

  it('flags windy when any day is gusty', () => {
    const tags = deriveWeatherTags(
      daily({ tMax: [18, 19], tMin: [8, 9], precip: [0, 0], wind: [40, 20] }),
    );
    expect(tags).toContain('windy');
  });

  it('returns multiple tags in canonical order', () => {
    const tags = deriveWeatherTags(
      daily({ tMax: [31, 30], tMin: [20, 21], precip: [12, 15], wind: [50, 30] }),
    );
    expect(tags).toEqual(['hot', 'rainy', 'windy']);
  });
});

describe('forecastRange', () => {
  const today = '2026-06-19';

  it('keeps a future range that sits within the forecast horizon', () => {
    expect(forecastRange('2026-06-20', '2026-06-25', today)).toEqual({
      startDate: '2026-06-20',
      endDate: '2026-06-25',
    });
  });

  it('clamps a start in the past to today', () => {
    expect(forecastRange('2026-06-01', '2026-06-25', today)).toEqual({
      startDate: '2026-06-19',
      endDate: '2026-06-25',
    });
  });

  it('clamps an end beyond the 16-day horizon', () => {
    expect(forecastRange('2026-06-20', '2026-12-01', today)).toEqual({
      startDate: '2026-06-20',
      endDate: '2026-07-05',
    });
  });

  it('returns null for a trip entirely in the past', () => {
    expect(forecastRange('2026-06-01', '2026-06-10', today)).toBeNull();
  });

  it('returns null for a trip entirely beyond the horizon', () => {
    expect(forecastRange('2026-12-01', '2026-12-10', today)).toBeNull();
  });

  it('returns null when dates are missing', () => {
    expect(forecastRange(undefined, '2026-06-25', today)).toBeNull();
    expect(forecastRange('2026-06-20', undefined, today)).toBeNull();
  });
});
