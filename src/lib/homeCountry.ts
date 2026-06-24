import { useSyncExternalStore } from 'react';

/**
 * The traveller's home country (ISO-3166 alpha-2, uppercase), used to advise on
 * plug adapters and voltage converters for international trips. A global,
 * localStorage-persisted preference (like units/theme), reactive via
 * {@link useHomeCountry}. Empty string = unset.
 */
const KEY = 'packing-checklist-home-country';

function load(): string {
  try {
    return (localStorage.getItem(KEY) ?? '').toUpperCase();
  } catch {
    return '';
  }
}

let home = load();
const listeners = new Set<() => void>();

export function getHomeCountry(): string {
  return home;
}

export function setHomeCountry(code: string): void {
  home = code.toUpperCase();
  try {
    localStorage.setItem(KEY, home);
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

/** Reactive read of the current home country (ISO-2, or '' if unset). */
export function useHomeCountry(): string {
  return useSyncExternalStore(subscribe, getHomeCountry, getHomeCountry);
}
