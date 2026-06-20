import type { CityForecast, TripWeather, WeatherBasis } from '../types';

interface Props {
  weather: TripWeather;
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

function CityRow({ c }: { c: CityForecast }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 sm:w-40">
        <p className="truncate font-display font-bold">{c.place}</p>
        <p className="font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
          {BASIS_LABEL[c.basis]} · {c.days}d
        </p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
        <span>
          <span className="text-paper-raised/50">↑</span> {c.highC}°{' '}
          <span className="text-paper-raised/50">↓</span> {c.lowC}°
        </span>
        <span className="text-paper-raised/70">
          {c.minC}–{c.maxC}°
        </span>
        <span className="text-paper-raised/70">{c.precipMm} mm</span>
        <span className="text-paper-raised/70">{c.windMaxKmh} km/h</span>
      </div>
    </div>
  );
}

/** Cached forecast for each of the trip's destinations. */
export default function WeatherCard({ weather: w }: Props) {
  if (w.cities.length === 0) return null;
  return (
    <section className="card overflow-hidden bg-ink text-paper-raised shadow-pass">
      <div className="flex items-center gap-2.5 border-b border-paper-raised/15 px-5 py-3">
        <span aria-hidden>☀</span>
        <h2 className="font-display text-base font-bold">Forecast</h2>
        <span className="ml-auto font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
          Updated {relativeTime(w.fetchedAt)}
        </span>
      </div>

      <div className="divide-y divide-paper-raised/10">
        {w.cities.map((c) => (
          <CityRow key={c.place} c={c} />
        ))}
      </div>
    </section>
  );
}
