// Domain model for the packing checklist app.
// See SPEC.md §4. v1 = single packer, local-only.

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

/** A line item's packing status (SPEC §4.2). Only 'pack' counts toward bags. */
export const ITEM_STATUSES = ['pack', 'rent', 'buy-there', 'have-there'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  pack: 'Pack',
  rent: 'Rent there',
  'buy-there': 'Buy there',
  'have-there': 'Have there',
};

/** Typed tags drive suggestions (later phases) and filtering (SPEC §4.4). */
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

export type BagType = 'carry-on' | 'checked' | 'daypack' | 'personal' | 'custom';

export interface Bag {
  id: ID;
  name: string;
  type: BagType;
  notes?: string;
}

export interface Item {
  id: ID;
  name: string;
  category: Category;
  tagIds: ID[];
  status: ItemStatus;
  quantitySuggested: number | null;
  quantityTaken: number;
  packed: boolean;
  bagId?: ID; // only meaningful when status === 'pack'
  source: 'suggested' | 'custom';
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
  bags: Bag[];
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
