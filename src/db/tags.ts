import { getData, setData } from './store';
import { BUILTIN_TAGS } from '../data/tags';
import { tagKey, type TagGroup, type TagMeta } from '../types';

/**
 * The tag registry: per-tag metadata (group + trip-page default) kept once in the
 * app-data document. Seeded from {@link BUILTIN_TAGS} plus whatever tags the
 * library already uses; thereafter edited via the Item Library tag editor.
 * Rename/delete are global — they rewrite library items and every trip's selected
 * tags — so the registry never drifts from what's actually in use.
 */

/** Catch-all tag for items orphaned by a delete (so they stay grouped/findable). */
export const MISC_TAG = 'misc';

/**
 * Ensure a registry entry for every built-in and every tag already on a library
 * item. Idempotent by key and never overwrites an existing entry, so user edits
 * survive reloads. Built-ins seed as defaults in their group; library-only tags
 * seed as non-default `other`.
 */
export function seedTagMeta(): void {
  setData((d) => {
    const have = new Set(d.tagMeta.map((t) => t.key));
    const ensure = (key: string, group: TagGroup, def: boolean) => {
      if (!have.has(key)) {
        d.tagMeta.push({ key, group, default: def });
        have.add(key);
      }
    };
    for (const b of BUILTIN_TAGS) ensure(b.key, b.type, true);
    for (const item of d.library) for (const k of item.tagKeys ?? []) ensure(k, 'other', false);
  });
}

export function listTagMeta(): TagMeta[] {
  return getData().tagMeta;
}

export function getTagGroup(key: string): TagGroup {
  return getData().tagMeta.find((t) => t.key === tagKey(key))?.group ?? 'other';
}

export function isDefaultTag(key: string): boolean {
  return getData().tagMeta.find((t) => t.key === tagKey(key))?.default ?? false;
}

export function setTagGroup(key: string, group: TagGroup): void {
  const k = tagKey(key);
  setData((d) => {
    const e = d.tagMeta.find((t) => t.key === k);
    if (e) e.group = group;
    else d.tagMeta.push({ key: k, group, default: false });
  });
}

export function setTagDefault(key: string, value: boolean): void {
  const k = tagKey(key);
  setData((d) => {
    const e = d.tagMeta.find((t) => t.key === k);
    if (e) e.default = value;
    else d.tagMeta.push({ key: k, group: 'other', default: value });
  });
}

/**
 * Rename a tag everywhere: the registry entry, every library item's tagKeys, and
 * every trip's selected tags (the visible label too). De-dups when the target key
 * already exists. No-op for a blank target or a rename onto itself.
 */
export function renameTag(from: string, to: string): void {
  const fromKey = tagKey(from);
  const toKey = tagKey(to);
  if (!toKey || fromKey === toKey) return;
  setData((d) => {
    // Registry: move the entry to the new key (unless the target already exists).
    const target = d.tagMeta.find((t) => t.key === toKey);
    const src = d.tagMeta.find((t) => t.key === fromKey);
    if (src && target) d.tagMeta = d.tagMeta.filter((t) => t.key !== fromKey);
    else if (src) src.key = toKey;

    // Library items: swap the key, de-duping.
    d.library = d.library.map((item) => {
      if (!item.tagKeys.includes(fromKey)) return item;
      return { ...item, tagKeys: [...new Set(item.tagKeys.map((k) => (k === fromKey ? toKey : k)))] };
    });

    // Trip selections: relabel matching tags, then drop any duplicate key.
    for (const trip of d.trips) {
      const seen = new Set<string>();
      trip.tags = trip.tags
        .map((t) => (tagKey(t.label) === fromKey ? { ...t, label: to } : t))
        .filter((t) => {
          const k = tagKey(t.label);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
    }
  });
}

/**
 * Delete a tag everywhere: removed from the registry, from every library item's
 * tagKeys, and from every trip's selected tags. Items are never deleted — any item
 * left with no tags is reassigned to {@link MISC_TAG} so it stays findable.
 */
export function deleteTag(key: string): void {
  const k = tagKey(key);
  setData((d) => {
    let orphaned = false;
    d.library = d.library.map((item) => {
      if (!item.tagKeys.includes(k)) return item;
      const next = item.tagKeys.filter((t) => t !== k);
      if (next.length === 0) {
        orphaned = true;
        return { ...item, tagKeys: [MISC_TAG] };
      }
      return { ...item, tagKeys: next };
    });

    d.tagMeta = d.tagMeta.filter((t) => t.key !== k);
    if (orphaned && !d.tagMeta.some((t) => t.key === MISC_TAG)) {
      d.tagMeta.push({ key: MISC_TAG, group: 'other', default: false });
    }

    for (const trip of d.trips) {
      trip.tags = trip.tags.filter((t) => tagKey(t.label) !== k);
    }
  });
}
