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

/** Where a forecast came from: live forecast, historical typical, or a mix. */
export type WeatherBasis = 'forecast' | 'typical' | 'mixed';

/** Forecast summary for one destination (SPEC §6). Temps °C, precip mm. */
export interface CityForecast {
  place: string;
  basis: WeatherBasis;
  days: number;
  highC: number;
  lowC: number;
  maxC: number;
  minC: number;
  precipMm: number;
  windMaxKmh: number;
}

/** Cached weather for the trip's destinations, shown in the forecast card. */
export interface TripWeather {
  fetchedAt: number;
  cities: CityForecast[];
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
  /** Last weather lookup, cached so it shows after reload / offline. */
  weather?: TripWeather;
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
 * A custom item the user has added on past trips, stored in a global library
 * (not inside any one trip) so it resurfaces on future trips. The trip still
 * owns the per-trip instance (quantity, packed); the library owns the memory.
 */
export interface LibraryItem {
  /** Normalized name, used as the primary key and for de-duping. */
  nameKey: string;
  name: string;
  category: Category;
  /** Times added across all trips (drives ranking). */
  count: number;
  /** Epoch ms of the most recent add. */
  lastUsed: number;
  /** Normalized tag labels (via tagKey) accumulated across all uses. */
  tagKeys: string[];
  /** false = seeded built-in default; true = user-added or user-edited. */
  custom: boolean;
  /** Suggested on every trip regardless of tags (seeded from catalog `always`). */
  essential?: boolean;
  /** Smart-quantity rule (seeded from the catalog); absent → quantity 1. */
  quantity?: QuantityRule;
}

/**
 * Return a new library array where every item that carries `from` has it
 * replaced by `to`. Both keys are normalized via `tagKey`. If an item already
 * has `to`, the result is de-duplicated so no key appears twice. Input items
 * are never mutated.
 */
export function renameLibraryTag(items: LibraryItem[], from: string, to: string): LibraryItem[] {
  const fromKey = tagKey(from);
  const toKey = tagKey(to);
  return items.map((item) => {
    if (!item.tagKeys.includes(fromKey)) return item;
    const newKeys = [...new Set(item.tagKeys.map((k) => (k === fromKey ? toKey : k)))];
    return { ...item, tagKeys: newKeys };
  });
}

/**
 * Return a new library array where `key` (normalized via `tagKey`) has been
 * removed from every item's `tagKeys`. Input items are never mutated.
 */
export function removeLibraryTag(items: LibraryItem[], key: string): LibraryItem[] {
  const normalized = tagKey(key);
  return items.map((item) => {
    if (!item.tagKeys.includes(normalized)) return item;
    return { ...item, tagKeys: item.tagKeys.filter((k) => k !== normalized) };
  });
}

/** Group library items by tag key (each item appears under every tag it carries),
 *  named tags sorted; a trailing `{ tag: '' }` untagged group when any item has
 *  no tags. Used by the Item Library "by tag" view. */
export function libraryByTag(items: LibraryItem[]): { tag: string; items: LibraryItem[] }[] {
  const byTag = new Map<string, LibraryItem[]>();
  const untagged: LibraryItem[] = [];
  for (const item of items) {
    if (item.tagKeys.length === 0) {
      untagged.push(item);
      continue;
    }
    for (const key of item.tagKeys) {
      const list = byTag.get(key) ?? [];
      list.push(item);
      byTag.set(key, list);
    }
  }
  const groups = [...byTag.keys()].sort().map((tag) => ({ tag, items: byTag.get(tag)! }));
  if (untagged.length > 0) groups.push({ tag: '', items: untagged });
  return groups;
}

/** Filter library items by a free-text query, matching (case-insensitively) the
 *  item name, any of its tag keys, or its category. A blank query returns every
 *  item; input order is preserved. Used by the Item Library search box. */
export function searchLibrary(items: LibraryItem[], query: string): LibraryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      i.tagKeys.some((k) => k.includes(q)),
  );
}

/** Group items under their category in canonical {@link CATEGORIES} order,
 *  dropping empty categories. Used by the checklist and the print sheet. */
export function itemsByCategory(items: Item[]): { category: Category; items: Item[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);
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

/**
 * Given the trip's current tags and a list of normalized tag keys from a
 * library item, return the (possibly extended) tag list and the ids to attach
 * to the new item. Reuses existing tags by normalized label; creates new custom
 * tags for keys not yet on the trip.
 *
 * @param existingTags - The trip's current Tag list.
 * @param keys         - Normalized tag keys from the library item.
 * @param genId        - Factory for generating new tag ids (deterministic in tests).
 */
export function ensureTripTags(
  existingTags: Tag[],
  keys: string[],
  genId: () => string,
): { tags: Tag[]; tagIds: string[] } {
  const tags = [...existingTags];
  const tagIds: string[] = [];

  for (const key of [...new Set(keys)]) {
    const existing = tags.find((t) => tagKey(t.label) === key);
    if (existing) {
      tagIds.push(existing.id);
    } else {
      const newTag: Tag = { id: genId(), label: key, type: 'custom' };
      tags.push(newTag);
      tagIds.push(newTag.id);
    }
  }

  return { tags, tagIds };
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
