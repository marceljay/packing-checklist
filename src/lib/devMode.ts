import { useSyncExternalStore } from 'react';

/**
 * Developer-only preferences, persisted in localStorage and reactive (like the
 * theme/units). Dev mode reveals an in-app design switcher so the boarding-pass
 * "ticket" stock can be compared live; the chosen design persists too.
 */
export type TicketDesign = 'airblue' | 'kraft' | 'ink' | 'bone';

export const TICKET_DESIGNS: { value: TicketDesign; label: string }[] = [
  { value: 'airblue', label: 'Airblue' },
  { value: 'kraft', label: 'Kraft' },
  { value: 'ink', label: 'Ink' },
  { value: 'bone', label: 'Bone' },
];

/** Form-field background contrast against the card. 'a' = more contrast (the
 *  field lifts off the card; darker by day, lighter at night). 'b' = less
 *  contrast (the card colour just 3% darker — the default, the original mock). */
export type FieldStyle = 'a' | 'b';

export const FIELD_STYLES: { value: FieldStyle; label: string }[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

const DEV_KEY = 'packing-checklist-devmode';
const TICKET_KEY = 'packing-checklist-ticket';
const FIELD_KEY = 'packing-checklist-fieldstyle';

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
    return v === 'kraft' || v === 'ink' || v === 'bone' ? v : 'airblue';
  } catch {
    return 'airblue';
  }
}

function loadField(): FieldStyle {
  try {
    return localStorage.getItem(FIELD_KEY) === 'a' ? 'a' : 'b';
  } catch {
    return 'b';
  }
}

let devMode = loadDev();
let ticket: TicketDesign = loadTicket();
let fieldStyle: FieldStyle = loadField();
const listeners = new Set<() => void>();

/** The field style is a global CSS-var override, so it's a class on <html>
 *  (reaching portaled dialogs too), not a per-component className like the ticket.
 *  'b' (less contrast) is the default base, so only 'a' needs an override class. */
function applyFieldStyle(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('field-a', fieldStyle === 'a');
  }
}
applyFieldStyle();

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

export function getFieldStyle(): FieldStyle {
  return fieldStyle;
}

export function setFieldStyle(next: FieldStyle): void {
  fieldStyle = next;
  try {
    localStorage.setItem(FIELD_KEY, next);
  } catch {
    // storage unavailable — keep the in-memory choice
  }
  applyFieldStyle();
  emit();
}

/** Reactive read of the chosen form-field style. */
export function useFieldStyle(): FieldStyle {
  return useSyncExternalStore(subscribe, getFieldStyle, getFieldStyle);
}
