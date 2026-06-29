import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item, ResolvedItem, Trip, Category } from '../types';
import { orderedCategories } from '../types';
import { editLibraryItem } from '../db/library';
import TagEditor from './TagEditor';
import Select from './Select';
import { useLabels } from '../i18n/labels';
import { InfoIcon, EditIcon, DeleteIcon } from './icons';

export type ItemRowMode = 'plan' | 'checklist';

interface Props {
  /** The trip item joined with its library row. */
  item: ResolvedItem;
  update: (mutator: (draft: Trip) => void) => void;
  /** Show the category chip (hidden when the list is already grouped by category). */
  showCategory?: boolean;
  /** Category options for the edit dropdown (built-ins + any custom categories). */
  categories?: Category[];
  /** plan = display + pencil-edit; checklist = read-only check-off view. */
  mode?: ItemRowMode;
}

export default function ItemRow({
  item,
  update,
  showCategory = false,
  categories,
  mode = 'plan',
}: Props) {
  const { t } = useTranslation();
  const { tTag, tCategory, tItemName, tItemNotes } = useLabels();
  const [editing, setEditing] = useState(false);
  const name = tItemName(item.libraryId, item.name);
  const notes = tItemNotes(item.libraryId, item.notes);
  const [info, setInfo] = useState(false);

  /** Patch this trip's reference (per-trip state: quantity / packed). */
  function patchRef(fn: (it: Item) => void) {
    update((d) => {
      const target = d.items.find((x) => x.libraryId === item.libraryId);
      if (target) fn(target);
    });
  }

  function removeFromTrip() {
    update((d) => void (d.items = d.items.filter((x) => x.libraryId !== item.libraryId)));
  }

  if (mode === 'checklist') {
    return (
      <div
        className={`flex items-start gap-2.5 px-4 py-2.5 transition-colors ${
          item.packed ? 'bg-paper-sunk/40' : 'hover:bg-paper-sunk/40'
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 rounded border-line text-vermilion focus:ring-vermilion"
          checked={item.packed}
          aria-label={t('itemRow.markPacked', { name })}
          onChange={(e) => patchRef((it) => void (it.packed = e.target.checked))}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            {item.quantityTaken > 1 && (
              <span className="shrink-0 font-mono text-xs tabular-nums text-ink-faint">
                {item.quantityTaken}&times;
              </span>
            )}
            <span className={`text-sm ${item.packed ? 'text-ink-faint line-through' : 'text-ink'}`}>
              {name}
            </span>
          </div>
          {item.tagKeys.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tagKeys.map((k) => (
                <span key={k} className="chip bg-paper-sunk text-ink-faint">
                  {tTag(k)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // plan mode
  if (editing) {
    return <EditForm item={item} categories={categories} onDone={() => setEditing(false)} />;
  }

  return (
    <>
    <div className="flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-paper-sunk/40">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Line 1: name + quantity stepper */}
        <div className="flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-sm ${item.missing ? 'text-ink-faint italic' : 'text-ink'}`}>
            {name}
          </span>
          <div className="flex shrink-0 items-center gap-2" aria-label={t('itemRow.quantityAria')}>
            <span className="min-w-[2rem] text-right font-mono text-sm tabular-nums text-ink-soft">
              {item.quantityTaken}&times;
            </span>
            {/* Stepper: one rounded control with a centre divider (two ends). */}
            <div className="flex items-center overflow-hidden rounded-md border border-line">
              <button
                className="flex h-7 w-7 items-center justify-center text-base leading-none text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink"
                aria-label={t('itemRow.decrease')}
                onClick={() => patchRef((it) => void (it.quantityTaken = Math.max(1, it.quantityTaken - 1)))}
              >
                −
              </button>
              <span aria-hidden className="h-7 w-px bg-line" />
              <button
                className="flex h-7 w-7 items-center justify-center text-base leading-none text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink"
                aria-label={t('itemRow.increase')}
                onClick={() => patchRef((it) => void (it.quantityTaken = it.quantityTaken + 1))}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Line 2: essential + category + tag chips (read-only display) */}
        {(showCategory || item.essential || item.tagKeys.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {item.essential && (
              <span className="chip bg-paper-sunk text-ink-faint">{t('itemRow.essential')}</span>
            )}
            {showCategory && (
              <span className="chip bg-paper-sunk font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
                {tCategory(item.category)}
              </span>
            )}
            {item.tagKeys.map((k) => (
              <span key={k} className="chip bg-airblue-soft text-airblue">
                {tTag(k)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions: info always; edit + delete inline only when there's room (sm+).
          On a tight (mobile) row they collapse into the info panel below. */}
      <div className="flex shrink-0 items-center gap-1">
        {!item.missing && (
          <button
            className="btn-ghost mt-0.5 px-1.5 py-1"
            aria-label={t('itemRow.infoAria', { name })}
            aria-expanded={info}
            title={t('itemRow.itemDetails')}
            onClick={() => setInfo((v) => !v)}
          >
            <InfoIcon />
          </button>
        )}
        {!item.missing && (
          <button
            className="btn-ghost mt-0.5 hidden px-1.5 py-1 sm:inline-flex"
            aria-label={t('itemRow.editAria', { name })}
            title={t('itemRow.editTip')}
            onClick={() => setEditing(true)}
          >
            <EditIcon />
          </button>
        )}
        <button
          className={`btn-danger mt-0.5 px-1.5 py-1 ${item.missing ? '' : 'hidden sm:inline-flex'}`}
          aria-label={t('itemRow.deleteAria', { name })}
          title={t('itemRow.removeTip')}
          onClick={removeFromTrip}
        >
          <DeleteIcon />
        </button>
      </div>
    </div>

      {info && !item.missing && (
        <div className="border-t border-line bg-paper-sunk/40 px-4 py-3">
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">{t('itemRow.categoryLabel')}</dt>
            <dd className="text-ink-soft">{tCategory(item.category)}</dd>
            {typeof item.weight === 'number' && (
              <>
                <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">{t('itemRow.weightLabel')}</dt>
                <dd className="text-ink-soft">{t('itemRow.weightEach', { grams: item.weight })}</dd>
              </>
            )}
            {item.essential && (
              <>
                <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">{t('itemRow.essential')}</dt>
                <dd className="text-ink-soft">{t('itemRow.essentialDesc')}</dd>
              </>
            )}
            <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">{t('itemRow.notesLabel')}</dt>
            <dd className="whitespace-pre-wrap text-ink-soft">{notes || '—'}</dd>
          </dl>

          {/* On tight rows edit/delete live here (hidden once they fit inline at sm+). */}
          <div className="mt-3 flex gap-2 sm:hidden">
            <button className="btn-ghost flex items-center gap-1.5 text-xs" onClick={() => setEditing(true)}>
              <EditIcon /> {t('itemRow.edit')}
            </button>
            <button className="btn-danger flex items-center gap-1.5 text-xs" onClick={removeFromTrip}>
              <DeleteIcon /> {t('itemRow.delete')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Inline editor for the item's shared fields. Because the library is the single
 * source of truth, saving here updates the library row (by id) — reflected on
 * every trip that references it. Quantity / packed are per-trip and edited
 * outside this form.
 */
function EditForm({
  item,
  categories,
  onDone,
}: {
  item: ResolvedItem;
  categories?: Category[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { tCategory } = useLabels();
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<Category>(item.category);
  // Always include the item's own category so a custom one survives editing.
  const options = orderedCategories([...(categories ?? []), item.category]);
  const [tags, setTags] = useState<string[]>(item.tagKeys);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [essential, setEssential] = useState(item.essential);
  const initialWeight = item.weight != null ? String(item.weight) : '';
  const [weight, setWeight] = useState(initialWeight);
  const [error, setError] = useState('');

  function save() {
    if (!name.trim()) return;
    const patch: Parameters<typeof editLibraryItem>[1] = { name, category, tagKeys: tags, notes, essential };
    if (weight !== initialWeight) {
      const w = parseInt(weight, 10);
      patch.weight = Number.isFinite(w) && w > 0 ? w : null;
    }
    const res = editLibraryItem(item.libraryId, patch);
    if (!res.ok) {
      setError(t('itemRow.nameTaken'));
      return;
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-2 bg-paper-sunk/40 px-4 py-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_11rem_6rem]">
        <input
          className="input min-w-0"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={t('itemRow.nameAria')}
          autoFocus
        />
        <Select
          className="min-w-0"
          value={category}
          onChange={(v) => setCategory(v as Category)}
          options={options}
          renderOption={tCategory}
          ariaLabel="Category"
        />
        <input
          type="number"
          min="1"
          inputMode="numeric"
          className="input min-w-0"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={t('itemRow.weightPlaceholder')}
          aria-label={t('itemRow.weightAria')}
          title={t('itemRow.weightTip')}
        />
      </div>
      <TagEditor value={tags} onChange={setTags} ariaLabel={t('itemRow.tagsAria', { name: item.name })} />
      <textarea
        rows={1}
        className="input h-10 resize-none transition-[height] focus:h-24"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('itemRow.notesPlaceholder')}
        aria-label={t('itemRow.notesAria', { name: item.name })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-line text-vermilion focus:ring-vermilion"
          checked={essential}
          onChange={(e) => setEssential(e.target.checked)}
        />
        <span>
          {t('itemRow.essential')}
          <span className="ml-1.5 text-xs text-ink-faint">{t('itemRow.essentialSuffix')}</span>
        </span>
      </label>
      {error && <p className="font-mono text-xs text-vermilion">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button className="btn-ghost text-xs" onClick={onDone}>
          {t('common.cancel')}
        </button>
        <button className="btn-primary text-xs" onClick={save} disabled={!name.trim()}>
          {t('itemRow.saveToLibrary')}
        </button>
      </div>
    </div>
  );
}
