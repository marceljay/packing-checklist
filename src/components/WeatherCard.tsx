import type { TripWeather } from '../types';

interface Props {
  weather: TripWeather;
}

function relativeTime(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** Cached forecast summary for the trip's primary destination. */
export default function WeatherCard({ weather: w }: Props) {
  return (
    <section className="card overflow-hidden bg-ink text-paper-raised shadow-pass">
      <div className="flex items-center gap-2.5 border-b border-paper-raised/15 px-5 py-3">
        <span aria-hidden>☀</span>
        <h2 className="font-display text-base font-bold">Forecast</h2>
        <span className="truncate font-mono text-xs text-paper-raised/60">{w.place}</span>
        <span className="ml-auto shrink-0 font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
          {w.days} day{w.days === 1 ? '' : 's'} · {w.datedWindow ? 'trip dates' : 'next 7'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
        <Stat label="Avg high" value={`${w.highC}°`} />
        <Stat label="Avg low" value={`${w.lowC}°`} />
        <Stat label="Range" value={`${w.minC}–${w.maxC}°`} />
        <Stat label="Rain" value={`${w.precipMm} mm`} />
      </div>

      <div className="flex items-center justify-between border-t border-paper-raised/15 px-5 py-2 font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
        <span>Wind to {w.windMaxKmh} km/h</span>
        <span>Updated {relativeTime(w.fetchedAt)}</span>
      </div>
    </section>
  );
}
