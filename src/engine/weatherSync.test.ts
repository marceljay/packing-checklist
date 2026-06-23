import { describe, it, expect } from 'vitest';
import { refreshWeather, applyWeather } from './weatherSync';
import type { DestinationWeather, TripWeatherResult } from './weather';
import type { Trip } from '../types';

function city(name: string): DestinationWeather {
  return {
    place: { name, lat: 0, lon: 0 },
    tags: ['hot'],
    basis: 'forecast',
    summary: { highC: 28, lowC: 18, maxC: 31, minC: 15, precipMm: 0, windMaxKmh: 12, days: 7 },
  };
}

function result(over: Partial<TripWeatherResult> = {}): TripWeatherResult {
  return { cities: [city('Lisbon')], tags: ['hot'], ...over };
}

function makeTrip(over: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Trip',
    destinations: [],
    tags: [],
    items: [],
    settings: { laundryAvailable: false },
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const dests = [{ label: 'Lisbon' }];

describe('refreshWeather', () => {
  it('looks up with the NEW date window (a date change forecasts the new dates)', async () => {
    const calls: { start?: string; end?: string }[] = [];
    const lookup = async (_d: unknown, start?: string, end?: string) => {
      calls.push({ start, end });
      return result();
    };

    // First window, then a changed window.
    await refreshWeather(dests, '2026-07-01', '2026-07-08', lookup);
    const out = await refreshWeather(dests, '2026-09-10', '2026-09-20', lookup);

    expect(calls).toEqual([
      { start: '2026-07-01', end: '2026-07-08' },
      { start: '2026-09-10', end: '2026-09-20' }, // the changed dates, not the old ones
    ]);
    expect(out).toEqual({ status: 'done', result: result() });
  });

  it('reports no-dates when a date is missing (nothing to forecast yet)', async () => {
    let called = false;
    const lookup = async () => {
      called = true;
      return result();
    };
    expect(await refreshWeather(dests, undefined, '2026-07-08', lookup)).toEqual({
      status: 'no-dates',
    });
    expect(await refreshWeather(dests, '2026-07-01', undefined, lookup)).toEqual({
      status: 'no-dates',
    });
    expect(called).toBe(false);
  });

  it('reports empty when there are no destinations', async () => {
    expect(await refreshWeather([], '2026-07-01', '2026-07-08', async () => result())).toEqual({
      status: 'empty',
    });
  });

  it('reports no-match when the lookup finds no cities', async () => {
    const lookup = async () => result({ cities: [], tags: [] });
    expect(await refreshWeather(dests, '2026-07-01', '2026-07-08', lookup)).toEqual({
      status: 'no-match',
    });
  });

  it('reports error when the lookup throws (offline, etc.)', async () => {
    const lookup = async () => {
      throw new Error('offline');
    };
    expect(await refreshWeather(dests, '2026-07-01', '2026-07-08', lookup)).toEqual({
      status: 'error',
    });
  });
});

describe('applyWeather', () => {
  let n = 0;
  const genId = () => `wx-${++n}`;

  it('replaces weather tags with the new union and caches per-city forecasts', () => {
    n = 0;
    const trip = makeTrip({
      tags: [
        { id: 'a', label: 'surfing', type: 'activity' },
        { id: 'old', label: 'cold', type: 'weather' }, // stale weather tag
      ],
    });

    applyWeather(trip, { cities: [city('Lisbon'), city('Faro')], tags: ['hot', 'sunny'] }, genId, 1234);

    // Non-weather tags survive; stale weather tag gone; new union added.
    expect(trip.tags.filter((t) => t.type !== 'weather').map((t) => t.label)).toEqual(['surfing']);
    expect(trip.tags.filter((t) => t.type === 'weather').map((t) => t.label)).toEqual([
      'hot',
      'sunny',
    ]);
    expect(trip.weather?.fetchedAt).toBe(1234);
    expect(trip.weather?.cities.map((c) => c.place)).toEqual(['Lisbon', 'Faro']);
    expect(trip.weather?.cities[0].highC).toBe(28);
  });

  it('clears stale weather tags even when the new result has none', () => {
    n = 0;
    const trip = makeTrip({ tags: [{ id: 'old', label: 'rainy', type: 'weather' }] });
    applyWeather(trip, { cities: [city('Lisbon')], tags: [] }, genId, 1);
    expect(trip.tags.filter((t) => t.type === 'weather')).toEqual([]);
  });
});
