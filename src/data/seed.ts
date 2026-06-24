import { defaultId, tagKey, type CatalogItem, type LibraryItem } from '../types';

/**
 * Convert the static built-in catalog into seed library items. Per-tag weights
 * are dropped (suggestions rank by match count); `always` becomes `essential`
 * and the quantity rule is carried so smart quantities survive. Each gets a
 * deterministic `d:<catalogId>` id (see {@link defaultId}). Pure.
 */
export function catalogToLibraryItems(catalog: CatalogItem[]): LibraryItem[] {
  return catalog.map((c) => ({
    id: defaultId(c.id),
    nameKey: tagKey(c.name),
    name: c.name,
    category: c.category,
    tagKeys: c.tagKeys.map((t) => t.key),
    custom: false,
    essential: c.always === true,
    ...(c.essentialWhen ? { essentialWhen: c.essentialWhen } : {}),
    quantity: c.quantity,
    count: 0,
    lastUsed: 0,
  }));
}
