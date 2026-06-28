import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  deriveWeatherTags,
  forecastRange,
  placeLabel,
  shortPlace,
  rankPlaces,
  geocodeQuery,
  summarizeWeather,
  splitWeatherWindow,
  shiftDateYears,
  averageDaily,
  lookupDestinationWeather,
  type DailyWeather,
  type GeoResult,
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

describe('shortPlace', () => {
  it('keeps only city + country, dropping the middle (province etc.)', () => {
    expect(shortPlace('Faro, Faro District, Portugal')).toBe('Faro, Portugal');
    expect(shortPlace('A, B, C, D, E')).toBe('A, E');
  });

  it('passes through a label that is already city + country', () => {
    expect(shortPlace('Berlin, Germany')).toBe('Berlin, Germany');
  });

  it('returns a single-part label unchanged and trims', () => {
    expect(shortPlace('Springfield')).toBe('Springfield');
    expect(shortPlace('  Tokyo  ')).toBe('Tokyo');
  });

  it('de-dups when city and country coincide', () => {
    expect(shortPlace('Singapore, Singapore')).toBe('Singapore');
  });

  it('bounds output to at most two comma-segments regardless of input length', () => {
    const long = Array.from({ length: 12 }, (_, i) => `Part${i}`).join(', ');
    expect(shortPlace(long).split(',').length).toBeLessThanOrEqual(2);
  });
});

describe('rankPlaces', () => {
  const p = (name: string, population?: number): GeoResult => ({ name, lat: 0, lon: 0, population });

  it('orders matches biggest-population first', () => {
    const ranked = rankPlaces([p('Parma', 195_000), p('Paris', 2_140_000), p('Paris TX', 25_000)]);
    expect(ranked.map((r) => r.name)).toEqual(['Paris', 'Parma', 'Paris TX']);
  });

  it('keeps populated places ahead of those with no population, preserving their order', () => {
    const ranked = rankPlaces([p('Nowhere'), p('Springfield', 170_000), p('Elsewhere')]);
    expect(ranked.map((r) => r.name)).toEqual(['Springfield', 'Nowhere', 'Elsewhere']);
  });

  it('is stable for equal populations and does not mutate the input', () => {
    const input = [p('A', 100), p('B', 100), p('C', 100)];
    const ranked = rankPlaces(input);
    expect(ranked.map((r) => r.name)).toEqual(['A', 'B', 'C']);
    expect(input.map((r) => r.name)).toEqual(['A', 'B', 'C']); // untouched
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

describe('splitWeatherWindow', () => {
  const today = '2026-06-20'; // forecast horizon today+7 = 2026-06-27

  it('uses forecast only for a trip within the next 7 days', () => {
    expect(splitWeatherWindow('2026-06-21', '2026-06-25', today)).toEqual({
      forecast: { startDate: '2026-06-21', endDate: '2026-06-25' },
      historical: null,
    });
  });

  it('uses historical only for a trip entirely beyond the horizon', () => {
    expect(splitWeatherWindow('2026-08-01', '2026-08-10', today)).toEqual({
      forecast: null,
      historical: { startDate: '2026-08-01', endDate: '2026-08-10' },
    });
  });

  it('mixes forecast and historical across the boundary', () => {
    expect(splitWeatherWindow('2026-06-21', '2026-08-15', today)).toEqual({
      forecast: { startDate: '2026-06-21', endDate: '2026-06-27' },
      historical: { startDate: '2026-06-28', endDate: '2026-08-15' },
    });
  });

  it('clamps a start in the past to today', () => {
    expect(splitWeatherWindow('2026-06-10', '2026-06-25', today)).toEqual({
      forecast: { startDate: '2026-06-20', endDate: '2026-06-25' },
      historical: null,
    });
  });

  it('returns nothing for a finished trip or missing dates', () => {
    expect(splitWeatherWindow('2026-05-01', '2026-05-10', today)).toEqual({
      forecast: null,
      historical: null,
    });
    expect(splitWeatherWindow(undefined, '2026-06-25', today)).toEqual({
      forecast: null,
      historical: null,
    });
  });
});

describe('shiftDateYears', () => {
  it('shifts the year while keeping month and day', () => {
    expect(shiftDateYears('2026-08-01', -1)).toBe('2025-08-01');
    expect(shiftDateYears('2026-08-01', -3)).toBe('2023-08-01');
  });
});

describe('averageDaily', () => {
  it('averages each metric element-wise across years', () => {
    const avg = averageDaily([
      { tMax: [10, 20], tMin: [0, 10], precip: [0, 4], wind: [10, 20] },
      { tMax: [20, 30], tMin: [10, 20], precip: [2, 6], wind: [30, 40] },
    ]);
    expect(avg).toEqual({ tMax: [15, 25], tMin: [5, 15], precip: [1, 5], wind: [20, 30] });
  });

  it('truncates to the shortest series', () => {
    const avg = averageDaily([
      { tMax: [10, 20, 30], tMin: [0, 0, 0], precip: [0, 0, 0], wind: [0, 0, 0] },
      { tMax: [20, 30], tMin: [0, 0], precip: [0, 0], wind: [0, 0] },
    ]);
    expect(avg.tMax).toEqual([15, 25]);
  });

  it('returns empty series for no input', () => {
    expect(averageDaily([])).toEqual({ tMax: [], tMin: [], precip: [], wind: [] });
  });

  it('carries dates from the first year, truncated to the shortest', () => {
    const avg = averageDaily([
      { tMax: [10, 20], tMin: [0, 0], precip: [0, 0], wind: [0, 0], dates: ['2025-01-01', '2025-01-02'] },
      { tMax: [20], tMin: [0], precip: [0], wind: [0], dates: ['2024-01-01'] },
    ]);
    expect(avg.dates).toEqual(['2025-01-01']);
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

describe('lookupDestinationWeather', () => {
  const dailyJson = (hot: boolean) => ({
    daily: {
      temperature_2m_max: hot ? [30, 31] : [12, 13],
      temperature_2m_min: hot ? [20, 21] : [4, 5],
      precipitation_sum: [0, 0],
      wind_speed_10m_max: [10, 12],
    },
  });

  it('uses stored coordinates and never geocodes the labelled name', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('geocoding')) throw new Error('should not geocode when coords known');
      return { ok: true, json: async () => dailyJson(true) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await lookupDestinationWeather(
      { label: 'Lisbon, Lisboa, Portugal', lat: 38.7, lon: -9.1 },
      '2026-06-21',
      '2026-06-22',
      '2026-06-20',
    );

    expect(res?.tags).toContain('hot');
    expect(res?.basis).toBe('forecast');
    expect(res?.offline).toBeFalsy();
    for (const call of fetchMock.mock.calls) expect(String(call[0])).toContain('forecast');
  });

  it('uses the historical archive for a far-future trip (basis: typical)', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return { ok: true, json: async () => dailyJson(false) };
      }),
    );

    const res = await lookupDestinationWeather(
      { label: 'Tromsø', lat: 69.6, lon: 18.9 },
      '2026-12-01',
      '2026-12-05',
      '2026-06-20',
    );

    expect(res?.basis).toBe('typical');
    expect(urls.some((u) => u.includes('archive'))).toBe(true);
    expect(urls.some((u) => u.includes('/forecast'))).toBe(false);
  });

  it('mixes forecast and archive across the horizon (basis: mixed)', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return { ok: true, json: async () => dailyJson(true) };
      }),
    );

    const res = await lookupDestinationWeather(
      { label: 'Rome', lat: 41.9, lon: 12.5 },
      '2026-06-21',
      '2026-08-15',
      '2026-06-20',
    );

    expect(res?.basis).toBe('mixed');
    expect(urls.some((u) => u.includes('/forecast'))).toBe(true);
    expect(urls.some((u) => u.includes('archive'))).toBe(true);
  });

  it('returns null when the trip has no dates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    const res = await lookupDestinationWeather(
      { label: 'Lisbon', lat: 38.7, lon: -9.1 },
      undefined,
      undefined,
      '2026-06-20',
    );
    expect(res).toBeNull();
  });

  it('falls back to bundled climate normals when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    // London is in the bundled climate set, so a far-future trip there resolves
    // from normals instead of the (failed) archive lookup.
    const res = await lookupDestinationWeather(
      { label: 'London', lat: 51.51, lon: -0.13 },
      '2026-12-01',
      '2026-12-05',
      '2026-06-20',
    );
    expect(res).not.toBeNull();
    expect(res?.basis).toBe('typical');
    expect(res?.offline).toBe(true);
    expect(res?.approxFrom).toBe('London');
  });

  it('returns null offline when no climate city is near', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const res = await lookupDestinationWeather(
      { label: 'Open ocean', lat: -40, lon: -120 },
      '2026-12-01',
      '2026-12-05',
      '2026-06-20',
    );
    expect(res).toBeNull();
  });

  it('keeps the live forecast and uses normals for the rest when the archive fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/forecast')) return { ok: true, json: async () => dailyJson(true) };
        throw new Error('archive offline');
      }),
    );
    const res = await lookupDestinationWeather(
      { label: 'London', lat: 51.51, lon: -0.13 },
      '2026-06-21',
      '2026-08-15',
      '2026-06-20',
    );
    expect(res?.basis).toBe('mixed');
    expect(res?.offline).toBe(true);
    expect(res?.approxFrom).toBe('London');
  });
});
