import type { CityForecast, Destination, TripWeather, WeatherBasis } from '../types';
import { cityMatchesDestination } from '../engine/weatherSync';
import {
  useUnits,
  setUnits,
  convTemp,
  formatPrecip,
  formatWind,
  type UnitSystem,
} from '../lib/units';

interface Props {
  weather?: TripWeather;
  /** A forecast lookup is in flight — show "Updating…" and skeleton rows for any
   *  destination that doesn't have data yet. */
  loading?: boolean;
  /** Current destinations, so a just-added place gets a placeholder row. */
  destinations: Destination[];
}

const BASIS_LABEL: Record<WeatherBasis, string> = {
  forecast: 'Forecast',
  typical: 'Typical',
  mixed: 'Forecast + typical',
};

function relativeTime(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function CityRow({ c, units }: { c: CityForecast; units: UnitSystem }) {
  const t = (celsius: number) => convTemp(celsius, units);
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 sm:w-40">
        <p className="truncate font-display font-bold">{c.place}</p>
        <p className="font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
          {BASIS_LABEL[c.basis]} · {c.days}d
          {c.offline && (
            <span className="text-vermilion">
              {' · offline'}
              {c.approxFrom ? ` ≈ ${c.approxFrom}` : ''}
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
        <span>
          <span className="text-paper-raised/50">↑</span> {t(c.highC)}°{' '}
          <span className="text-paper-raised/50">↓</span> {t(c.lowC)}°
        </span>
        <span className="text-paper-raised/70">
          {t(c.minC)}–{t(c.maxC)}°
        </span>
        <span className="text-paper-raised/70">{formatPrecip(c.precipMm, units)}</span>
        <span className="text-paper-raised/70">{formatWind(c.windMaxKmh, units)}</span>
      </div>
    </div>
  );
}

/** Placeholder row for a destination whose forecast is still loading. */
function SkeletonRow({ label }: { label: string }) {
  return (
    <div
      className="flex animate-pulse flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4"
      aria-hidden
    >
      <div className="min-w-0 sm:w-40">
        <p className="truncate font-display font-bold text-paper-raised/70">{label}</p>
        <p className="font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/40">
          Loading…
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="h-3 w-16 rounded bg-paper-raised/15" />
        <span className="h-3 w-12 rounded bg-paper-raised/15" />
        <span className="h-3 w-10 rounded bg-paper-raised/15" />
        <span className="h-3 w-10 rounded bg-paper-raised/15" />
      </div>
    </div>
  );
}

/** Compact °C/°F segmented toggle (switches the whole metric/imperial system). */
function UnitToggle({ units }: { units: UnitSystem }) {
  return (
    <div className="flex overflow-hidden rounded-full border border-paper-raised/25 font-mono text-[0.625rem] uppercase tracking-wide">
      {(['metric', 'imperial'] as UnitSystem[]).map((sys) => (
        <button
          key={sys}
          aria-pressed={units === sys}
          onClick={() => setUnits(sys)}
          className={`px-2 py-0.5 transition-colors ${
            units === sys
              ? 'bg-paper-raised text-ink'
              : 'text-paper-raised/60 hover:text-paper-raised'
          }`}
        >
          {sys === 'metric' ? '°C' : '°F'}
        </button>
      ))}
    </div>
  );
}

/** Cached forecast for each of the trip's destinations. While a lookup is in
 *  flight the card appears immediately with skeleton rows for any destination
 *  that doesn't have data yet, so adding a place gives instant feedback. */
export default function WeatherCard({ weather: w, loading = false, destinations }: Props) {
  const units = useUnits();
  const cities = w?.cities ?? [];
  // Destinations still awaiting data — shown as skeletons during a lookup.
  const pending = loading
    ? destinations.filter((d) => !cities.some((c) => cityMatchesDestination(c, d)))
    : [];
  if (cities.length === 0 && pending.length === 0) return null;
  return (
    <section className="card overflow-hidden bg-ink text-paper-raised shadow-pass">
      <div className="flex items-center gap-2.5 border-b border-paper-raised/15 px-5 py-3">
        <span aria-hidden>☀</span>
        <h2 className="font-display text-base font-bold">Forecast</h2>
        <span className="ml-auto font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
          {loading ? 'Updating…' : w ? `Updated ${relativeTime(w.fetchedAt)}` : ''}
        </span>
        <UnitToggle units={units} />
      </div>

      <div className="divide-y divide-paper-raised/10">
        {cities.map((c) => (
          <CityRow key={c.place} c={c} units={units} />
        ))}
        {pending.map((d) => (
          <SkeletonRow key={d.id} label={d.label.split(',')[0]} />
        ))}
      </div>
    </section>
  );
}
