import {
  computeQuantity,
  tagKey,
  type CatalogItem,
  type Tag,
  type Trip,
} from '../types';
import { CATALOG } from '../data/catalog';

export interface Suggestion {
  catalog: CatalogItem;
  score: number;
  /** Active trip tags that caused the match (for reason chips). Empty = essential. */
  reasonTags: Tag[];
  quantity: number;
  /** Whether this came from an `always` essential vs. a tag match. */
  essential: boolean;
}

const ESSENTIAL_BASE_SCORE = 0.5;

/**
 * Rank catalog items for a trip (SPEC §5). Union matching: an item is suggested
 * if it's essential or any of its tagKeys matches an active trip tag. Score is
 * the sum of matched weights (+ a small base for essentials), so items matching
 * more / higher-weighted active tags float to the top. Catalog items whose
 * normalized name is in `excludeNameKeys` (i.e. already on the trip) are skipped.
 */
export function suggestItems(
  trip: Trip,
  catalog: CatalogItem[] = CATALOG,
  excludeNameKeys: Set<string> = new Set(),
): Suggestion[] {
  const days = trip.startDate && trip.endDate
    ? // tripDurationDays inlined to avoid a circular-ish import; cheap enough
      Math.round(
        (new Date(trip.endDate + 'T00:00:00').getTime() -
          new Date(trip.startDate + 'T00:00:00').getTime()) /
          86_400_000,
      ) + 1
    : null;
  const validDays = days != null && days > 0 ? days : null;

  // Map normalized tag key -> the trip Tag(s) carrying it.
  const tagsByKey = new Map<string, Tag>();
  for (const tag of trip.tags) {
    const key = tagKey(tag.label);
    if (!tagsByKey.has(key)) tagsByKey.set(key, tag);
  }

  const out: Suggestion[] = [];
  for (const item of catalog) {
    if (excludeNameKeys.has(tagKey(item.name))) continue;

    let score = 0;
    const reasonTags: Tag[] = [];
    for (const link of item.tagKeys) {
      const tag = tagsByKey.get(link.key);
      if (tag) {
        score += link.weight;
        reasonTags.push(tag);
      }
    }

    const matched = reasonTags.length > 0;
    if (!matched && !item.always) continue;
    if (item.always) score += ESSENTIAL_BASE_SCORE;

    out.push({
      catalog: item,
      score,
      reasonTags,
      essential: item.always === true && !matched,
      quantity: computeQuantity(item.quantity, validDays, trip.settings.laundryAvailable),
    });
  }

  out.sort((a, b) => b.score - a.score || a.catalog.name.localeCompare(b.catalog.name));
  return out;
}
