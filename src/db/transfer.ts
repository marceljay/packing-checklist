import {
  CATEGORIES,
  type Category,
  type Item,
  type Tag,
  type TagType,
  type Trip,
} from '../types';

/**
 * JSON import/export for trips (SPEC §1 — local-only portability/backup). Pure
 * functions: serialize a trip to text, and parse imported text back into a fresh
 * Trip with regenerated ids (so an import never collides with existing data).
 */

const EXPORT_KIND = 'packing-checklist/trip';
const EXPORT_VERSION = 1;

interface TripEnvelope {
  kind: typeof EXPORT_KIND;
  version: number;
  exportedAt: number;
  trip: Trip;
}

export function serializeTrip(trip: Trip): string {
  const envelope: TripEnvelope = {
    kind: EXPORT_KIND,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    trip,
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
 * Parse exported text (envelope or a bare trip) into a fresh, fully-normalized
 * Trip: new ids throughout, item→tag references rewired to the new tag ids
 * (unknown references dropped), and new timestamps. Throws on invalid input.
 */
export function parseTrip(text: string, genId: () => string, now: number): Trip {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }

  const raw = (data as { trip?: unknown }).trip ?? data;
  const t = raw as Partial<Trip>;
  if (!t || typeof t !== 'object' || typeof t.name !== 'string' || !Array.isArray(t.items)) {
    throw new Error('That file isn’t a packing-checklist trip.');
  }

  // Remap tag ids old -> new so item references can be rewired.
  const tagIdMap = new Map<string, string>();
  const tags: Tag[] = (t.tags ?? []).map((tag) => {
    const id = genId();
    tagIdMap.set(tag.id, id);
    return { id, label: asString(tag.label), type: asTagType(tag.type) };
  });

  const items: Item[] = t.items.map((item) => ({
    id: genId(),
    name: asString(item.name),
    category: asCategory(item.category),
    tagIds: (item.tagIds ?? [])
      .map((old) => tagIdMap.get(old))
      .filter((x): x is string => Boolean(x)),
    quantitySuggested:
      typeof item.quantitySuggested === 'number' ? item.quantitySuggested : null,
    quantityTaken: typeof item.quantityTaken === 'number' ? item.quantityTaken : 1,
    packed: item.packed === true,
    source: item.source === 'suggested' ? 'suggested' : 'custom',
    ...(item.catalogId ? { catalogId: item.catalogId } : {}),
    ...(item.notes ? { notes: item.notes } : {}),
  }));

  const destinations = (t.destinations ?? []).map((d) => ({
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

  return {
    id: genId(),
    name: t.name,
    startDate: asString(t.startDate) || undefined,
    endDate: asString(t.endDate) || undefined,
    destinations,
    tags,
    items,
    settings: { laundryAvailable: t.settings?.laundryAvailable === true },
    createdAt: now,
    updatedAt: now,
  };
}
