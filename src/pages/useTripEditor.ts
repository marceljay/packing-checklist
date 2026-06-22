import { useCallback } from 'react';
import { setData, useAppData } from '../db/store';
import type { Trip } from '../types';

type Status = 'loading' | 'ready' | 'not-found';

/**
 * Read a trip from the JSON store and mutate it in place. The store is
 * synchronous and reactive (useAppData), so there's no load-once/clobber concern
 * as there was with the live query — every mutation persists immediately.
 */
export function useTripEditor(tripId: string | undefined) {
  const data = useAppData();
  const trip = tripId ? data.trips.find((t) => t.id === tripId) ?? null : null;
  const status: Status = !tripId ? 'not-found' : trip ? 'ready' : 'not-found';

  /** Apply an immutable mutation to this trip and persist it. */
  const update = useCallback(
    (mutator: (draft: Trip) => void) => {
      if (!tripId) return;
      setData((d) => {
        const target = d.trips.find((t) => t.id === tripId);
        if (!target) return;
        mutator(target);
        target.updatedAt = Date.now();
      });
    },
    [tripId],
  );

  return { trip, status, update };
}
