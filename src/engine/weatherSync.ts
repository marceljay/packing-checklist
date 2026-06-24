/**
 * Glue between a trip and the weather engine, kept out of the React component so
 * the "look up / apply" behaviour is unit-testable. `refreshWeather` runs the
 * lookup for an explicit destination list and date window (the network call is
 * injectable); `applyWeather` writes the result onto a trip draft. The component
 * owns only UI state (status text, stale-request guarding).
 */
import { lookupTripWeather, WEATHER_TAG_KEYS, type DailyWeather, type TripWeatherResult } from './weather';
import type { CityDay, CityForecast, Tag, Trip } from '../types';

export type WeatherDest = { label: string; lat?: number; lon?: number };

/** UI lifecycle of a forecast lookup, shared between the panel that triggers it
 *  and the card that shows the result (so the card can render a loading state). */
export type WeatherStatus = 'idle' | 'loading' | 'done' | 'error';

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

/** Tolerant match between a cached forecast city and a destination — stored place
 *  names vary (full "Lisbon, Portugal" vs geocoded "Lisbon"). */
export function cityMatchesDestination(city: CityForecast, dest: { label: string }): boolean {
  const p = city.place.trim().toLowerCase();
  const label = dest.label.trim().toLowerCase();
  const head = label.split(',')[0].trim();
  return p === label || p === head || (p.length > 0 && (label.includes(p) || p.includes(head)));
}

/**
 * Recompute the forecast + weather-tag union for the destinations that remain
 * after one is removed — locally, from each kept city's stored tags (no network).
 * No destinations left → empty. Tags come back in canonical order.
 */
export function recomputeWeatherAfterRemoval(
  cities: CityForecast[],
  remaining: { label: string }[],
): { cities: CityForecast[]; tags: string[] } {
  if (remaining.length === 0) return { cities: [], tags: [] };
  const kept = cities.filter((c) => remaining.some((d) => cityMatchesDestination(c, d)));
  const present = new Set(kept.flatMap((c) => c.tags ?? []));
  return { cities: kept, tags: WEATHER_TAG_KEYS.filter((k) => present.has(k)) };
}

/**
 * Apply a successful lookup to a trip draft: regenerate the weather-type tags
 * from scratch (so tags from a since-removed destination don't linger; context
 * tags drive suggestions, item tags live in the library) and cache the per-city
 * forecast. Pure aside from the injected id/clock.
 */
/**
 * Reduce a merged daily series to the compact, rounded per-day breakdown stored
 * on a trip. Returns undefined unless the series carries dates parallel to its
 * metrics (so the breakdown is only kept when it's actually day-aligned).
 */
export function buildCityDays(daily: DailyWeather | undefined): CityDay[] | undefined {
  const dates = daily?.dates;
  if (!daily || !dates || dates.length === 0 || dates.length !== daily.tMax.length) {
    return undefined;
  }
  return dates.map((date, i) => ({
    date,
    highC: Math.round(daily.tMax[i]),
    lowC: Math.round(daily.tMin[i]),
    precipMm: Math.round(daily.precip[i]),
    windKmh: Math.round(daily.wind[i]),
  }));
}

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
      offline: c.offline,
      approxFrom: c.approxFrom,
      daily: buildCityDays(c.daily),
      tags: c.tags,
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
