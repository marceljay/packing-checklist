import { useSyncExternalStore } from 'react';

/**
 * Developer-only preferences, persisted in localStorage and reactive (like the
 * theme/units). Dev mode reveals an in-app design switcher so the boarding-pass
 * "ticket" stock can be compared live; the chosen design persists too.
 */
export type TicketDesign = 'airblue' | 'kraft' | 'ink';

export const TICKET_DESIGNS: { value: TicketDesign; label: string }[] = [
  { value: 'airblue', label: 'Airblue' },
  { value: 'kraft', label: 'Kraft' },
  { value: 'ink', label: 'Ink' },
];

const DEV_KEY = 'packing-checklist-devmode';
const TICKET_KEY = 'packing-checklist-ticket';

function loadDev(): boolean {
  try {
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
}

function loadTicket(): TicketDesign {
  try {
    const v = localStorage.getItem(TICKET_KEY);
    return v === 'kraft' || v === 'ink' ? v : 'airblue';
  } catch {
    return 'airblue';
  }
}

let devMode = loadDev();
let ticket: TicketDesign = loadTicket();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDevMode(): boolean {
  return devMode;
}

export function setDevMode(next: boolean): void {
  devMode = next;
  try {
    localStorage.setItem(DEV_KEY, next ? '1' : '0');
  } catch {
    // storage unavailable — keep the in-memory choice
  }
  emit();
}

export function getTicketDesign(): TicketDesign {
  return ticket;
}

export function setTicketDesign(next: TicketDesign): void {
  ticket = next;
  try {
    localStorage.setItem(TICKET_KEY, next);
  } catch {
    // storage unavailable — keep the in-memory choice
  }
  emit();
}

/** Reactive read of whether dev mode is on. */
export function useDevMode(): boolean {
  return useSyncExternalStore(subscribe, getDevMode, getDevMode);
}

/** Reactive read of the chosen ticket design. */
export function useTicketDesign(): TicketDesign {
  return useSyncExternalStore(subscribe, getTicketDesign, getTicketDesign);
}
