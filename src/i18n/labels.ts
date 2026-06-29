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
  return {
    tCategory: (name: string) =>
      isBuiltinCategory(name) ? t(`categories.${name}`, { defaultValue: name }) : name,
    tTag: (key: string) => (BUILTIN_TAG_KEYS.has(key) ? t(`tags.${key}`, { defaultValue: key }) : key),
    /**
     * Localised display name for a default catalog item. `id` is the library row
     * id (`d:<catalogId>` for built-ins). Only translated while the stored name
     * still matches the English source — if the user renamed the item, their
     * name is kept. Custom items (and renamed defaults) pass through unchanged.
     */
    tItemName: (id: string, storedName: string) => {
      const c = CATALOG_BY_LIBRARY_ID.get(id);
      if (!c || storedName !== c.name) return storedName;
      return t(`catalogItems.${c.id}.name`, { defaultValue: storedName });
    },
    /** Localised default note for a built-in item, on the same unedited-only basis
     *  as {@link tItemName}. Returns the stored note for customs/edited notes. */
    tItemNotes: (id: string, storedNotes: string | undefined) => {
      if (storedNotes == null) return storedNotes;
      const c = CATALOG_BY_LIBRARY_ID.get(id);
      if (!c || storedNotes !== c.notes) return storedNotes;
      return t(`catalogItems.${c.id}.notes`, { defaultValue: storedNotes });
    },
  };
}
