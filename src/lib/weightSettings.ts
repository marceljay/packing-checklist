import { useSyncExternalStore } from 'react';
import type { WeightThresholds } from '../types';

/**
 * Editable carry-scale thresholds (kg): the upper bound of the "light" band and
 * of the "medium" band. A global, localStorage-persisted preference (like
 * units/home-country), reactive via {@link useWeightThresholds}. Clamped so the
 * light bound stays below the medium bound.
 */
const KEY = 'packing-checklist-weight-thresholds';

export const DEFAULT_THRESHOLDS: WeightThresholds = { lightMaxKg: 10, mediumMaxKg: 20 };

/** Keep thresholds sane: positive, and light strictly below medium. */
function clamp(t: WeightThresholds): WeightThresholds {
  const light = Math.max(0.1, t.lightMaxKg);
  const medium = Math.max(light + 0.1, t.mediumMaxKg);
  return { lightMaxKg: light, mediumMaxKg: medium };
}

function load(): WeightThresholds {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (raw && typeof raw.lightMaxKg === 'number' && typeof raw.mediumMaxKg === 'number') {
      return clamp(raw);
    }
  } catch {
    // ignore
  }
  return DEFAULT_THRESHOLDS;
}

let thresholds = load();
const listeners = new Set<() => void>();

export function getWeightThresholds(): WeightThresholds {
  return thresholds;
}

export function setWeightThresholds(next: WeightThresholds): void {
  thresholds = clamp(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(thresholds));
  } catch {
    // storage unavailable -- keep the in-memory choice
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWeightThresholds(): WeightThresholds {
  return useSyncExternalStore(subscribe, getWeightThresholds, getWeightThresholds);
}
