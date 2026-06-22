import { tagKey, type CatalogItem, type LibraryItem } from '../types';

/**
 * Convert the static built-in catalog into seed library items. Per-tag weights
 * are dropped (suggestions rank by match count); `always` becomes `essential`
 * and the quantity rule is carried so smart quantities survive. Pure.
 */
export function catalogToLibraryItems(catalog: CatalogItem[]): LibraryItem[] {
  return catalog.map((c) => ({
    nameKey: tagKey(c.name),
    name: c.name,
    category: c.category,
    tagKeys: c.tagKeys.map((t) => t.key),
    custom: false,
    essential: c.always === true,
    quantity: c.quantity,
    count: 0,
    lastUsed: 0,
  }));
}
