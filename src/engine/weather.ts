/**
 * Weather → tag derivation (SPEC §6). Pure functions plus a thin Open-Meteo
 * client. The lookup is user-triggered and the only outbound request the app
 * makes; failures fall back to manual tags.
 */
import type { WeatherBasis } from '../types';
import { nearestClimateCity, climateDailyForRange, localSearchCities } from './climate';

/** Daily aggregates for the trip window. Temps °C, precip mm/day, wind km/h. */
export interface DailyWeather {
  tMax: number[];
  tMin: number[];
  precip: number[];
  wind: number[];
}

/** Weather tag keys this engine can produce (subset of BUILTIN_TAGS). */
export const WEATHER_TAG_KEYS = ['hot', 'cold', 'rainy', 'sunny', 'windy'] as const;
export type WeatherTagKey = (typeof WEATHER_TAG_KEYS)[number];

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Derive weather tag keys from daily aggregates, in canonical order. Thresholds:
 * - hot   avg high ≥ 25°C or any day ≥ 30°C
 * - cold  avg low ≤ 5°C or any day ≤ 0°C
 * - rainy ≥ 40% of days wet (≥1mm) or ≥ 20mm total
 * - sunny mild & dry (not rainy and avg high ≥ 20°C)
 * - windy any day with gusts ≥ 35 km/h
 */
export function deriveWeatherTags(d: DailyWeather): WeatherTagKey[] {
  if (d.tMax.length === 0 && d.tMin.length === 0) return [];

  const hot = avg(d.tMax) >= 25 || Math.max(...d.tMax, -Infinity) >= 30;
  const cold = avg(d.tMin) <= 5 || Math.min(...d.tMin, Infinity) <= 0;
  const wetDays = d.precip.filter((p) => p >= 1).length;
  const rainy =
    (d.precip.length > 0 && wetDays / d.precip.length >= 0.4) ||
    d.precip.reduce((a, b) => a + b, 0) >= 20;
  const sunny = !rainy && avg(d.tMax) >= 20;
  const windy = Math.max(...d.wind, -Infinity) >= 35;

  const flags: Record<WeatherTagKey, boolean> = { hot, cold, rainy, sunny, windy };
  return WEATHER_TAG_KEYS.filter((k) => flags[k]);
}

/** A compact, displayable summary of a forecast window. Temps °C, precip mm. */
export interface WeatherSummary {
  /** Average daily high. */
  highC: number;
  /** Average daily low. */
  lowC: number;
  /** Warmest day. */
  maxC: number;
  /** Coldest night. */
  minC: number;
  /** Total precipitation over the window. */
  precipMm: number;
  /** Strongest daily gust. */
  windMaxKmh: number;
  /** Number of days summarized. */
  days: number;
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** Reduce daily aggregates to a human-readable summary (rounded to whole units). */
export function summarizeWeather(d: DailyWeather): WeatherSummary {
  const days = d.tMax.length;
  if (days === 0) {
    return { highC: 0, lowC: 0, maxC: 0, minC: 0, precipMm: 0, windMaxKmh: 0, days: 0 };
  }
  return {
    highC: Math.round(avg(d.tMax)),
    lowC: Math.round(avg(d.tMin)),
    maxC: Math.round(Math.max(...d.tMax)),
    minC: Math.round(Math.min(...d.tMin)),
    precipMm: Math.round(sum(d.precip)),
    windMaxKmh: Math.round(Math.max(...d.wind)),
    days,
  };
}

// --- Date window -----------------------------------------------------------

const FORECAST_HORIZON_DAYS = 16;
/** Days of live forecast we trust; beyond this we use historical typical data. */
const FORECAST_TRUST_DAYS = 7;

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Shift an ISO date by a number of years (month/day preserved where possible). */
export function shiftDateYears(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setFullYear(d.getFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

type DateRange = { startDate: string; endDate: string };

/**
 * Split a trip window into the part we can forecast ([today, today+7]) and the
 * part we must estimate from historical normals (beyond today+7). Either side is
 * null when empty; both null when the trip has no dates or is already over.
 */
export function splitWeatherWindow(
  start: string | undefined,
  end: string | undefined,
  today: string,
): { forecast: DateRange | null; historical: DateRange | null } {
  if (!start || !end || end < today) return { forecast: null, historical: null };
  const cutoff = addDays(today, FORECAST_TRUST_DAYS); // last forecast day
  const lo = start > today ? start : today;

  const forecast: DateRange | null =
    lo <= cutoff ? { startDate: lo, endDate: end < cutoff ? end : cutoff } : null;

  const histStart = addDays(cutoff, 1);
  const realHistStart = start > histStart ? start : histStart;
  const historical: DateRange | null =
    end >= realHistStart ? { startDate: realHistStart, endDate: end } : null;

  return { forecast, historical };
}

/** Average daily series element-wise across years (truncated to the shortest). */
export function averageDaily(perYear: DailyWeather[]): DailyWeather {
  if (perYear.length === 0) return { tMax: [], tMin: [], precip: [], wind: [] };
  const len = Math.min(...perYear.map((d) => d.tMax.length));
  const mean = (pick: (d: DailyWeather) => number[], i: number) =>
    perYear.reduce((a, d) => a + pick(d)[i], 0) / perYear.length;
  const series = (pick: (d: DailyWeather) => number[]) =>
    Array.from({ length: len }, (_, i) => mean(pick, i));
  return {
    tMax: series((d) => d.tMax),
    tMin: series((d) => d.tMin),
    precip: series((d) => d.precip),
    wind: series((d) => d.wind),
  };
}

function mergeDaily(parts: DailyWeather[]): DailyWeather {
  return {
    tMax: parts.flatMap((d) => d.tMax),
    tMin: parts.flatMap((d) => d.tMin),
    precip: parts.flatMap((d) => d.precip),
    wind: parts.flatMap((d) => d.wind),
  };
}

/**
 * Intersect a trip's [start, end] with Open-Meteo's forecast horizon
 * [today, today+16]. Returns the clamped range, or null if the trip dates are
 * missing or fall entirely outside the horizon.
 */
export function forecastRange(
  start: string | undefined,
  end: string | undefined,
  today: string,
): { startDate: string; endDate: string } | null {
  if (!start || !end) return null;
  const horizon = addDays(today, FORECAST_HORIZON_DAYS);
  const lo = start > today ? start : today;
  const hi = end < horizon ? end : horizon;
  if (hi < lo) return null;
  return { startDate: lo, endDate: hi };
}

// --- Open-Meteo client (network) ------------------------------------------

export interface GeoResult {
  name: string;
  lat: number;
  lon: number;
  countryCode?: string;
  country?: string;
  /** Region / state / province, when the API provides it. */
  admin1?: string;
}

interface RawGeo {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
  admin1?: string;
}

function toGeoResult(r: RawGeo): GeoResult {
  return {
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    countryCode: r.country_code,
    country: r.country,
    admin1: r.admin1,
  };
}

/** Human-readable place label, e.g. "Faro, Faro District, Portugal".
 *  Skips a region that merely repeats the name and any missing parts. */
export function placeLabel(r: Pick<GeoResult, 'name' | 'admin1' | 'country'>): string {
  return [r.name, r.admin1, r.country]
    .filter((v): v is string => Boolean(v))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
}

/** Reduce a stored destination label ("Lisbon, Lisboa, Portugal") to just the
 *  city, which is what the geocoder expects. */
export function geocodeQuery(label: string): string {
  return label.split(',')[0].trim();
}

/** Geocode a place name to coordinates via Open-Meteo's free geocoding API. */
export async function geocode(name: string): Promise<GeoResult | null> {
  const hits = await searchPlaces(geocodeQuery(name), 1);
  return hits[0] ?? null;
}

/** Search place names for autocomplete — returns ranked matches with region/country. */
export async function searchPlaces(
  name: string,
  count = 8,
  signal?: AbortSignal,
): Promise<GeoResult[]> {
  const q = name.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q,
  )}&count=${count}&language=en&format=json`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Place search failed (${res.status})`);
    const data = (await res.json()) as { results?: RawGeo[] };
    return (data.results ?? []).map(toGeoResult);
  } catch (e) {
    // A deliberate abort means a newer query is coming — don't mask it.
    if ((e as Error).name === 'AbortError') throw e;
    // Offline / file:// null origin: fall back to the bundled city list.
    return localSearchCities(q, count);
  }
}

const DAILY_VARS = 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max';

async function fetchDaily(baseUrl: string, lat: number, lon: number, range: DateRange) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: DAILY_VARS,
    timezone: 'auto',
    start_date: range.startDate,
    end_date: range.endDate,
  });
  const res = await fetch(`${baseUrl}?${params}`);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const data = (await res.json()) as {
    daily?: {
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      wind_speed_10m_max: number[];
    };
  };
  const day = data.daily;
  return {
    tMax: day?.temperature_2m_max ?? [],
    tMin: day?.temperature_2m_min ?? [],
    precip: day?.precipitation_sum ?? [],
    wind: day?.wind_speed_10m_max ?? [],
  };
}

/** Live forecast aggregates for a date window (≤16 days out). */
export function fetchForecastDaily(lat: number, lon: number, range: DateRange) {
  return fetchDaily('https://api.open-meteo.com/v1/forecast', lat, lon, range);
}

/** Historical "typical" weather: the same dates averaged over recent years. */
export async function fetchTypicalDaily(
  lat: number,
  lon: number,
  range: DateRange,
  years?: number[],
): Promise<DailyWeather> {
  const base = new Date(range.startDate + 'T00:00:00').getFullYear();
  const yrs = years ?? [base - 1, base - 2, base - 3];
  const perYear = await Promise.all(
    yrs.map((y) => {
      const delta = y - base;
      return fetchDaily('https://archive-api.open-meteo.com/v1/archive', lat, lon, {
        startDate: shiftDateYears(range.startDate, delta),
        endDate: shiftDateYears(range.endDate, delta),
      });
    }),
  );
  return averageDaily(perYear);
}

export interface DestinationWeather {
  place: GeoResult;
  tags: WeatherTagKey[];
  summary: WeatherSummary;
  basis: WeatherBasis;
}

/**
 * Weather for one destination: live forecast for the next {@link FORECAST_TRUST_DAYS}
 * days of the trip and historical normals beyond, merged. Uses stored coordinates
 * when present, else geocodes the city name. Returns null with no dates / no match.
 */
export async function lookupDestinationWeather(
  place: { label: string; lat?: number; lon?: number },
  start: string | undefined,
  end: string | undefined,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<DestinationWeather | null> {
  const { forecast, historical } = splitWeatherWindow(start, end, today);
  if (!forecast && !historical) return null;

  const geo: GeoResult | null =
    place.lat != null && place.lon != null
      ? { name: place.label, lat: place.lat, lon: place.lon }
      : await geocode(place.label);
  if (!geo) return null;

  // When a network leg fails (offline, or the file:// null origin the archive
  // API rejects), substitute bundled climate normals from the nearest city.
  const climate = nearestClimateCity(geo.lat, geo.lon);
  const parts: DailyWeather[] = [];
  let hasForecast = false;
  let hasTypical = false;

  if (forecast) {
    try {
      parts.push(await fetchForecastDaily(geo.lat, geo.lon, forecast));
      hasForecast = true;
    } catch {
      if (climate) {
        parts.push(climateDailyForRange(climate, forecast));
        hasTypical = true;
      }
    }
  }
  if (historical) {
    try {
      parts.push(await fetchTypicalDaily(geo.lat, geo.lon, historical));
      hasTypical = true;
    } catch {
      if (climate) {
        parts.push(climateDailyForRange(climate, historical));
        hasTypical = true;
      }
    }
  }

  if (parts.length === 0) return null;
  const daily = mergeDaily(parts);
  const basis: WeatherBasis = hasForecast && hasTypical ? 'mixed' : hasForecast ? 'forecast' : 'typical';
  return { place: geo, tags: deriveWeatherTags(daily), summary: summarizeWeather(daily), basis };
}

export interface TripWeatherResult {
  cities: DestinationWeather[];
  /** Union of weather tags across all destinations (pack for every climate). */
  tags: WeatherTagKey[];
}

/** Weather for up to `max` of a trip's destinations, with union tags. */
export async function lookupTripWeather(
  destinations: { label: string; lat?: number; lon?: number }[],
  start: string | undefined,
  end: string | undefined,
  today: string = new Date().toISOString().slice(0, 10),
  max = 5,
): Promise<TripWeatherResult> {
  const cities: DestinationWeather[] = [];
  for (const dest of destinations.slice(0, max)) {
    const r = await lookupDestinationWeather(dest, start, end, today);
    if (r) cities.push(r);
  }
  const tags = WEATHER_TAG_KEYS.filter((k) => cities.some((c) => c.tags.includes(k)));
  return { cities, tags };
}
