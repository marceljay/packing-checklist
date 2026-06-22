import { CATEGORIES, tagKey, type Category, type LibraryItem, type QuantityRule } from '../types';

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

export function serializeLibrary(items: LibraryItem[]): string {
  const envelope: LibraryEnvelope = {
    kind: EXPORT_KIND,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    items,
  };
  return JSON.stringify(envelope, null, 2);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asCategory(v: unknown): Category {
  return CATEGORIES.includes(v as Category) ? (v as Category) : 'Comfort & Misc';
}

/**
 * Parse an exported library file (envelope or a bare items array) into normalized
 * rows. Blank-named rows are dropped. Throws on invalid input.
 */
export function parseLibrary(text: string): ParsedLibraryItem[] {
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
  return out;
}
