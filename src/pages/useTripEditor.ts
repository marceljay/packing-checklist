import { useCallback, useEffect, useState } from 'react';
import { getTrip, saveTrip } from '../db/trips';
import type { Trip } from '../types';

type Status = 'loading' | 'ready' | 'not-found';

/**
 * Loads a trip once into local state and persists every mutation immediately.
 * We deliberately don't use a live query here so in-flight edits aren't clobbered
 * by re-renders; the trips list elsewhere does use a live query.
 */
export function useTripEditor(tripId: string | undefined) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    if (!tripId) {
      setStatus('not-found');
      return;
    }
    setStatus('loading');
    getTrip(tripId).then((t) => {
      if (cancelled) return;
      if (!t) {
        setStatus('not-found');
        return;
      }
      setTrip(t);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  /** Apply an immutable mutation to the trip and persist it. */
  const update = useCallback((mutator: (draft: Trip) => void) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev) as Trip;
      mutator(next);
      void saveTrip(next);
      return next;
    });
  }, []);

  return { trip, status, update };
}
