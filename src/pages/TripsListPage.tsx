import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { listTrips, createTrip, cloneTrip, deleteTrip } from '../db/trips';
import { tripDurationDays, destinationCode } from '../types';

function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return 'No dates set';
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt((start || end)!);
}

export default function TripsListPage() {
  const navigate = useNavigate();
  const trips = useLiveQuery(listTrips, [], undefined);

  async function handleNew() {
    const id = await createTrip();
    navigate(`/trip/${id}`);
  }

  async function handleClone(id: string) {
    const newId = await cloneTrip(id);
    if (newId) navigate(`/trip/${newId}`);
  }

  async function handleDelete(id: string, name: string) {
    if (confirm(`Delete "${name}"? This can't be undone.`)) {
      await deleteTrip(id);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-end">
        <button className="btn-primary" onClick={handleNew}>
          + New trip
        </button>
      </div>

      {trips === undefined ? (
        <p className="font-mono text-sm text-ink-faint">Loading…</p>
      ) : trips.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span aria-hidden className="airmail h-1 w-24 rounded-full" />
          <h2 className="font-display text-xl font-bold">No trips on the board</h2>
          <p className="max-w-sm text-sm text-ink-soft">
            Start a trip, set your dates and destination, then let the suggestions
            fill your packing list.
          </p>
          <button className="btn-primary" onClick={handleNew}>
            Start your first trip
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {trips.map((trip) => {
            const days = tripDurationDays(trip);
            const total = trip.items.length;
            const packed = trip.items.filter((i) => i.packed).length;
            const pct = total > 0 ? Math.round((packed / total) * 100) : 0;
            const code = destinationCode(trip);
            const primary = trip.destinations.find((d) => d.isPrimary) ?? trip.destinations[0];
            return (
              <li key={trip.id} className="card group relative flex flex-col overflow-hidden">
                {/* Eyelet — the luggage-tag punch hole */}
                <span
                  aria-hidden
                  className="absolute left-4 top-4 h-3 w-3 rounded-full border border-line bg-paper"
                />
                <Link to={`/trip/${trip.id}`} className="flex flex-1 flex-col gap-4 p-4 pl-10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-bold leading-tight group-hover:text-vermilion">
                        {trip.name}
                      </h2>
                      <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ink-soft">
                        {formatDateRange(trip.startDate, trip.endDate)}
                        {days ? ` · ${days}d` : ''}
                      </p>
                    </div>
                    <span
                      className="code shrink-0 text-2xl leading-none text-ink"
                      title={primary?.label ?? trip.name}
                    >
                      {code}
                    </span>
                  </div>

                  {/* Packed meter — the load gauge */}
                  <div className="mt-auto">
                    <div className="mb-1 flex items-center justify-between font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
                      <span>Packed</span>
                      <span className="tabular-nums">
                        {packed}/{total || 0}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunk">
                      <div
                        className="h-full rounded-full bg-vermilion transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </Link>

                <div className="flex gap-1 border-t border-line px-3 py-2">
                  <Link to={`/trip/${trip.id}`} className="btn-ghost px-2 py-1.5 text-xs">
                    Open
                  </Link>
                  <button
                    className="btn-ghost px-2 py-1.5 text-xs"
                    onClick={() => handleClone(trip.id)}
                  >
                    Duplicate
                  </button>
                  <button
                    className="btn-danger ml-auto px-2 py-1.5 text-xs"
                    onClick={() => handleDelete(trip.id, trip.name)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
