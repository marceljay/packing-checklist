import { Link, useParams } from 'react-router-dom';
import { useTripEditor } from './useTripEditor';
import ContextPanel from '../components/ContextPanel';
import Checklist from '../components/Checklist';
import SuggestionsTray from '../components/SuggestionsTray';
import LibraryTray from '../components/LibraryTray';
import WeatherCard from '../components/WeatherCard';
import PrintSheet from '../components/PrintSheet';
import { tripDurationDays, destinationCode } from '../types';
import type { Trip } from '../types';
import { serializeTrip } from '../db/transfer';
import { downloadText, slugify } from '../lib/file';

function formatDate(d?: string): string {
  if (!d) return '— — —';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  });
}

/** Boarding-pass stub: route code, dates, duration, packed gauge. */
function PassHeader({ trip }: { trip: Trip }) {
  const days = tripDurationDays(trip);
  const code = destinationCode(trip);
  const total = trip.items.length;
  const packed = trip.items.filter((i) => i.packed).length;
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;

  return (
    <div className="card overflow-hidden bg-ink text-paper-raised shadow-pass">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        {/* Route */}
        <div className="flex items-center gap-4">
          <span className="code text-5xl leading-none">{code}</span>
          <div className="min-w-0">
            <p className="font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
              Packing list
            </p>
            <h1 className="truncate font-display text-xl font-bold leading-tight">
              {trip.name || 'Untitled trip'}
            </h1>
          </div>
        </div>

        {/* Perforated divider */}
        <div
          aria-hidden
          className="hidden border-l border-dashed border-paper-raised/25 sm:block sm:self-stretch"
        />

        {/* Stats — boarding-pass field grid */}
        <div className="grid grid-cols-3 gap-4 sm:ml-auto">
          <Field label="Depart" value={formatDate(trip.startDate)} />
          <Field label="Return" value={formatDate(trip.endDate)} />
          <Field label="Nights" value={days != null ? String(days) : '—'} />
        </div>
      </div>

      {/* Packed gauge along the stub edge */}
      <div className="flex items-center gap-3 border-t border-paper-raised/15 px-5 py-2.5">
        <span className="font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
          Packed
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-raised/15">
          <div
            className="h-full rounded-full bg-vermilion transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-xs tabular-nums text-paper-raised/80">
          {packed}/{total || 0}
        </span>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function TripEditorPage() {
  const { tripId } = useParams();
  const { trip, status, update } = useTripEditor(tripId);

  if (status === 'loading') {
    return <p className="font-mono text-sm text-ink-faint">Loading…</p>;
  }

  if (status === 'not-found' || !trip) {
    return (
      <div className="card p-8 text-center">
        <p className="text-ink-soft">That trip isn't on the board.</p>
        <Link to="/" className="btn-secondary mt-4">
          Back to trips
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="btn-ghost -ml-3 px-3 py-1.5 text-xs">
            ← All trips
          </Link>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-xs"
              onClick={() => downloadText(`${slugify(trip.name)}.json`, serializeTrip(trip))}
            >
              Export
            </button>
            <button
              className="btn-secondary text-xs"
              onClick={() => window.print()}
              disabled={trip.items.length === 0}
              title={trip.items.length === 0 ? 'Add items first' : undefined}
            >
              Print / Save as PDF
            </button>
          </div>
        </div>

        <PassHeader trip={trip} />

        <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
          <ContextPanel trip={trip} update={update} />
          <div className="flex flex-col gap-5">
            {trip.weather && <WeatherCard weather={trip.weather} />}
            <SuggestionsTray trip={trip} update={update} />
            <LibraryTray trip={trip} update={update} />
            <Checklist trip={trip} update={update} />
          </div>
        </div>
      </div>

      <PrintSheet trip={trip} />
    </>
  );
}
