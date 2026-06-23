import {
  computeQuantity,
  tagKey,
  type LibraryItem,
  type Tag,
  type Trip,
} from '../types';

export interface Suggestion {
  item: LibraryItem;
  /** Number of active trip tags this item matched (0 for an essential-only hit). */
  score: number;
  /** Active trip tags that caused the match (for reason chips). Empty = essential. */
  reasonTags: Tag[];
  quantity: number;
  /** Whether this came from an essential rather than a tag match. */
  essential: boolean;
}

/**
 * Rank library items for a trip (SPEC §5). Union matching: an item is suggested
 * if it's an essential or any of its `tagKeys` matches an active trip tag. Score
 * is the count of matched tags (no per-tag weights — the unified library doesn't
 * carry them), so items matching more active tags float to the top; ties break by
 * usage count (the library's memory), then name. Items whose id is in
 * `excludeIds` (already on the trip) are skipped.
 */
export function suggestItems(
  trip: Trip,
  library: LibraryItem[],
  excludeIds: Set<string> = new Set(),
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
  for (const item of library) {
    if (excludeIds.has(item.id)) continue;

    const reasonTags: Tag[] = [];
    for (const key of item.tagKeys) {
      const tag = tagsByKey.get(key);
      if (tag) reasonTags.push(tag);
    }

    const matched = reasonTags.length > 0;
    if (!matched && !item.essential) continue;

    out.push({
      item,
      score: reasonTags.length,
      reasonTags,
      essential: item.essential === true && !matched,
      quantity: computeQuantity(item.quantity ?? { kind: 'none' }, validDays, trip.settings.laundryAvailable),
    });
  }

  out.sort(
    (a, b) =>
      b.score - a.score ||
      b.item.count - a.item.count ||
      a.item.name.localeCompare(b.item.name),
  );
  return out;
}
