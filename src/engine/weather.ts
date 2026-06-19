/**
 * Weather → tag derivation (SPEC §6). Pure functions plus a thin Open-Meteo
 * client. The lookup is user-triggered and the only outbound request the app
 * makes; failures fall back to manual tags.
 */

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

// --- Date window -----------------------------------------------------------

const FORECAST_HORIZON_DAYS = 16;

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
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

/** Geocode a place name to coordinates via Open-Meteo's free geocoding API. */
export async function geocode(name: string): Promise<GeoResult | null> {
  const hits = await searchPlaces(name, 1);
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
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = (await res.json()) as { results?: RawGeo[] };
  return (data.results ?? []).map(toGeoResult);
}

/** Fetch daily forecast aggregates for a location and (optional) date window. */
export async function fetchDailyWeather(
  lat: number,
  lon: number,
  range: { startDate: string; endDate: string } | null,
): Promise<DailyWeather> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
    timezone: 'auto',
  });
  if (range) {
    params.set('start_date', range.startDate);
    params.set('end_date', range.endDate);
  } else {
    params.set('forecast_days', '7');
  }
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Forecast failed (${res.status})`);
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

export interface WeatherLookup {
  place: GeoResult;
  tags: WeatherTagKey[];
  /** True when the trip dates were used; false when we fell back to a 7-day peek. */
  datedWindow: boolean;
}

/**
 * End-to-end: geocode a destination, fetch its forecast for the trip window
 * (or a 7-day peek when dates are out of range), and derive weather tags.
 * Returns null when the place can't be found.
 */
export async function lookupWeatherTags(
  place: string,
  start: string | undefined,
  end: string | undefined,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<WeatherLookup | null> {
  const geo = await geocode(place);
  if (!geo) return null;
  const range = forecastRange(start, end, today);
  const daily = await fetchDailyWeather(geo.lat, geo.lon, range);
  return { place: geo, tags: deriveWeatherTags(daily), datedWindow: range != null };
}
