import { useSyncExternalStore } from 'react';

/**
 * Display units for weather. Values are always stored in metric (°C, mm, km/h);
 * these helpers convert/format at render time. The preference is global (like the
 * theme), persisted in localStorage, and reactive via {@link useUnits}.
 */
export type UnitSystem = 'metric' | 'imperial';

const KEY = 'packing-checklist-units';

function load(): UnitSystem {
  try {
    return localStorage.getItem(KEY) === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

let system: UnitSystem = load();
const listeners = new Set<() => void>();

export function getUnits(): UnitSystem {
  return system;
}

export function setUnits(next: UnitSystem): void {
  system = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // storage unavailable — keep the in-memory choice
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reactive read of the current unit system. */
export function useUnits(): UnitSystem {
  return useSyncExternalStore(subscribe, getUnits, getUnits);
}

// --- conversions / formatting (inputs are metric) --------------------------

/** Temperature in the chosen system, rounded (no degree symbol). */
export function convTemp(celsius: number, sys: UnitSystem): number {
  return Math.round(sys === 'imperial' ? celsius * (9 / 5) + 32 : celsius);
}

/** Precipitation formatted with its unit (mm, or inches to 1 decimal). */
export function formatPrecip(mm: number, sys: UnitSystem): string {
  return sys === 'imperial' ? `${(mm / 25.4).toFixed(1)} in` : `${Math.round(mm)} mm`;
}

/** Wind speed formatted with its unit (km/h, or mph). */
export function formatWind(kmh: number, sys: UnitSystem): string {
  return sys === 'imperial' ? `${Math.round(kmh / 1.609344)} mph` : `${Math.round(kmh)} km/h`;
}

const GRAMS_PER_LB = 453.59237;

/** Weight in the chosen system: kilograms (metric) or pounds (imperial). */
export function convWeight(grams: number, sys: UnitSystem): number {
  return sys === 'imperial' ? grams / GRAMS_PER_LB : grams / 1000;
}

/** Weight formatted with its unit. Sub-unit totals keep one decimal; whole
 *  units round to integers so a typical bag reads "12 kg", not "12.0 kg". */
export function formatWeight(grams: number, sys: UnitSystem): string {
  const v = convWeight(grams, sys);
  const unit = sys === 'imperial' ? 'lb' : 'kg';
  const text = v < 10 ? v.toFixed(1) : String(Math.round(v));
  return `${text} ${unit}`;
}
