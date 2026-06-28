import { useState } from 'react';
import type { CityDay, CityForecast, Destination, TripWeather, WeatherBasis } from '../types';
import { cityMatchesDestination } from '../engine/weatherSync';
import { shortPlace } from '../engine/weather';
import { useTicketDesign } from '../lib/devMode';
import {
  useUnits,
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

function fmtDay(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Expandable list of each day's high/low, precip and wind. */
function DayBreakdown({ days, units }: { days: CityDay[]; units: UnitSystem }) {
  const t = (celsius: number) => convTemp(celsius, units);
  return (
    <ul className="mt-2 space-y-1 border-t border-ticket-ink/10 pt-2">
      {days.map((d) => (
        <li
          key={d.date}
          className="flex items-baseline justify-between gap-3 font-mono text-xs tabular-nums text-ticket-ink/80"
        >
          <span className="w-24 shrink-0 text-ticket-ink/60">{fmtDay(d.date)}</span>
          <span className="flex-1">
            <span className="text-ticket-ink/50">↑</span> {t(d.highC)}°{' '}
            <span className="text-ticket-ink/50">↓</span> {t(d.lowC)}°
          </span>
          <span className="text-ticket-ink/60">{formatPrecip(d.precipMm, units)}</span>
          <span className="text-ticket-ink/60">{formatWind(d.windKmh, units)}</span>
        </li>
      ))}
    </ul>
  );
}

function CityRow({ c, units }: { c: CityForecast; units: UnitSystem }) {
  const t = (celsius: number) => convTemp(celsius, units);
  const [open, setOpen] = useState(false);
  const hasDaily = (c.daily?.length ?? 0) > 0;
  return (
    <div className="px-5 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 sm:w-40">
        <p className="truncate font-display font-bold" title={c.place}>{shortPlace(c.place)}</p>
        <p className="font-mono text-[0.625rem] uppercase tracking-code text-ticket-ink/50">
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
          <span className="text-ticket-ink/50">↑</span> {t(c.highC)}°{' '}
          <span className="text-ticket-ink/50">↓</span> {t(c.lowC)}°
        </span>
        <span className="text-ticket-ink/70">
          {t(c.minC)}–{t(c.maxC)}°
        </span>
        <span className="text-ticket-ink/70">{formatPrecip(c.precipMm, units)}</span>
        <span className="text-ticket-ink/70">{formatWind(c.windMaxKmh, units)}</span>
        {hasDaily && (
          <button
            className="font-mono text-[0.625rem] uppercase tracking-code text-ticket-ink/50 underline-offset-2 hover:text-ticket-ink hover:underline sm:ml-auto"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide days' : 'Day by day'}
          </button>
        )}
      </div>
      </div>
      {hasDaily && open && <DayBreakdown days={c.daily!} units={units} />}
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
        <p className="truncate font-display font-bold text-ticket-ink/70">{label}</p>
        <p className="font-mono text-[0.625rem] uppercase tracking-code text-ticket-ink/40">
          Loading…
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="h-3 w-16 rounded bg-ticket-ink/15" />
        <span className="h-3 w-12 rounded bg-ticket-ink/15" />
        <span className="h-3 w-10 rounded bg-ticket-ink/15" />
        <span className="h-3 w-10 rounded bg-ticket-ink/15" />
      </div>
    </div>
  );
}

/** Cached forecast for each of the trip's destinations. While a lookup is in
 *  flight the card appears immediately with skeleton rows for any destination
 *  that doesn't have data yet, so adding a place gives instant feedback. */
export default function WeatherCard({ weather: w, loading = false, destinations }: Props) {
  const units = useUnits();
  const design = useTicketDesign();
  const cities = w?.cities ?? [];
  // Destinations still awaiting data — shown as skeletons during a lookup.
  const pending = loading
    ? destinations.filter((d) => !cities.some((c) => cityMatchesDestination(c, d)))
    : [];
  if (cities.length === 0 && pending.length === 0) return null;
  return (
    <section className={`card overflow-hidden shadow-pass ticket-stock ticket--${design}`}>
      <div className="flex items-center gap-2.5 border-b border-ticket-ink/15 px-5 py-3">
        <span aria-hidden>☀</span>
        <h2 className="font-display text-base font-bold">Forecast</h2>
        <span className="ml-auto font-mono text-[0.625rem] uppercase tracking-code text-ticket-ink/50">
          {loading ? 'Updating…' : w ? `Updated ${relativeTime(w.fetchedAt)}` : ''}
        </span>
      </div>

      <div className="divide-y divide-ticket-ink/10">
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
