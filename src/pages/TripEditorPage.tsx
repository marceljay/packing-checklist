import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useTripEditor } from './useTripEditor';
import { useAppData } from '../db/store';
import ContextPanel from '../components/ContextPanel';
import Checklist from '../components/Checklist';
import SuggestionsTray from '../components/SuggestionsTray';
import WeatherCard from '../components/WeatherCard';
import WeightSummary from '../components/WeightSummary';
import AddItemCard from '../components/AddItemCard';
import PrintMenu from '../components/PrintMenu';
import PrintSheet from '../components/PrintSheet';
import { useTicketDesign } from '../lib/devMode';
import { tripDurationDays, destinationCode, isInternationalTrip, orderedCategories } from '../types';
import type { Trip } from '../types';
import type { WeatherStatus } from '../engine/weatherSync';

type EditorMode = 'plan' | 'checklist';

// Shared styling for the four equal-width nav segments (back · Plan · Checklist · Print).
const SEG_BASE =
  'flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 font-mono text-xs uppercase tracking-wide transition-colors';
const SEG_IDLE = 'text-ink-soft hover:bg-paper-raised hover:text-ink';

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
  const design = useTicketDesign();
  const intl = isInternationalTrip(trip);

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
    <div className={`card overflow-hidden shadow-pass ticket-stock ticket--${design}`}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        {/* Route */}
        <div className="flex min-w-0 items-center gap-4">
          <span className="code text-5xl leading-none">{code}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="pass-trip-name"
                className="font-mono text-[0.625rem] uppercase tracking-code text-ticket-ink/50"
              >
                Packing list
              </label>
              {intl && (
                <span className="inline-flex items-center gap-0.5 rounded-sm border border-ticket-ink/40 px-1 font-mono text-[0.5625rem] font-bold uppercase tracking-code text-ticket-ink/75">
                  <span aria-hidden>✈</span> International
                </span>
              )}
            </div>
            <input
              id="pass-trip-name"
              ref={nameRef}
              value={trip.name}
              onChange={(e) => update((d) => void (d.name = e.target.value))}
              placeholder="Name this trip"
              aria-label="Trip name"
              className="w-full truncate rounded bg-transparent font-display text-xl font-bold leading-tight text-ticket-ink placeholder:text-ticket-ink/40 hover:bg-ticket-ink/5 focus:bg-ticket-ink/10 focus:outline-none"
            />
          </div>
        </div>

        {/* Perforated divider */}
        <div
          aria-hidden
          className="hidden border-l border-dashed border-ticket-ink/25 sm:block sm:self-stretch"
        />

        {/* Stats — boarding-pass field grid */}
        <div className="grid grid-cols-3 gap-4 sm:ml-auto">
          <Field label="Depart" value={formatDate(trip.startDate)} />
          <Field label="Return" value={formatDate(trip.endDate)} />
          <Field label="Nights" value={days != null ? String(days) : '—'} />
        </div>
      </div>

      {/* Packed gauge along the stub edge */}
      <div className="flex items-center gap-3 border-t border-ticket-ink/15 px-5 py-2.5">
        <span className="font-mono text-[0.625rem] uppercase tracking-code text-ticket-ink/50">
          Packed
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ticket-ink/15">
          <div
            className="h-full rounded-full bg-vermilion transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-xs tabular-nums text-ticket-ink/80">
          {packed}/{total || 0}
        </span>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] uppercase tracking-code text-ticket-ink/50">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function TripEditorPage() {
  const { tripId } = useParams();
  const location = useLocation();
  const navState = location.state as { isNew?: boolean; mode?: EditorMode } | null;
  const isNew = navState?.isNew === true;
  const { trip, status, update } = useTripEditor(tripId);
  // A trip card can open straight into "checklist"; otherwise default to "plan".
  const [mode, setMode] = useState<EditorMode>(navState?.mode ?? 'plan');
  // Lifted from ContextPanel so the WeatherCard can show a loading placeholder
  // the instant a destination is added (the lookup is async).
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>('idle');
  const [weatherMsg, setWeatherMsg] = useState('');

  // Print and "Save as PDF" are the same browser action — the print dialog is
  // where the PDF destination lives. Shared by the nav menu and the checklist footer.
  const printTrip = () => window.print();

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
  const categoryOptions = useMemo(
    () => orderedCategories(appData.library.map((i) => i.category)),
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
        {/* Unified nav bar: back · Plan/Checklist tabs · Print menu — equal segments. */}
        <div className="flex items-stretch rounded-lg border border-line bg-paper-sunk shadow-tag">
          <Link to="/" className={`${SEG_BASE} ${SEG_IDLE} rounded-l-lg`}>
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">All trips</span>
          </Link>

          <div role="tablist" aria-label="Editor mode" className="contents">
            {(['plan', 'checklist'] as EditorMode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className={`${SEG_BASE} border-l border-line ${
                  mode === m ? 'bg-ink text-paper-raised' : SEG_IDLE
                }`}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>

          <PrintMenu
            onPrint={printTrip}
            disabled={trip.items.length === 0}
            triggerClassName={`${SEG_BASE} border-l border-line rounded-r-lg ${
              trip.items.length === 0 ? 'cursor-not-allowed text-ink-faint' : SEG_IDLE
            }`}
          />
        </div>

        <PassHeader trip={trip} update={update} autoFocusName={isNew} />

        {mode === 'plan' ? (
          <>
            {/* Forecast sits right under the boarding-pass header so it's the first
                thing visible on mobile (above the longer details panel). */}
            {(trip.weather || weatherStatus === 'loading') && (
              <WeatherCard
                weather={trip.weather}
                loading={weatherStatus === 'loading'}
                destinations={trip.destinations}
              />
            )}
            <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <ContextPanel
                trip={trip}
                update={update}
                library={library}
                weatherStatus={weatherStatus}
                setWeatherStatus={setWeatherStatus}
                weatherMsg={weatherMsg}
                setWeatherMsg={setWeatherMsg}
              />
              <div className="flex min-w-0 flex-col gap-5">
                <WeightSummary items={trip.items} library={library} />
                <AddItemCard update={update} tagSuggestions={tagSuggestions} categories={categoryOptions} />
                <SuggestionsTray trip={trip} update={update} library={library} />
                <Checklist trip={trip} update={update} library={library} mode="plan" />
              </div>
            </div>
          </>
        ) : (
          <>
            <WeightSummary items={trip.items} library={library} />
            <Checklist trip={trip} update={update} library={library} mode="checklist" />
            {trip.items.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2">
                <button className="btn-secondary" onClick={printTrip}>
                  Print
                </button>
                <button className="btn-secondary" onClick={printTrip}>
                  Save as PDF
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <PrintSheet trip={trip} library={library} />
    </>
  );
}
