import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { listTrips, createTrip, cloneTrip, deleteTrip } from '../db/trips';
import { tripDurationDays } from '../types';

function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return 'No dates yet';
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your trips</h1>
        <button className="btn-primary" onClick={handleNew}>
          + New trip
        </button>
      </div>

      {trips === undefined ? (
        <p className="text-slate-500">Loading…</p>
      ) : trips.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span aria-hidden className="text-4xl">🧳</span>
          <p className="text-slate-600">No trips yet.</p>
          <button className="btn-primary" onClick={handleNew}>
            Create your first trip
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {trips.map((trip) => {
            const days = tripDurationDays(trip);
            const toPack = trip.items.filter((i) => i.status === 'pack').length;
            const packed = trip.items.filter((i) => i.status === 'pack' && i.packed).length;
            return (
              <li key={trip.id} className="card flex flex-col p-4">
                <Link to={`/trip/${trip.id}`} className="group flex-1">
                  <h2 className="font-semibold group-hover:text-brand-600">{trip.name}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {formatDateRange(trip.startDate, trip.endDate)}
                    {days ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {trip.items.length} item{trip.items.length === 1 ? '' : 's'}
                    {toPack > 0 ? ` · ${packed}/${toPack} packed` : ''}
                  </p>
                </Link>
                <div className="mt-3 flex gap-1 border-t border-slate-100 pt-2">
                  <Link to={`/trip/${trip.id}`} className="btn-ghost">
                    Open
                  </Link>
                  <button className="btn-ghost" onClick={() => handleClone(trip.id)}>
                    Clone
                  </button>
                  <button
                    className="btn-danger ml-auto"
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
