// Domain model for the packing checklist app.
// See SPEC.md §4. v1 = single packer, local-only, no bags/statuses.

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD'

/** Fixed categories used for grouping and print order (SPEC §4.5). */
export const CATEGORIES = [
  'Documents',
  'Clothing',
  'Footwear',
  'Toiletries & Health',
  'Electronics',
  'Gear & Equipment',
  'Money & Cards',
  'Comfort & Misc',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Typed tags drive suggestions and filtering (SPEC §4.4). */
export type TagType = 'activity' | 'weather' | 'destination' | 'custom';

export interface Tag {
  id: ID;
  label: string;
  type: TagType;
}

export interface Destination {
  id: ID;
  label: string;
  lat?: number;
  lon?: number;
  countryCode?: string;
  isPrimary: boolean;
}

export interface Item {
  id: ID;
  name: string;
  category: Category;
  tagIds: ID[];
  quantitySuggested: number | null;
  quantityTaken: number;
  packed: boolean;
  source: 'suggested' | 'custom';
  catalogId?: string; // origin in the built-in catalog, so we can de-dupe suggestions
  notes?: string;
}

export interface TripSettings {
  laundryAvailable: boolean;
}

export interface Trip {
  id: ID;
  name: string;
  startDate?: ISODate;
  endDate?: ISODate;
  destinations: Destination[];
  tags: Tag[];
  items: Item[];
  settings: TripSettings;
  createdAt: number;
  updatedAt: number;
}

/** Inclusive day count between start and end; null if dates missing. */
export function tripDurationDays(trip: Pick<Trip, 'startDate' | 'endDate'>): number | null {
  if (!trip.startDate || !trip.endDate) return null;
  const start = new Date(trip.startDate + 'T00:00:00');
  const end = new Date(trip.endDate + 'T00:00:00');
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * IATA-style 3-letter code for a trip, derived from its primary destination
 * (falls back to the trip name). Drives the luggage-tag / boarding-pass UI.
 */
export function destinationCode(trip: Pick<Trip, 'destinations' | 'name'>): string {
  const primary = trip.destinations.find((d) => d.isPrimary) ?? trip.destinations[0];
  const source = primary?.countryCode || primary?.label || trip.name || '';
  const letters = source.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.slice(0, 3) || 'TRP';
}

// ---------------------------------------------------------------------------
// Suggestion catalog (built-in, static) — SPEC §4.6 / §5
// ---------------------------------------------------------------------------

/** How a catalog item's suggested quantity is derived (SPEC §5.4). */
export type QuantityRule =
  | { kind: 'perDay'; factor: number; max: number; laundryCap?: number }
  | { kind: 'perTrip'; count: number }
  | { kind: 'bucket'; weekend: number; week: number; long: number }
  | { kind: 'none' };

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  /** Suggested on every trip regardless of tags (essentials). */
  always?: boolean;
  /** Tag keys (normalized labels) that surface this item, with ranking weight. */
  tagKeys: { key: string; weight: number }[];
  quantity: QuantityRule;
}

/** Normalize a tag label for matching against catalog keys. */
export function tagKey(label: string): string {
  return label.trim().toLowerCase();
}

/** Compute a suggested quantity from a rule, trip length and laundry setting. */
export function computeQuantity(
  rule: QuantityRule,
  days: number | null,
  laundryAvailable: boolean,
): number {
  const d = days ?? 7;
  switch (rule.kind) {
    case 'perDay': {
      let q = Math.min(Math.ceil(d * rule.factor), rule.max);
      if (laundryAvailable && rule.laundryCap != null) q = Math.min(q, rule.laundryCap);
      return Math.max(1, q);
    }
    case 'perTrip':
      return rule.count;
    case 'bucket':
      if (d <= 3) return rule.weekend;
      if (d <= 9) return rule.week;
      return rule.long;
    case 'none':
      return 1;
  }
}
