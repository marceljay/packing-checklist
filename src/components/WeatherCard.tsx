import { useEffect, useState } from 'react';
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

/** "5" when the daily peak is flat, "4–8" for a range. */
function fmtUv(min: number | undefined, max: number): string {
  return min === undefined || min === max ? `${max}` : `${min}–${max}`;
}

/** True below Tailwind's `sm` breakpoint (640px), tracked across resizes. */
function useIsMobile(): boolean {
  const query = '(max-width: 639px)';
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

// On phones a long (e.g. 30-day) breakdown is unwieldy: show a few days, then
// reveal more in chunks. Desktops show the whole series.
const MOBILE_INITIAL = 4;
const MOBILE_STEP = 7;

function fmtDay(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Expandable list of each day's high/low, precip and wind. On phones it starts
 *  at {@link MOBILE_INITIAL} days and reveals more in {@link MOBILE_STEP} chunks. */
function DayBreakdown({ days, units, onHide }: { days: CityDay[]; units: UnitSystem; onHide: () => void }) {
  const t = (celsius: number) => convTemp(celsius, units);
  const isMobile = useIsMobile();
  const [limit, setLimit] = useState(MOBILE_INITIAL);
  const shown = isMobile ? Math.min(limit, days.length) : days.length;
  const remaining = days.length - shown;
  return (
    <div className="mt-2 border-t border-ticket-ink/10 pt-2">
      <ul className="divide-y divide-ticket-ink/10">
        {days.slice(0, shown).map((d) => (
          <li
            key={d.date}
            className="flex flex-col gap-0.5 py-1.5 font-mono text-xs tabular-nums text-ticket-ink/80 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
          >
            {/* Line 1 on mobile: day + temps. On sm the wrappers dissolve
                (display:contents) so every span lays out in one row. */}
            <div className="flex items-baseline justify-between gap-3 sm:contents">
              <span className="font-bold text-ticket-ink/70 sm:w-24 sm:shrink-0">{fmtDay(d.date)}</span>
              <span className="flex gap-2 sm:flex-1">
                <span className="whitespace-nowrap">
                  <span className="text-ticket-ink/50">↑</span> {t(d.highC)}°
                </span>
                <span className="whitespace-nowrap">
                  <span className="text-ticket-ink/50">↓</span> {t(d.lowC)}°
                </span>
              </span>
            </div>
            {/* Line 2 on mobile: precip, wind, sun, UV. */}
            <div className="flex items-baseline gap-3 text-ticket-ink/60 sm:contents">
              <span className="whitespace-nowrap" title="Precipitation">💧 {formatPrecip(d.precipMm, units)}</span>
              <span className="whitespace-nowrap" title="Wind">💨 {formatWind(d.windKmh, units)}</span>
              {d.sunshineH !== undefined && (
                <span className="whitespace-nowrap sm:w-10 sm:text-right" title="Sunshine">
                  ☀ {d.sunshineH}h
                </span>
              )}
              {d.uvMax !== undefined && (
                <span className="whitespace-nowrap sm:w-12 sm:text-right" title="Peak UV index">
                  UV {d.uvMax}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-4 font-mono text-[0.625rem] uppercase tracking-code">
        {remaining > 0 && (
          <button
            className="text-ticket-ink/50 underline-offset-2 hover:text-ticket-ink hover:underline"
            onClick={() => setLimit((n) => n + MOBILE_STEP)}
          >
            Load more · {remaining} left
          </button>
        )}
        <button
          className="text-ticket-ink/50 underline-offset-2 hover:text-ticket-ink hover:underline"
          onClick={onHide}
        >
          Hide day by day
        </button>
      </div>
    </div>
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
        <span className="whitespace-nowrap text-ticket-ink/70" title="Precipitation">💧 {formatPrecip(c.precipMm, units)}</span>
        <span className="whitespace-nowrap text-ticket-ink/70" title="Wind">💨 {formatWind(c.windMaxKmh, units)}</span>
        {c.sunshineH !== undefined && (
          <span className="text-ticket-ink/70" title="Average sunshine per day">
            ☀ {c.sunshineH}h
          </span>
        )}
        {c.uvMax !== undefined && (
          <span className="text-ticket-ink/70" title="Daily-peak UV index range">
            UV {fmtUv(c.uvMin, c.uvMax)}
          </span>
        )}
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
      {hasDaily && open && (
        <DayBreakdown days={c.daily!} units={units} onHide={() => setOpen(false)} />
      )}
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
