import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useTripEditor } from './useTripEditor';
import { useAppData } from '../db/store';
import ContextPanel from '../components/ContextPanel';
import Checklist from '../components/Checklist';
import SuggestionsTray from '../components/SuggestionsTray';
import WeatherCard from '../components/WeatherCard';
import AddItemCard from '../components/AddItemCard';
import PrintSheet from '../components/PrintSheet';
import { tripDurationDays, destinationCode } from '../types';
import type { Trip } from '../types';
import type { WeatherStatus } from '../engine/weatherSync';

type EditorMode = 'plan' | 'checklist';

function formatDate(d?: string): string {
  if (!d) return '— — —';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  });
}

/** Boarding-pass stub: route code, editable name, dates, duration, packed gauge. */
function PassHeader({
  trip,
  update,
  autoFocusName,
}: {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
  autoFocusName?: boolean;
}) {
  const days = tripDurationDays(trip);
  const code = destinationCode(trip);
  const total = trip.items.length;
  const packed = trip.items.filter((i) => i.packed).length;
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;

  // On a freshly created trip, focus the name and select the placeholder text so
  // the user can type straight over it.
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocusName) {
      nameRef.current?.focus();
      nameRef.current?.select();
    }
  }, [autoFocusName]);

  return (
    <div className="card overflow-hidden bg-ink text-paper-raised shadow-pass">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        {/* Route */}
        <div className="flex min-w-0 items-center gap-4">
          <span className="code text-5xl leading-none">{code}</span>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="pass-trip-name"
              className="font-mono text-[0.625rem] uppercase tracking-code text-paper-raised/50"
            >
              Packing list
            </label>
            <input
              id="pass-trip-name"
              ref={nameRef}
              value={trip.name}
              onChange={(e) => update((d) => void (d.name = e.target.value))}
              placeholder="Name this trip"
              aria-label="Trip name"
              className="w-full truncate rounded bg-transparent font-display text-xl font-bold leading-tight text-paper-raised placeholder:text-paper-raised/40 hover:bg-paper-raised/5 focus:bg-paper-raised/10 focus:outline-none"
            />
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
  const location = useLocation();
  const isNew = (location.state as { isNew?: boolean } | null)?.isNew === true;
  const { trip, status, update } = useTripEditor(tripId);
  const [mode, setMode] = useState<EditorMode>('plan');
  // Lifted from ContextPanel so the WeatherCard can show a loading placeholder
  // the instant a destination is added (the lookup is async).
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('idle');
  const [weatherMsg, setWeatherMsg] = useState('');

  // Library is the source of truth for item display fields; join live so edits
  // (here or on the Item Library page) reflect immediately.
  const appData = useAppData();
  const library = useMemo(
    () => new Map(appData.library.map((i) => [i.id, i])),
    [appData.library],
  );
  const tagSuggestions = useMemo(
    () => [...new Set(appData.library.flatMap((i) => i.tagKeys ?? []))].sort(),
    [appData.library],
  );

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
        {/* Top bar: back link + tab switcher + actions */}
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="btn-ghost -ml-3 px-3 py-1.5 text-xs">
            ← All trips
          </Link>

          {/* Segmented tab control */}
          <div
            className="flex items-center gap-1 rounded bg-paper-sunk p-0.5"
            role="tablist"
            aria-label="Editor mode"
          >
            {(['plan', 'checklist'] as EditorMode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className={`rounded px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-wide transition-colors ${
                  mode === m
                    ? 'bg-ink text-paper-raised'
                    : 'text-ink-faint hover:bg-paper-sunk hover:text-ink'
                }`}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            className="btn-secondary text-xs"
            onClick={() => window.print()}
            disabled={trip.items.length === 0}
            title={trip.items.length === 0 ? 'Add items first' : undefined}
          >
            Print / Save as PDF
          </button>
        </div>

        <PassHeader trip={trip} update={update} autoFocusName={isNew} />

        {mode === 'plan' ? (
          <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
            <ContextPanel
              trip={trip}
              update={update}
              library={library}
              weatherStatus={weatherStatus}
              setWeatherStatus={setWeatherStatus}
              weatherMsg={weatherMsg}
              setWeatherMsg={setWeatherMsg}
            />
            <div className="flex flex-col gap-5">
              {(trip.weather || weatherStatus === 'loading') && (
                <WeatherCard
                  weather={trip.weather}
                  loading={weatherStatus === 'loading'}
                  destinations={trip.destinations}
                />
              )}
              <AddItemCard update={update} tagSuggestions={tagSuggestions} />
              <SuggestionsTray trip={trip} update={update} library={library} />
              <Checklist trip={trip} update={update} library={library} mode="plan" />
            </div>
          </div>
        ) : (
          <Checklist trip={trip} update={update} library={library} mode="checklist" />
        )}
      </div>

      <PrintSheet trip={trip} library={library} />
    </>
  );
}
