import { useTranslation } from 'react-i18next';
import { isBuiltinCategory, defaultId } from '../types';
import { BUILTIN_TAGS } from '../data/tags';
import { CATALOG } from '../data/catalog';

const BUILTIN_TAG_KEYS = new Set(BUILTIN_TAGS.map((t) => t.key));

/** Built-in catalog items keyed by their library id (`d:<catalogId>`), so a
 *  stored default item can be matched back to its English source. */
const CATALOG_BY_LIBRARY_ID = new Map(CATALOG.map((c) => [defaultId(c.id), c]));

/**
 * Display-only translation for the built-in categories and tags. The stored
 * value (a category *name* or a tag *key*) stays English — it is the identity
 * used for suggestions, filtering, grouping and import/export — so only the
 * rendered label is localised. Custom (user/imported) categories and tags have
 * no translation and pass through unchanged. Each key in the `categories` /
 * `tags` resource blocks is the exact English identity (e.g. `Money & Cards`,
 * `road trip`); a missing entry falls back to that identity.
 */
export function useLabels() {
  const { t } = useTranslation();

  const tCategory = (name: string) =>
    isBuiltinCategory(name) ? t(`categories.${name}`, { defaultValue: name }) : name;

  const tTag = (key: string) =>
    BUILTIN_TAG_KEYS.has(key) ? t(`tags.${key}`, { defaultValue: key }) : key;

  /**
   * Localised display name for a default catalog item. `id` is the library row
   * id (`d:<catalogId>` for built-ins). Only translated while the stored name
   * still matches the English source — if the user renamed the item, their name
   * is kept. Custom items (and renamed defaults) pass through unchanged.
   */
  const tItemName = (id: string, storedName: string) => {
    const c = CATALOG_BY_LIBRARY_ID.get(id);
    if (!c || storedName !== c.name) return storedName;
    return t(`catalogItems.${c.id}.name`, { defaultValue: storedName });
  };

  /** Localised default note for a built-in item, on the same unedited-only basis
   *  as {@link tItemName}. Returns the stored note for customs/edited notes. */
  const tItemNotes = (id: string, storedNotes: string | undefined) => {
    if (storedNotes == null) return storedNotes;
    const c = CATALOG_BY_LIBRARY_ID.get(id);
    if (!c || storedNotes !== c.notes) return storedNotes;
    return t(`catalogItems.${c.id}.notes`, { defaultValue: storedNotes });
  };

  /**
   * The item's localised searchable text — its translated name, category and
   * tags joined. Pass to {@link searchLibrary} so the library search also matches
   * what the user actually sees (e.g. typing "Reisepass" finds "Passport" in
   * German); the English identity is still matched separately, so search works
   * in either language.
   */
  const itemSearchText = (item: ItemLabelFields) =>
    [tItemName(item.id, item.name), tCategory(item.category), ...item.tagKeys.map(tTag)].join(' ');

  return { tCategory, tTag, tItemName, tItemNotes, itemSearchText };
}

/** Minimal item shape {@link useLabels}'s item helpers read from. */
type ItemLabelFields = { id: string; name: string; category: string; tagKeys: string[] };
