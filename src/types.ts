// Domain model for the packing checklist app.
// See SPEC.md §4. v1 = single packer, local-only, no bags/statuses.

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD'

/** Built-in categories used for grouping and print order (SPEC §4.5). These come
 *  first in every grouped view; imported items may carry their own categories,
 *  which appear after these (see {@link orderedCategories}). */
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
/** A category is open-ended: any of the built-ins, or a custom string carried in
 *  from an import. The literal union keeps autocomplete for the built-ins. */
export type Category = (typeof CATEGORIES)[number] | (string & NonNullable<unknown>);

/** Whether a category string is one of the built-in {@link CATEGORIES}. */
export function isBuiltinCategory(c: string): boolean {
  return (CATEGORIES as readonly string[]).includes(c);
}

/** The categories to render, in order: the built-in {@link CATEGORIES} first (in
 *  canonical order), then any other categories present in `used`, de-duplicated in
 *  first-seen order. Drives every category-grouped view and the category pickers. */
export function orderedCategories(used: Iterable<string>): Category[] {
  const extras: string[] = [];
  const seen = new Set<string>();
  for (const c of used) {
    if (!c || seen.has(c) || isBuiltinCategory(c)) continue;
    seen.add(c);
    extras.push(c);
  }
  return [...CATEGORIES, ...extras];
}

/** Typed tags drive suggestions and filtering (SPEC §4.4). */
export type TagType = 'activity' | 'weather' | 'destination' | 'custom';

export interface Tag {
  id: ID;
  label: string;
  type: TagType;
}

/** Editable grouping for a tag in the registry (drives the trip-page quick-add
 *  palettes). 'other' covers everything that isn't an activity or weather tag. */
export type TagGroup = 'activity' | 'weather' | 'other';

/** Per-tag metadata, stored once globally (keyed by normalized `key`). Seeded
 *  from {@link BUILTIN_TAGS} and editable via the Item Library tag editor. */
export interface TagMeta {
  key: string;
  group: TagGroup;
  /** Show this tag as a quick-add chip on the trip page. */
  default: boolean;
}

/**
 * Pick the trip-page quick-add tags from the registry: every tag already on the
 * trip is excluded; the rest split into the always-shown `visible` set and a
 * `rest` set behind a "more" toggle. `visible` starts with the `default` tags and,
 * if that's under `floor` (default 20), fills up with non-defaults; any leftover
 * non-defaults go to `rest`. Registry order is preserved within each set. Pure.
 */
export function selectQuickAddTags(
  meta: TagMeta[],
  activeKeys: Iterable<string>,
  floor = 20,
): { visible: TagMeta[]; rest: TagMeta[] } {
  const active = new Set(activeKeys);
  const available = meta.filter((m) => !active.has(m.key));
  const defaults = available.filter((m) => m.default);
  const others = available.filter((m) => !m.default);
  const fill = Math.max(0, floor - defaults.length);
  return { visible: [...defaults, ...others.slice(0, fill)], rest: others.slice(fill) };
}

export interface Destination {
  id: ID;
  label: string;
  lat?: number;
  lon?: number;
  countryCode?: string;
  isPrimary: boolean;
}

/**
 * A trip's packing-list line. The item itself (name, category, tags) lives in the
 * canonical {@link LibraryItem} store; the trip only holds a reference plus the
 * per-trip state (quantity, packed). Display fields are joined in via
 * {@link resolveItems}. At most one reference per `libraryId` on a trip.
 */
export interface Item {
  /** -> {@link LibraryItem.id}. */
  libraryId: ID;
  quantitySuggested: number | null;
  quantityTaken: number;
  packed: boolean;
}

/** A trip {@link Item} joined with its {@link LibraryItem} for rendering/grouping. */
export interface ResolvedItem {
  libraryId: ID;
  name: string;
  category: Category;
  tagKeys: string[];
  quantitySuggested: number | null;
  quantityTaken: number;
  packed: boolean;
  /** Whether the library row is flagged essential (suggested on every trip). */
  essential: boolean;
  /** Free-text note / longer description carried from the library row. */
  notes?: string;
  /** Per-unit weight in grams carried from the library row (absent → unset). */
  weight?: number;
  /** true when the referenced library row no longer exists. */
  missing: boolean;
}

export interface TripSettings {
  laundryAvailable: boolean;
  /** User override for whether the trip is international (crosses a border).
   *  Undefined → inferred from destinations (see {@link isInternationalTrip}). */
  international?: boolean;
}

/** Where a forecast came from: live forecast, historical typical, or a mix. */
export type WeatherBasis = 'forecast' | 'typical' | 'mixed';

/** One day of a destination's forecast (rounded, °C / mm / km/h). */
export interface CityDay {
  date: string;
  highC: number;
  lowC: number;
  precipMm: number;
  windKmh: number;
  /** Sunshine hours this day, when available (absent offline). */
  sunshineH?: number;
  /** Peak UV index this day, when available (forecast only). */
  uvMax?: number;
}

/** Forecast summary for one destination (SPEC §6). Temps °C, precip mm. */
export interface CityForecast {
  place: string;
  basis: WeatherBasis;
  /** Per-day breakdown when a dated daily series was available. */
  daily?: CityDay[];
  /** Set when this city's data came from bundled offline climate normals. */
  offline?: boolean;
  /** Nearest bundled climate city the offline normals came from. */
  approxFrom?: string;
  /** Weather tag keys this city contributed (e.g. ['cold','rainy']). Lets a
   *  destination's tags be recomputed locally when another is removed. */
  tags?: string[];
  days: number;
  highC: number;
  lowC: number;
  maxC: number;
  minC: number;
  precipMm: number;
  windAvgKmh: number;
  /** Average sunshine hours per day over the window, when available. */
  sunshineH?: number;
  /** Lowest daily-peak UV over the window, when available (forecast only). */
  uvMin?: number;
  /** Highest daily-peak UV over the window, when available (forecast only). */
  uvMax?: number;
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

/**
 * True when a trip looks freshly-created and untouched — a blank/`Untitled` name,
 * no dates, destinations, items or tags, and default settings. Used to prune trips
 * the user created and abandoned without editing.
 */
export function isEmptyTrip(trip: Trip): boolean {
  const name = trip.name.trim();
  return (
    (name === '' || name === 'Untitled trip') &&
    !trip.startDate &&
    !trip.endDate &&
    trip.destinations.length === 0 &&
    trip.items.length === 0 &&
    trip.tags.length === 0 &&
    !trip.settings.laundryAvailable &&
    !trip.weather
  );
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
  /** Stable identity. Defaults: `d:<catalogId>` (deterministic, see
   *  {@link defaultId}); customs: `c:<random>` (see {@link customId}). Trips
   *  reference this; it survives renames. */
  id: ID;
  /** Normalized name, the Dexie primary key and the de-dupe handle. */
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
  /** Restrict a seeded essential to international or domestic trips (e.g. visa
   *  check vs domestic ID). Absent → every trip. Ignored unless `essential`. */
  essentialWhen?: TripScope;
  /** Smart-quantity rule (seeded from the catalog); absent → quantity 1. */
  quantity?: QuantityRule;
  /** Optional free-text note / longer description, shown in the item's info card. */
  notes?: string;
  /** Per-unit weight in grams (seeded from the catalog; editable). Absent → unset
   *  (counts as 0 in the trip total). */
  weight?: number;
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

/**
 * Deterministic id for a built-in (default) library item, derived from its catalog
 * id (a unique slug). The same on every install, so importing a foreign library
 * never duplicates the built-ins. Self-describing: a `d:`-prefixed id is a default.
 */
export function defaultId(catalogId: string): string {
  return `d:${catalogId}`;
}

const ID62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Collision-resistant id for a user (custom) library item: `c:` + base62 of 16
 * random bytes (~128 bits). Not derived from the name, so two same-named items
 * (e.g. surf gloves vs snow gloves) are distinct and merging independent libraries
 * won't clash. `rand` is injectable for deterministic tests.
 */
export function customId(rand: (n: number) => Uint8Array = randomBytes): string {
  let n = 0n;
  for (const b of rand(16)) n = (n << 8n) | BigInt(b);
  let s = '';
  while (n > 0n) {
    s = ID62[Number(n % 62n)] + s;
    n /= 62n;
  }
  return `c:${s || '0'}`;
}

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

/** Join trip item references with their library rows for rendering. A reference
 *  whose row is gone resolves to a `missing` placeholder rather than dropping. */
export function resolveItems(items: Item[], libById: Map<ID, LibraryItem>): ResolvedItem[] {
  return items.map((it) => {
    const lib = libById.get(it.libraryId);
    return {
      libraryId: it.libraryId,
      name: lib?.name ?? '(removed item)',
      category: lib?.category ?? 'Comfort & Misc',
      tagKeys: lib?.tagKeys ?? [],
      quantitySuggested: it.quantitySuggested,
      quantityTaken: it.quantityTaken,
      packed: it.packed,
      essential: lib?.essential === true,
      notes: lib?.notes,
      weight: lib?.weight,
      missing: lib === undefined,
    };
  });
}

/** Group resolved items by category — built-in {@link CATEGORIES} first in
 *  canonical order, then any custom categories the items carry — dropping empty
 *  ones. Used by the checklist and the print sheet. */
export function resolvedByCategory(
  items: ResolvedItem[],
): { category: Category; items: ResolvedItem[] }[] {
  return orderedCategories(items.map((i) => i.category))
    .map((category) => ({
      category,
      items: items.filter((i) => i.category === category),
    }))
    .filter((g) => g.items.length > 0);
}

/** Sentinel group key for essentials in {@link resolvedByTag} — not a real tag,
 *  so it can't collide with a user tag key (which is lowercased/trimmed text). */
export const ESSENTIAL_GROUP_KEY = '__essential';

/**
 * Group resolved items by tag for the packing list. Essentials are a first-class
 * group ({@link ESSENTIAL_GROUP_KEY}) shown first — an essential appears there as
 * well as under any real tags it carries. Then named tags, sorted. The trailing
 * untagged `{ tag: '' }` group holds only items that are neither tagged nor
 * essential (so a tag-less essential lands under Essential, not Untagged).
 */
export function resolvedByTag(items: ResolvedItem[]): { tag: string; items: ResolvedItem[] }[] {
  const byTag = new Map<string, ResolvedItem[]>();
  const essential: ResolvedItem[] = [];
  const untagged: ResolvedItem[] = [];
  for (const item of items) {
    if (item.essential) essential.push(item);
    if (item.tagKeys.length > 0) {
      for (const key of item.tagKeys) {
        const list = byTag.get(key) ?? [];
        list.push(item);
        byTag.set(key, list);
      }
    } else if (!item.essential) {
      untagged.push(item);
    }
  }
  const groups: { tag: string; items: ResolvedItem[] }[] = [];
  if (essential.length > 0) groups.push({ tag: ESSENTIAL_GROUP_KEY, items: essential });
  for (const tag of [...byTag.keys()].sort()) groups.push({ tag, items: byTag.get(tag)! });
  if (untagged.length > 0) groups.push({ tag: '', items: untagged });
  return groups;
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

/** Distinct ISO country codes across a trip's destinations (uppercased). */
export function tripCountryCodes(trip: Pick<Trip, 'destinations'>): string[] {
  return [
    ...new Set(
      trip.destinations
        .map((d) => d.countryCode?.toUpperCase())
        .filter((c): c is string => Boolean(c)),
    ),
  ];
}

/**
 * Whether a trip is international. The user's explicit `settings.international`
 * wins; otherwise it's inferred — destinations spanning 2+ countries cross a
 * border, so they're international. A single (or no) detected country is
 * ambiguous (we don't know the traveller's home country), so it defaults to
 * domestic and the user can tick the override.
 */
export function isInternationalTrip(trip: Pick<Trip, 'destinations' | 'settings'>): boolean {
  if (trip.settings.international !== undefined) return trip.settings.international;
  return tripCountryCodes(trip).length >= 2;
}

/**
 * Trip items whose library row carries any of `tagKeys` (normalized). Used when a
 * weather tag drops (e.g. "cold" after removing the only cold destination) to
 * offer removing the items that tag pulled in. Items missing from the library are
 * skipped.
 */
export function tripItemsWithAnyTag(
  items: Item[],
  library: Map<string, LibraryItem>,
  tagKeys: string[],
): { libraryId: string; name: string }[] {
  const keys = new Set(tagKeys.map(tagKey));
  if (keys.size === 0) return [];
  const out: { libraryId: string; name: string }[] = [];
  for (const it of items) {
    const row = library.get(it.libraryId);
    if (row && (row.tagKeys ?? []).some((k) => keys.has(k))) {
      out.push({ libraryId: it.libraryId, name: row.name });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Suggestion catalog (built-in, static) — SPEC §4.6 / §5
// ---------------------------------------------------------------------------

/** How a catalog item's suggested quantity is derived (SPEC §5.4). */
export type QuantityRule =
  | { kind: 'perDay'; factor: number; max: number }
  | { kind: 'perTrip'; count: number }
  | { kind: 'bucket'; weekend: number; week: number; long: number }
  | { kind: 'none' };

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  /** Suggested on every trip regardless of tags (essentials). */
  always?: boolean;
  /** Restrict an essential to international or domestic trips (e.g. visa check vs
   *  domestic ID). Absent → applies to every trip. Ignored unless `always`. */
  essentialWhen?: TripScope;
  /** Tag keys (normalized labels) that surface this item, with ranking weight. */
  tagKeys: { key: string; weight: number }[];
  quantity: QuantityRule;
  /** Per-unit weight in grams (the built-in default; editable once seeded). */
  weightG?: number;
}

/** Whether a conditional essential applies to international or domestic trips. */
export type TripScope = 'international' | 'domestic';

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

/** Assumed laundry rhythm: wash about weekly, plus a small buffer for the items
 *  in the wash. With laundry you only need one cycle's worth, not the whole trip. */
const LAUNDRY_CYCLE_DAYS = 7;
const LAUNDRY_BUFFER = 1;

/**
 * Compute a suggested quantity from a rule, trip length and laundry setting.
 * For per-day items the no-laundry amount tracks the trip length (one-per-day
 * style, up to the rule's `max`). With laundry you re-wash on a ~weekly cycle, so
 * you only pack one cycle's worth (plus a spare), independent of trip length — a
 * 28-day trip needs ~8 of a daily item, not 28, since laundry runs ~4 times.
 */
export function computeQuantity(
  rule: QuantityRule,
  days: number | null,
  laundryAvailable: boolean,
): number {
  const d = days ?? 7;
  switch (rule.kind) {
    case 'perDay': {
      const base = Math.min(Math.ceil(d * rule.factor), rule.max);
      // Laundry: cap at one wash cycle's worth (never more than the trip needs).
      const cycle = Math.ceil(rule.factor * LAUNDRY_CYCLE_DAYS) + LAUNDRY_BUFFER;
      const q = laundryAvailable ? Math.min(base, cycle) : base;
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

// ---------------------------------------------------------------------------
// Packing weight (SPEC: weight calculator)
// ---------------------------------------------------------------------------

/** Editable light/medium thresholds (kg) for the carry scale. */
export interface WeightThresholds {
  lightMaxKg: number;
  mediumMaxKg: number;
}

export type WeightBandKey = 'light' | 'medium' | 'heavy';

export interface WeightBand {
  key: WeightBandKey;
  label: string;
  /** Carry advice / suggested luggage for this band. */
  advice: string;
}

/** Total packed weight in grams: each trip item's taken quantity times its
 *  library weight (an unset weight counts as 0). */
export function tripWeightGrams(items: Item[], libById: Map<ID, LibraryItem>): number {
  let g = 0;
  for (const it of items) {
    const w = libById.get(it.libraryId)?.weight;
    if (typeof w === 'number') g += w * it.quantityTaken;
  }
  return g;
}

/** Classify a gram total against the (kg) thresholds into a carry band + advice. */
export function weightBand(grams: number, t: WeightThresholds): WeightBand {
  const kg = grams / 1000;
  if (kg <= t.lightMaxKg) {
    return { key: 'light', label: 'Light', advice: 'Easy carry — a backpack works.' };
  }
  if (kg <= t.mediumMaxKg) {
    return { key: 'medium', label: 'Medium', advice: 'Use a wheeled suitcase.' };
  }
  return {
    key: 'heavy',
    label: 'Heavy',
    advice: 'Split the load or avoid long walks; check airline limits.',
  };
}
