import type { Trip, LibraryItem } from '../types';
import { resolveItems, resolvedByCategory, tripDurationDays, destinationCode } from '../types';

interface Props {
  trip: Trip;
  library: Map<string, LibraryItem>;
}

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
  const groups = resolvedByCategory(resolveItems(trip.items, library));
  const days = tripDurationDays(trip);
  const dateLine = [fmt(trip.startDate), fmt(trip.endDate)].join(' → ');

  return (
    <div className="hidden print:block">
      <header className="mb-6 border-b-2 border-ink pb-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[0.625rem] uppercase tracking-code text-ink-soft">
              Packing list
            </p>
            <h1 className="font-display text-2xl font-bold">{trip.name || 'Untitled trip'}</h1>
            <p className="mt-1 font-mono text-xs text-ink-soft">
              {dateLine}
              {days != null ? ` · ${days} night${days === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          <span className="code text-3xl">{destinationCode(trip)}</span>
        </div>
        {trip.tags.length > 0 && (
          <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-wide text-ink-soft">
            {trip.tags.map((t) => t.label).join(' · ')}
          </p>
        )}
        <p className="mt-2 flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
          <span aria-hidden className="inline-block h-3 w-3 border border-ink" /> pack
          <span className="ml-2">· number = suggested qty ·</span>
          <span aria-hidden className="inline-block h-3.5 w-5 border border-ink" /> your count
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="text-sm text-ink-soft">No items on this list yet.</p>
      ) : (
        <div className="columns-2 gap-8">
          {groups.map((g) => (
            <section key={g.category} className="mb-4 break-inside-avoid">
              <h2 className="mb-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-code text-ink">
                {g.category}
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
                    <span className={`min-w-0 flex-1 ${i.packed ? 'text-ink-soft line-through' : ''}`}>
                      {i.name}
                    </span>
                    {/* Suggested qty + a blank box for a hand-written adjustment. */}
                    <span className="flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums">
                      <span className="text-ink-soft">{i.quantityTaken}</span>
                      <span aria-hidden className="inline-block h-4 w-6 border border-ink" />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-6 border-t border-line pt-2 font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
        Packing Checklist · private · offline
      </footer>
    </div>
  );
}
