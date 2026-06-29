import { useTranslation } from 'react-i18next';
import { useLabels } from '../i18n/labels';
import type { Trip, LibraryItem, CityForecast, WeatherBasis, WeightBandKey } from '../types';
import {
  resolveItems,
  resolvedByCategory,
  tripDurationDays,
  destinationCode,
  tripWeightGrams,
  weightBand,
} from '../types';
import { useUnits, convTemp, formatPrecip, formatWind, formatWeight } from '../lib/units';
import { useWeightThresholds } from '../lib/weightSettings';

interface Props {
  trip: Trip;
  library: Map<string, LibraryItem>;
}

const BASIS_KEY: Record<WeatherBasis, string> = {
  forecast: 'weather.basisForecast',
  typical: 'weather.basisTypical',
  mixed: 'weather.basisMixed',
};

const BAND_KEY: Record<WeightBandKey, string> = {
  light: 'weight.light',
  medium: 'weight.medium',
  heavy: 'weight.heavy',
};

function fmt(d?: string): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Print-only packing list. Hidden on screen (`hidden print:block`); the rest of
 * the editor is hidden in print, so `window.print()` — and "Save as PDF" in any
 * browser's print dialog — outputs just this clean, hand-checkable sheet.
 */
export default function PrintSheet({ trip, library }: Props) {
  const { t } = useTranslation();
  const { tTag, tCategory } = useLabels();
  const units = useUnits();
  const groups = resolvedByCategory(resolveItems(trip.items, library));
  const days = tripDurationDays(trip);
  const dateLine = [fmt(trip.startDate), fmt(trip.endDate)].join(' → ');
  const cities = trip.weather?.cities ?? [];
  const temp = (celsius: number) => convTemp(celsius, units);
  const thresholds = useWeightThresholds();
  const grams = tripWeightGrams(trip.items, library);
  const band = weightBand(grams, thresholds);

  return (
    <div className="hidden print:block">
      <header className="mb-6 border-b-2 border-ink pb-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[0.625rem] uppercase tracking-code text-ink-soft">
              {t('pass.packingList')}
            </p>
            <h1 className="font-display text-2xl font-bold">{trip.name || t('print.untitled')}</h1>
            <p className="mt-1 font-mono text-xs text-ink-soft">
              {dateLine}
              {days != null ? ` · ${t('context.nights', { count: days })}` : ''}
            </p>
          </div>
          <span className="code text-3xl">{destinationCode(trip)}</span>
        </div>
        {trip.tags.length > 0 && (
          <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-wide text-ink-soft">
            {trip.tags.map((tag) => tTag(tag.label)).join(' · ')}
          </p>
        )}
      </header>

      {grams > 0 && (
        <section className="mb-5 break-inside-avoid">
          <h2 className="mb-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-code text-ink">
            {t('print.load')}
          </h2>
          <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="font-display text-base font-bold tabular-nums">{formatWeight(grams, units)}</span>
            <span className="font-mono text-[0.625rem] uppercase tracking-wide text-ink-soft">{t(BAND_KEY[band.key])}</span>
            <span className="text-ink-soft">{t(`weight.advice${band.key.charAt(0).toUpperCase()}${band.key.slice(1)}`)}</span>
          </p>
        </section>
      )}

      {cities.length > 0 && (
        <section className="mb-5 break-inside-avoid">
          <h2 className="mb-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-code text-ink">
            {t('weather.title')}
          </h2>
          <ul className="space-y-1">
            {cities.map((c: CityForecast) => (
              <li
                key={c.place}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm"
              >
                <span className="font-display font-bold">{c.place}</span>
                <span className="font-mono text-[0.625rem] uppercase tracking-wide text-ink-soft">
                  {t(BASIS_KEY[c.basis])} · {c.days}d
                  {c.offline && ` · ${t('weather.offline')}${c.approxFrom ? ` ≈ ${c.approxFrom}` : ''}`}
                </span>
                <span className="font-mono tabular-nums text-ink-soft">
                  ↑ {temp(c.highC)}° ↓ {temp(c.lowC)}° · {temp(c.minC)}–{temp(c.maxC)}° ·{' '}
                  {formatPrecip(c.precipMm, units)} · {formatWind(c.windAvgKmh, units)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-ink-soft">{t('print.noItems')}</p>
      ) : (
        <div className="columns-2 gap-8">
          {groups.map((g) => (
            <section key={g.category} className="mb-4 break-inside-avoid">
              <h2 className="mb-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-code text-ink">
                {tCategory(g.category)}
              </h2>
              <ul className="space-y-1">
                {g.items.map((i) => (
                  <li key={i.libraryId} className="flex items-baseline gap-2 text-sm">
                    <span
                      aria-hidden
                      className={`mt-0.5 inline-block h-3 w-3 shrink-0 border border-ink ${
                        i.packed ? 'bg-ink' : ''
                      }`}
                    />
                    <span className={i.packed ? 'text-ink-soft line-through' : ''}>
                      {i.quantityTaken > 1 && (
                        <span className="font-mono font-bold">{i.quantityTaken}× </span>
                      )}
                      {i.name}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-6 border-t border-line pt-2 font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
        {t('print.footer')}
      </footer>
    </div>
  );
}
