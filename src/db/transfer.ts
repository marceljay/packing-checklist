import {
  CATEGORIES,
  tagKey,
  legacyItemToRef,
  type Category,
  type Item,
  type LibraryItem,
  type Tag,
  type TagType,
  type Trip,
} from '../types';

/**
 * JSON import/export for trips (SPEC §1 — local-only portability/backup). Because
 * items are now references into the canonical library, an export bundles the
 * referenced library rows so the file stays self-contained. Pure functions:
 * serialize a trip + its library rows, and parse imported text back into a fresh
 * trip plus the library items it needs (the importer resolves them into the store).
 */

const EXPORT_KIND = 'packing-checklist/trip';
const EXPORT_VERSION = 2;

/** A library item as carried in an import. v2 exports carry the original `id`
 *  (identity is the id); legacy v1 exports have no id and are matched by name. */
export interface ImportedLibraryItem {
  id?: string;
  nameKey: string;
  name: string;
  category: Category;
  tagKeys: string[];
  custom: boolean;
  essential?: boolean;
  quantity?: LibraryItem['quantity'];
}

export interface ImportResult {
  /** A normalized trip whose `items[].libraryId` holds a placeholder — the source
   *  `id` (v2) or `nameKey` (legacy) — that the importer rewrites to a local id. */
  trip: Trip;
  libraryItems: ImportedLibraryItem[];
}

interface TripEnvelope {
  kind: typeof EXPORT_KIND;
  version: number;
  exportedAt: number;
  trip: Trip;
  library: LibraryItem[];
}

/** Serialize a trip together with the library rows its items reference. */
export function serializeTrip(trip: Trip, library: LibraryItem[]): string {
  const referenced = new Set(trip.items.map((i) => i.libraryId));
  const envelope: TripEnvelope = {
    kind: EXPORT_KIND,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    trip,
    library: library.filter((l) => referenced.has(l.id)),
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

function asCategory(v: unknown): Category {
  return CATEGORIES.includes(v as Category) ? (v as Category) : 'Comfort & Misc';
}

/**
 * Parse exported text (v2 envelope, legacy v1 envelope, or a bare trip) into a
 * fresh trip plus the library items it references. Trip/destination/context-tag
 * ids are regenerated; item references are keyed by `nameKey` for the importer to
 * resolve. Throws on invalid input.
 */
export function parseImport(text: string, genId: () => string, now: number): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }

  const envelope = data as Partial<TripEnvelope>;
  const raw = (envelope.trip ?? data) as Partial<Trip>;
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

  const libByKey = new Map<string, ImportedLibraryItem>();
  const items: Item[] = [];

  const bundledLibrary = Array.isArray(envelope.library) ? envelope.library : null;
  if (bundledLibrary) {
    // v2: items reference library rows by their stable id; preserve those ids so
    // identity carries across devices (importer dedups by id).
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
      });
    }
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
  } else {
    // Legacy v1 / bare: items carried name/category/tagIds — synthesize library
    // items from them and reference by nameKey.
    for (const legacy of raw.items as { name?: string; quantitySuggested?: unknown; quantityTaken?: unknown; packed?: unknown }[]) {
      const ref = legacyItemToRef(legacy as Parameters<typeof legacyItemToRef>[0], raw.tags as Tag[] ?? []);
      if (!ref.name) continue;
      if (!libByKey.has(ref.nameKey)) {
        libByKey.set(ref.nameKey, {
          nameKey: ref.nameKey,
          name: ref.name,
          category: ref.category,
          tagKeys: ref.tagKeys,
          custom: true,
        });
      }
      items.push({
        libraryId: ref.nameKey,
        quantitySuggested: typeof legacy.quantitySuggested === 'number' ? legacy.quantitySuggested : null,
        quantityTaken: typeof legacy.quantityTaken === 'number' ? legacy.quantityTaken : 1,
        packed: legacy.packed === true,
      });
    }
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

  return { trip, libraryItems: [...libByKey.values()] };
}
