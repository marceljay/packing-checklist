import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Trip, Category, LibraryItem } from '../types';
import { computeQuantity, orderedCategories, searchLibrary } from '../types';
import { rememberItem, editLibraryItem } from '../db/library';
import TagEditor from './TagEditor';
import Select from './Select';
import { useLabels } from '../i18n/labels';
import { ChevronIcon } from './icons';

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
  /** Library rows by id — the search source and the already-on-trip filter. */
  library: Map<string, LibraryItem>;
  /** Known tag keys for autocomplete in the tag editor. */
  tagSuggestions?: string[];
  /** Category options (built-ins + any custom categories already in the library). */
  categories?: Category[];
}

/**
 * "Search or add item" — a dedicated card above the packing list. The single
 * field searches your library first (so you reuse a row instead of forking a
 * near-duplicate); when nothing matches the typed name, "+ Add new item" expands
 * the rest of the fields to create one. Every item is a library item, so adding
 * resolves-or-creates the library row and the trip stores only a reference;
 * re-adding an item already on the trip bumps its quantity.
 */
export default function AddItemCard({ trip, update, library, tagSuggestions = [], categories }: Props) {
  const { t } = useTranslation();
  const { tCategory, tItemName, itemSearchText } = useLabels();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('Comfort & Misc');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState(false);
  const options = orderedCategories(categories ?? []);

  const q = query.trim();
  const onTrip = useMemo(() => new Set(trip.items.map((i) => i.libraryId)), [trip.items]);
  const allItems = useMemo(() => [...library.values()], [library]);
  // Library matches for the typed text, minus anything already on the trip.
  const matches = useMemo(
    () => (q ? searchLibrary(allItems, q, itemSearchText).filter((i) => !onTrip.has(i.id)).slice(0, 6) : []),
    [allItems, q, onTrip, itemSearchText],
  );
  const exact =
    q !== '' &&
    allItems.some(
      (i) => i.name.toLowerCase() === q.toLowerCase() || tItemName(i.id, i.name).toLowerCase() === q.toLowerCase(),
    );
  const showAddNew = q !== '' && !exact;

  function reset() {
    setQuery('');
    setTags([]);
    setNotes('');
    setExpanded(false);
    // category stays sticky for the next add
  }

  /** Add an existing library row to the trip (bump quantity if already there). */
  function addExisting(item: LibraryItem) {
    const qty = computeQuantity(item.quantity ?? { kind: 'none' }, null, false);
    update((d) => {
      const existing = d.items.find((i) => i.libraryId === item.id);
      if (existing) existing.quantityTaken += 1;
      else d.items.push({ libraryId: item.id, quantitySuggested: null, quantityTaken: qty, packed: false });
    });
    reset();
  }

  /** Create (or reuse a same-named) library row from the typed name + fields. */
  function addNew() {
    const clean = query.trim();
    if (!clean) return;
    const row = rememberItem(clean, category, tags);
    // Notes are a shared library field; persist on the resolved row. May fork a
    // built-in default into a custom (editLibraryItem returns the effective id).
    const id = notes.trim() ? editLibraryItem(row.id, { notes }).id : row.id;
    const qty = computeQuantity(row.quantity ?? { kind: 'none' }, null, false);
    update((d) => {
      const existing = d.items.find((i) => i.libraryId === id);
      if (existing) existing.quantityTaken += 1;
      else d.items.push({ libraryId: id, quantitySuggested: null, quantityTaken: qty, packed: false });
    });
    reset();
  }

  function onFieldEnter() {
    if (expanded || exact) addNew();
    else if (showAddNew) setExpanded(true);
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 p-4">
        <button
          className="flex flex-1 items-center gap-2.5 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span aria-hidden className="h-4 w-1 rounded-full bg-vermilion" />
          <h2 className="font-display text-base font-bold">{t('addItem.title')}</h2>
          <ChevronIcon
            className={`ml-1 text-ink-faint transition-transform ${open ? '' : '-rotate-90'}`}
          />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-line p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
            <input
              className="input min-w-0"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onFieldEnter()}
              placeholder={t('addItem.searchOrAdd')}
              aria-label={t('addItem.searchOrAdd')}
            />
            <Select
              className="min-w-0"
              value={category}
              onChange={(v) => setCategory(v as Category)}
              options={options}
              renderOption={tCategory}
              ariaLabel={t('addItem.category')}
            />
          </div>

          {/* Library matches for the typed text — tap to add an existing item. */}
          {matches.length > 0 && (
            <ul className="divide-y divide-line/60 rounded-md border border-line">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-paper-sunk"
                    onClick={() => addExisting(item)}
                  >
                    <span className="text-base leading-none text-ink-soft">+</span>
                    <span className="min-w-0 flex-1 truncate">{tItemName(item.id, item.name)}</span>
                    <span className="shrink-0 font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
                      {tCategory(item.category)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* No exact-name match → offer to create it, expanding the rest of the fields. */}
          {showAddNew && !expanded && (
            <button
              className="btn-secondary self-start text-xs"
              onClick={() => setExpanded(true)}
            >
              {t('addItem.addNew', { name: q })}
            </button>
          )}

          {expanded && (
            <>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <TagEditor value={tags} onChange={setTags} suggestions={tagSuggestions} ariaLabel={t('addItem.tagsAria')} />
                </div>
                <button className="btn-primary shrink-0" onClick={addNew} disabled={!q}>
                  {t('addItem.addItemBtn')}
                </button>
              </div>
              <textarea
                rows={1}
                className="input h-10 resize-none transition-[height] focus:h-24"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('addItem.notesPlaceholder')}
                aria-label={t('addItem.notesAria')}
              />
              <p className="font-mono text-[0.625rem] text-ink-faint">
                {t('addItem.savedNote')}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
