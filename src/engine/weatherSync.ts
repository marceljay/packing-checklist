/**
 * Glue between a trip and the weather engine, kept out of the React component so
 * the "look up / apply" behaviour is unit-testable. `refreshWeather` runs the
 * lookup for an explicit destination list and date window (the network call is
 * injectable); `applyWeather` writes the result onto a trip draft. The component
 * owns only UI state (status text, stale-request guarding).
 */
import { lookupTripWeather, type TripWeatherResult } from './weather';
import type { Tag, Trip } from '../types';

export type WeatherDest = { label: string; lat?: number; lon?: number };

export type RefreshOutcome =
  | { status: 'done'; result: TripWeatherResult }
  | { status: 'empty' } //   no destinations to look up
  | { status: 'no-dates' } // can't forecast without a window
  | { status: 'no-match' } // lookup succeeded but matched no places
  | { status: 'error' }; //  network / parse failure

type LookupFn = (
  destinations: WeatherDest[],
  start: string | undefined,
  end: string | undefined,
) => Promise<TripWeatherResult>;

/**
 * Look up weather for `destinations` over [`startDate`, `endDate`]. Always uses
 * the dates passed in (so a date change forecasts the *new* window, never a stale
 * one). Returns a tagged outcome rather than throwing.
 */
export async function refreshWeather(
  destinations: WeatherDest[],
  startDate: string | undefined,
  endDate: string | undefined,
  lookup: LookupFn = lookupTripWeather,
): Promise<RefreshOutcome> {
  if (destinations.length === 0) return { status: 'empty' };
  if (!startDate || !endDate) return { status: 'no-dates' };
  try {
    const result = await lookup(destinations, startDate, endDate);
    if (result.cities.length === 0) return { status: 'no-match' };
    return { status: 'done', result };
  } catch {
    return { status: 'error' };
  }
}

/**
 * Apply a successful lookup to a trip draft: regenerate the weather-type tags
 * from scratch (so tags from a since-removed destination don't linger; context
 * tags drive suggestions, item tags live in the library) and cache the per-city
 * forecast. Pure aside from the injected id/clock.
 */
export function applyWeather(
  draft: Trip,
  result: TripWeatherResult,
  genId: () => string,
  now: number = Date.now(),
): void {
  draft.tags = draft.tags.filter((t) => t.type !== 'weather');
  for (const k of result.tags) {
    const tag: Tag = { id: genId(), label: k, type: 'weather' };
    draft.tags.push(tag);
  }
  draft.weather = {
    fetchedAt: now,
    cities: result.cities.map((c) => ({
      place: c.place.name,
      basis: c.basis,
      days: c.summary.days,
      highC: c.summary.highC,
      lowC: c.summary.lowC,
      maxC: c.summary.maxC,
      minC: c.summary.minC,
      precipMm: c.summary.precipMm,
      windMaxKmh: c.summary.windMaxKmh,
    })),
  };
}
