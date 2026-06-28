import { tagKey, type Category, type LibraryItem, type QuantityRule, type TagMeta } from '../types';
import { cleanTagMeta } from './appData';

/**
 * JSON export/import for the whole item library (backup / move between devices).
 * Pure functions: serialize every library row, and parse a library file back into
 * normalized rows (identity is the stable `id`; the importer de-dups by it).
 */

const EXPORT_KIND = 'packing-checklist/library';
const EXPORT_VERSION = 1;

interface LibraryEnvelope {
  kind: typeof EXPORT_KIND;
  version: number;
  exportedAt: number;
  items: LibraryItem[];
  /** The tag registry, so grouping/defaults survive a backup round-trip. */
  tagMeta: TagMeta[];
  /** Custom categories that may have no items yet, so they survive too. */
  customCategories: string[];
}

/** A parsed library file: the rows plus the registries it carried. */
export interface ParsedLibrary {
  items: ParsedLibraryItem[];
  tagMeta: TagMeta[];
  customCategories: string[];
}

/** A library row as carried in an import (id optional — absent → matched by name). */
export interface ParsedLibraryItem {
  id?: string;
  nameKey: string;
  name: string;
  category: Category;
  tagKeys: string[];
  custom: boolean;
  essential?: boolean;
  quantity?: QuantityRule;
  count: number;
  lastUsed: number;
}

/** How to resolve a name clash between an incoming item and an existing one. */
export type ConflictResolution = 'mine' | 'theirs' | 'both';

export interface LibraryImportPlan {
  /** Incoming items with no existing id and no name clash — safe to add. */
  fresh: ParsedLibraryItem[];
  /** Incoming items whose id is already present (same identity) — re-imports. */
  idMatches: ParsedLibraryItem[];
  /** Incoming items whose name matches an existing item but the id differs. */
  conflicts: { incoming: ParsedLibraryItem; existing: LibraryItem }[];
}

/**
 * Classify a parsed import against the current library (for the merge flow):
 * id already present → re-import (skip), same name + different id → conflict to
 * resolve, otherwise a fresh add. Pure.
 */
export function planLibraryImport(
  incoming: ParsedLibraryItem[],
  current: LibraryItem[],
): LibraryImportPlan {
  const byId = new Map(current.map((i) => [i.id, i]));
  const byNameKey = new Map(current.map((i) => [i.nameKey, i]));
  const plan: LibraryImportPlan = { fresh: [], idMatches: [], conflicts: [] };
  for (const inc of incoming) {
    if (inc.id && byId.has(inc.id)) {
      plan.idMatches.push(inc);
      continue;
    }
    const existing = byNameKey.get(inc.nameKey);
    if (existing) plan.conflicts.push({ incoming: inc, existing });
    else plan.fresh.push(inc);
  }
  return plan;
}

export function serializeLibrary(
  items: LibraryItem[],
  tagMeta: TagMeta[] = [],
  customCategories: string[] = [],
): string {
  const envelope: LibraryEnvelope = {
    kind: EXPORT_KIND,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    items,
    tagMeta,
    customCategories,
  };
  return JSON.stringify(envelope, null, 2);
}

/** Tolerant string-array parse for a registry field on an imported file. */
function parseStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

// Preserve whatever category the file carries (custom categories are allowed and
// surfaced as their own sections); only an absent/blank one falls back.
function asCategory(v: unknown): Category {
  return asString(v).trim() || 'Comfort & Misc';
}

/**
 * Parse an exported library file (envelope or a bare items array) into normalized
 * rows plus the tag registry it carried (tolerant: a missing/invalid `tagMeta`
 * yields `[]`). Blank-named rows are dropped. Throws on invalid input.
 */
export function parseLibrary(text: string): ParsedLibrary {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }

  const rawItems = (data as { items?: unknown }).items ?? data;
  if (!Array.isArray(rawItems)) {
    throw new Error('That file isn’t a packing-checklist item library.');
  }
  const tagMeta = cleanTagMeta((data as { tagMeta?: unknown }).tagMeta);
  const customCategories = parseStrings((data as { customCategories?: unknown }).customCategories);

  const out: ParsedLibraryItem[] = [];
  for (const raw of rawItems as Record<string, unknown>[]) {
    const name = asString(raw.name).trim();
    if (!name) continue;
    out.push({
      ...(raw.id ? { id: asString(raw.id) } : {}),
      nameKey: tagKey(name),
      name,
      category: asCategory(raw.category),
      tagKeys: Array.isArray(raw.tagKeys) ? raw.tagKeys.map((k) => tagKey(String(k))) : [],
      custom: raw.custom !== false,
      ...(raw.essential ? { essential: true } : {}),
      ...(raw.quantity ? { quantity: raw.quantity as QuantityRule } : {}),
      count: typeof raw.count === 'number' ? raw.count : 0,
      lastUsed: typeof raw.lastUsed === 'number' ? raw.lastUsed : 0,
    });
  }
  return { items: out, tagMeta, customCategories };
}
