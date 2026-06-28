import {
  tagKey,
  type Category,
  type Item,
  type LibraryItem,
  type Tag,
  type TagMeta,
  type TagType,
  type Trip,
} from '../types';
import { cleanTagMeta } from './appData';

/**
 * JSON import/export for trips (SPEC §1 — local-only portability/backup). Because
 * items are now references into the canonical library, an export bundles the
 * referenced library rows so the file stays self-contained. Pure functions:
 * serialize a trip + its library rows, and parse imported text back into a fresh
 * trip plus the library items it needs (the importer resolves them into the store).
 */

const EXPORT_KIND = 'packing-checklist/trip';
const EXPORT_VERSION = 2;

const TRIPS_EXPORT_KIND = 'packing-checklist/trips';
const TRIPS_EXPORT_VERSION = 1;

/** A library item as carried in an import — identity is the stable `id`. */
export interface ImportedLibraryItem {
  id: string;
  nameKey: string;
  name: string;
  category: Category;
  tagKeys: string[];
  custom: boolean;
  essential?: boolean;
  quantity?: LibraryItem['quantity'];
  weight?: number;
}

export interface ImportResult {
  /** A normalized trip whose `items[].libraryId` holds the source library `id`
   *  that the importer rewrites to a local id. */
  trip: Trip;
  libraryItems: ImportedLibraryItem[];
  /** Tag registry entries the trip's items and selected tags reference. */
  tagMeta: TagMeta[];
}

interface TripEnvelope {
  kind: typeof EXPORT_KIND;
  version: number;
  exportedAt: number;
  trip: Trip;
  library: LibraryItem[];
  tagMeta: TagMeta[];
}

interface TripsEnvelope {
  kind: typeof TRIPS_EXPORT_KIND;
  version: number;
  exportedAt: number;
  trips: Trip[];
  library: LibraryItem[];
  tagMeta: TagMeta[];
}

/** The registry entries whose key a set of trips actually references — via the
 *  bundled library rows' tags and the trips' own selected tags. Keeps an export
 *  self-contained without dragging the whole registry along. */
function referencedTagMeta(trips: Trip[], library: LibraryItem[], tagMeta: TagMeta[]): TagMeta[] {
  const referencedIds = new Set(trips.flatMap((t) => t.items.map((i) => i.libraryId)));
  const keys = new Set<string>();
  for (const row of library) {
    if (referencedIds.has(row.id)) for (const k of row.tagKeys ?? []) keys.add(k);
  }
  for (const t of trips) for (const tag of t.tags) keys.add(tagKey(tag.label));
  return tagMeta.filter((m) => keys.has(m.key));
}

/** Serialize a trip together with the library rows its items reference and the
 *  registry entries those rows + the trip's selected tags use. */
export function serializeTrip(trip: Trip, library: LibraryItem[], tagMeta: TagMeta[] = []): string {
  const referenced = new Set(trip.items.map((i) => i.libraryId));
  const envelope: TripEnvelope = {
    kind: EXPORT_KIND,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    trip,
    library: library.filter((l) => referenced.has(l.id)),
    tagMeta: referencedTagMeta([trip], library, tagMeta),
  };
  return JSON.stringify(envelope, null, 2);
}

/** Serialize every trip plus the union of library rows they reference — a full,
 *  self-contained backup that {@link parseAllTrips} restores. */
export function serializeAllTrips(trips: Trip[], library: LibraryItem[], tagMeta: TagMeta[] = []): string {
  const referenced = new Set(trips.flatMap((t) => t.items.map((i) => i.libraryId)));
  const envelope: TripsEnvelope = {
    kind: TRIPS_EXPORT_KIND,
    version: TRIPS_EXPORT_VERSION,
    exportedAt: Date.now(),
    trips,
    library: library.filter((l) => referenced.has(l.id)),
    tagMeta: referencedTagMeta(trips, library, tagMeta),
  };
  return JSON.stringify(envelope, null, 2);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asTagType(v: unknown): TagType {
  return v === 'activity' || v === 'weather' || v === 'destination' || v === 'custom'
    ? v
    : 'custom';
}

// Preserve a custom category as-is; only an absent/blank one falls back.
function asCategory(v: unknown): Category {
  return asString(v).trim() || 'Comfort & Misc';
}

/**
 * Build a fresh trip + the library items it references from a raw trip object and
 * its bundled library. Trip/destination/context-tag ids are regenerated; item
 * references keep the source library `id` for the importer to resolve. Throws if
 * the raw object isn't a trip.
 */
function buildTrip(
  raw: Partial<Trip>,
  bundledLibrary: LibraryItem[],
  tagMeta: TagMeta[],
  genId: () => string,
  now: number,
): ImportResult {
  if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !Array.isArray(raw.items)) {
    throw new Error('That file isn’t a packing-checklist trip.');
  }

  const tags: Tag[] = (raw.tags ?? []).map((tag) => ({
    id: genId(),
    label: asString(tag.label),
    type: asTagType(tag.type),
  }));

  const destinations = (raw.destinations ?? []).map((d) => ({
    id: genId(),
    label: asString(d.label),
    isPrimary: d.isPrimary === true,
    ...(typeof d.lat === 'number' ? { lat: d.lat } : {}),
    ...(typeof d.lon === 'number' ? { lon: d.lon } : {}),
    ...(d.countryCode ? { countryCode: d.countryCode } : {}),
  }));
  if (destinations.length > 0 && !destinations.some((d) => d.isPrimary)) {
    destinations[0].isPrimary = true;
  }

  // Items reference library rows by their stable id; preserve those ids so
  // identity carries across devices (the importer dedups by id).
  const libByKey = new Map<string, ImportedLibraryItem>();
  const knownIds = new Set<string>();
  for (const row of bundledLibrary) {
    const id = asString(row.id);
    if (!id) continue;
    knownIds.add(id);
    libByKey.set(id, {
      id,
      nameKey: asString(row.nameKey) || tagKey(asString(row.name)),
      name: asString(row.name),
      category: asCategory(row.category),
      tagKeys: Array.isArray(row.tagKeys) ? row.tagKeys.map((k) => tagKey(String(k))) : [],
      custom: row.custom !== false,
      ...(row.essential ? { essential: true } : {}),
      ...(row.quantity ? { quantity: row.quantity } : {}),
      ...(typeof row.weight === 'number' ? { weight: row.weight } : {}),
    });
  }
  const items: Item[] = [];
  for (const it of raw.items as { libraryId?: unknown; quantitySuggested?: unknown; quantityTaken?: unknown; packed?: unknown }[]) {
    const id = asString(it.libraryId);
    if (!knownIds.has(id)) continue;
    items.push({
      libraryId: id,
      quantitySuggested: typeof it.quantitySuggested === 'number' ? it.quantitySuggested : null,
      quantityTaken: typeof it.quantityTaken === 'number' ? it.quantityTaken : 1,
      packed: it.packed === true,
    });
  }

  const trip: Trip = {
    id: genId(),
    name: raw.name,
    startDate: asString(raw.startDate) || undefined,
    endDate: asString(raw.endDate) || undefined,
    destinations,
    tags,
    items,
    settings: { laundryAvailable: raw.settings?.laundryAvailable === true },
    createdAt: now,
    updatedAt: now,
  };

  return { trip, libraryItems: [...libByKey.values()], tagMeta };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
}

/**
 * Parse an exported trip file (the v2 envelope from {@link serializeTrip}) into a
 * fresh trip plus the library items it references. Throws on invalid input.
 */
export function parseImport(text: string, genId: () => string, now: number): ImportResult {
  const data = parseJson(text);
  const envelope = data as Partial<TripEnvelope>;
  if (!envelope || typeof envelope !== 'object' || !envelope.trip || !Array.isArray(envelope.library)) {
    throw new Error('That file isn’t a packing-checklist trip export.');
  }
  return buildTrip(envelope.trip, envelope.library, cleanTagMeta(envelope.tagMeta), genId, now);
}

/**
 * Parse a full-backup file ({@link serializeAllTrips}) into one {@link ImportResult}
 * per trip. The bundled library is shared across all trips. Throws on invalid input.
 */
export function parseAllTrips(text: string, genId: () => string, now: number): ImportResult[] {
  const data = parseJson(text);
  const envelope = data as Partial<TripsEnvelope>;
  if (!envelope || !Array.isArray(envelope.trips)) {
    throw new Error('That file isn’t a packing-checklist trips backup.');
  }
  const bundled = Array.isArray(envelope.library) ? envelope.library : [];
  const tagMeta = cleanTagMeta(envelope.tagMeta);
  return envelope.trips.map((raw) => buildTrip(raw as Partial<Trip>, bundled, tagMeta, genId, now));
}
