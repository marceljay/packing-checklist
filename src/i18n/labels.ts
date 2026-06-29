import { useTranslation } from 'react-i18next';
import { isBuiltinCategory } from '../types';
import { BUILTIN_TAGS } from '../data/tags';

const BUILTIN_TAG_KEYS = new Set(BUILTIN_TAGS.map((t) => t.key));

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
  };
}
