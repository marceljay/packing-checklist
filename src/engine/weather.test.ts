import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  deriveWeatherTags,
  forecastRange,
  placeLabel,
  geocodeQuery,
  lookupWeatherTags,
  summarizeWeather,
  type DailyWeather,
} from './weather';

afterEach(() => vi.unstubAllGlobals());

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

describe('placeLabel', () => {
  it('joins name, region and country', () => {
    expect(placeLabel({ name: 'Faro', admin1: 'Faro District', country: 'Portugal' })).toBe(
      'Faro, Faro District, Portugal',
    );
  });

  it('drops a region that just repeats the name', () => {
    expect(placeLabel({ name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal' })).toBe(
      'Lisbon, Portugal',
    );
  });

  it('omits missing parts', () => {
    expect(placeLabel({ name: 'Berlin', country: 'Germany' })).toBe('Berlin, Germany');
    expect(placeLabel({ name: 'Springfield' })).toBe('Springfield');
  });
});

describe('summarizeWeather', () => {
  function daily(over: Partial<DailyWeather>): DailyWeather {
    return { tMax: [], tMin: [], precip: [], wind: [], ...over };
  }

  it('computes average high/low, extremes, totals and day count', () => {
    const s = summarizeWeather(
      daily({ tMax: [20, 30], tMin: [10, 14], precip: [0, 5], wind: [10, 40] }),
    );
    expect(s).toEqual({
      highC: 25, // avg of highs
      lowC: 12, // avg of lows
      maxC: 30,
      minC: 10,
      precipMm: 5, // total
      windMaxKmh: 40,
      days: 2,
    });
  });

  it('rounds to whole numbers', () => {
    const s = summarizeWeather(daily({ tMax: [21, 22], tMin: [9, 10], precip: [1.4], wind: [12.6] }));
    expect(s.highC).toBe(22); // 21.5 -> 22
    expect(s.lowC).toBe(10); // 9.5 -> 10
    expect(s.precipMm).toBe(1); // 1.4 -> 1
    expect(s.windMaxKmh).toBe(13); // 12.6 -> 13
  });

  it('returns zeros and no days for empty data', () => {
    expect(summarizeWeather(daily({}))).toEqual({
      highC: 0,
      lowC: 0,
      maxC: 0,
      minC: 0,
      precipMm: 0,
      windMaxKmh: 0,
      days: 0,
    });
  });
});

describe('geocodeQuery', () => {
  it('uses only the city portion of a labelled place', () => {
    expect(geocodeQuery('Lisbon, Lisboa, Portugal')).toBe('Lisbon');
  });

  it('passes a plain name through', () => {
    expect(geocodeQuery('Berlin')).toBe('Berlin');
  });
});

describe('lookupWeatherTags', () => {
  const HOT = {
    daily: {
      temperature_2m_max: [30, 31],
      temperature_2m_min: [20, 21],
      precipitation_sum: [0, 0],
      wind_speed_10m_max: [10, 12],
    },
  };

  it('uses stored coordinates and never geocodes the labelled name', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('geocoding')) throw new Error('should not geocode when coords known');
      return { ok: true, json: async () => HOT };
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await lookupWeatherTags(
      { label: 'Lisbon, Lisboa, Portugal', lat: 38.7, lon: -9.1 },
      '2026-06-21',
      '2026-06-22',
      '2026-06-20',
    );

    expect(res?.tags).toContain('hot');
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain('forecast');
    }
  });

  it('geocodes by city name when no coordinates are stored', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(String(url));
        const json = String(url).includes('geocoding')
          ? { results: [{ name: 'Lisbon', latitude: 38.7, longitude: -9.1, country: 'Portugal' }] }
          : HOT;
        return { ok: true, json: async () => json };
      }),
    );

    const res = await lookupWeatherTags({ label: 'Lisbon' }, undefined, undefined, '2026-06-20');

    expect(res).not.toBeNull();
    expect(urls.some((u) => u.includes('geocoding'))).toBe(true);
  });
});
