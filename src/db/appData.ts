import type { Trip, LibraryItem, TagGroup, TagMeta } from '../types';

/**
 * The whole app state as one JSON document (persisted in localStorage by
 * `store.ts`). On load, `normalizeAppData()` coerces a parsed object into a valid
 * document in memory; there is no versioned schema-upgrade machinery.
 */
export interface AppData {
  schemaVersion: number;
  trips: Trip[];
  library: LibraryItem[];
  /** Ids of built-in defaults the user removed or edited (forked). The boot-time
   *  seeder skips these so deletes/edits survive reloads; "Restore defaults"
   *  clears the list. Absent on pre-existing docs → treated as empty. */
  removedDefaultIds?: string[];
  /** Per-tag metadata (group + trip-page default), seeded on boot from
   *  BUILTIN_TAGS and the library's tags. Absent on pre-v2 docs → seeded then. */
  tagMeta: TagMeta[];
  /** Built-in tag keys the user deleted or renamed away. The boot seeder skips
   *  these so the edit sticks across reloads. Absent on older docs → empty. */
  removedTagKeys: string[];
  /** User-added / imported categories that may have no items yet, in order. */
  customCategories: string[];
  /** Built-in category names the user deleted or renamed away (hidden from
   *  pickers + seeding). Absent on older docs → empty. */
  removedCategories: string[];
}

/** Document format version. Bump + handle in `normalizeAppData` when the shape changes. */
export const CURRENT_SCHEMA_VERSION = 3;

export function emptyData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    trips: [],
    library: [],
    removedDefaultIds: [],
    tagMeta: [],
    removedTagKeys: [],
    customCategories: [],
    removedCategories: [],
  };
}

const TAG_GROUPS = new Set<TagGroup>(['activity', 'weather', 'other']);

/** Keep only well-formed registry entries (tolerant of a hand-edited document or
 *  an imported file). Shared by `normalizeAppData` and the export/import parsers. */
export function cleanTagMeta(raw: unknown): TagMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: TagMeta[] = [];
  for (const e of raw) {
    if (e && typeof e.key === 'string' && TAG_GROUPS.has(e.group) && typeof e.default === 'boolean') {
      out.push({ key: e.key, group: e.group, default: e.default });
    }
  }
  return out;
}

/**
 * Normalize an arbitrary parsed value into a valid {@link AppData}. Tolerant of
 * missing/garbage input (returns empty) so a corrupt document can never crash the
 * app. Future schema bumps add their transforms here.
 */
export function normalizeAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return emptyData();
  const o = raw as Partial<AppData>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    trips: Array.isArray(o.trips) ? o.trips : [],
    library: Array.isArray(o.library) ? o.library : [],
    removedDefaultIds: Array.isArray(o.removedDefaultIds) ? o.removedDefaultIds : [],
    tagMeta: cleanTagMeta(o.tagMeta),
    removedTagKeys: strings(o.removedTagKeys),
    customCategories: strings(o.customCategories),
    removedCategories: strings(o.removedCategories),
  };
}

/**
 * Editing a built-in default forks it into a user item: the row is re-keyed to a
 * fresh custom id (`newId`) and flagged `custom:true`, and every trip reference to
 * the old id is rewired to it — so the user's edit follows their trips while the
 * `d:<catalogId>` slot is freed (restoreable). No-op if the id is missing or the
 * item is already custom. Mutates `data` (call inside a store draft). Returns the
 * effective id (new if forked, else unchanged).
 */
export function forkDefault(data: AppData, oldId: string, newId: string): string {
  const item = data.library.find((i) => i.id === oldId);
  if (!item || item.custom) return oldId;
  item.id = newId;
  item.custom = true;
  // Tombstone the freed default slot so the boot seeder won't resurrect it.
  data.removedDefaultIds = [...new Set([...(data.removedDefaultIds ?? []), oldId])];
  for (const trip of data.trips) {
    for (const ref of trip.items) {
      if (ref.libraryId === oldId) ref.libraryId = newId;
    }
  }
  return newId;
}
