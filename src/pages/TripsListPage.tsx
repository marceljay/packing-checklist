import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppData } from '../db/store';
import { createTrip, cloneTrip, deleteTrip, pruneEmptyTrips } from '../db/trips';
import { useTicketDesign } from '../lib/devMode';
import { tripDurationDays, destinationCode } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

function formatDateRange(start: string | undefined, end: string | undefined, noDates: string): string {
  if (!start && !end) return noDates;
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
  const { t } = useTranslation();
  const data = useAppData();
  const design = useTicketDesign();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const trips = useMemo(() => [...data.trips].sort((a, b) => b.updatedAt - a.updatedAt), [data.trips]);

  // Drop "New trip" stubs the user created but never edited.
  useEffect(() => {
    pruneEmptyTrips();
  }, []);

  function handleNew() {
    navigate(`/trip/${createTrip()}`, { state: { isNew: true } });
  }

  function handleClone(id: string) {
    const newId = cloneTrip(id);
    if (newId) navigate(`/trip/${newId}`);
  }

  function confirmDelete() {
    if (pendingDelete) deleteTrip(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <div>
      {trips.length > 0 && (
        <div className="mb-5 flex items-center justify-end">
          <button className="btn-primary" onClick={handleNew}>
            {t('trips.newTrip')}
          </button>
        </div>
      )}

      {trips.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span aria-hidden className="airmail h-1 w-24 rounded-full" />
          <h2 className="font-display text-xl font-bold">{t('trips.noTripsTitle')}</h2>
          <p className="max-w-sm text-sm text-ink-soft">
            {t('trips.noTripsBody')}
          </p>
          <button className="btn-primary" onClick={handleNew}>
            {t('trips.startFirst')}
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
                <Link
                  to={`/trip/${trip.id}`}
                  className={`ticket-stock ticket--${design} flex flex-1 flex-col gap-4 p-4 pl-10`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-bold leading-tight group-hover:text-vermilion">
                        {trip.name}
                      </h2>
                      <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ticket-ink/70">
                        {formatDateRange(trip.startDate, trip.endDate, t('trips.noDates'))}
                        {days ? ` · ${days}d` : ''}
                      </p>
                    </div>
                    <span
                      className="code shrink-0 text-2xl leading-none"
                      title={primary?.label ?? trip.name}
                    >
                      {code}
                    </span>
                  </div>

                  {/* Packed meter — the load gauge */}
                  <div className="mt-auto">
                    <div className="mb-1 flex items-center justify-between font-mono text-[0.625rem] uppercase tracking-code text-ticket-ink/60">
                      <span>{t('trips.packed')}</span>
                      <span className="tabular-nums">
                        {packed}/{total || 0}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ticket-ink/20">
                      <div
                        className="h-full rounded-full bg-vermilion transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </Link>

                <div className="flex gap-1 border-t border-line px-3 py-2">
                  <Link
                    to={`/trip/${trip.id}`}
                    state={{ mode: 'plan' }}
                    className="btn-ghost px-2 py-1.5 text-xs"
                  >
                    {t('trips.plan')}
                  </Link>
                  <Link
                    to={`/trip/${trip.id}`}
                    state={{ mode: 'checklist' }}
                    className="btn-ghost px-2 py-1.5 text-xs"
                  >
                    {t('trips.checklist')}
                  </Link>
                  <button
                    className="btn-ghost ml-auto px-2 py-1.5 text-xs"
                    onClick={() => handleClone(trip.id)}
                  >
                    {t('trips.duplicate')}
                  </button>
                  <button
                    className="btn-danger px-2 py-1.5 text-xs"
                    onClick={() => setPendingDelete({ id: trip.id, name: trip.name })}
                  >
                    {t('trips.delete')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={t('trips.deleteTitle', { name: pendingDelete.name || t('trips.thisTrip') })}
          confirmLabel={t('trips.deleteConfirm')}
          tone="danger"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        >
          <p>{t('trips.deleteBody')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
