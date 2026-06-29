import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Trip, LibraryItem } from '../types';
import { rememberItem } from '../db/library';
import { useLabels } from '../i18n/labels';
import { suggestItems, type Suggestion } from '../engine/suggest';
import { ChevronIcon, InfoIcon } from './icons';

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
  /** Library rows by id — the suggestion source and the already-on-trip filter. */
  library: Map<string, LibraryItem>;
}

export default function SuggestionsTray({ trip, update, library }: Props) {
  const { t } = useTranslation();
  const { tTag, tCategory } = useLabels();
  const [open, setOpen] = useState(true);
  // Which suggestion's notes panel is expanded (only items with notes get a button).
  const [infoId, setInfoId] = useState<string | null>(null);

  // Suggestions are drawn from the whole library (defaults + customs), so edits
  // and removals there flow straight through. Already-listed items are excluded.
  const excludeIds = useMemo(() => new Set(trip.items.map((i) => i.libraryId)), [trip.items]);
  const suggestions = useMemo(
    () => suggestItems(trip, [...library.values()], excludeIds),
    [trip, library, excludeIds],
  );

  async function add(s: Suggestion) {
    const row = await rememberItem(s.item.name, s.item.category);
    update((d) => {
      if (!d.items.some((i) => i.libraryId === row.id)) {
        d.items.push({
          libraryId: row.id,
          quantitySuggested: s.quantity,
          quantityTaken: s.quantity,
          packed: false,
        });
      }
    });
  }

  async function addAll() {
    for (const s of suggestions) await add(s);
  }

  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 p-4">
        <button
          className="flex flex-1 items-center gap-2.5 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span aria-hidden className="airmail h-4 w-1 rounded-full" />
          <h2 className="font-display text-base font-bold">{t('suggestions.title')}</h2>
          <span className="chip bg-vermilion-soft text-vermilion-deep tabular-nums">
            {suggestions.length}
          </span>
          <ChevronIcon
            className={`ml-1 text-ink-faint transition-transform ${open ? '' : '-rotate-90'}`}
          />
        </button>
        {suggestions.length > 0 && (
          <button
            className="btn-ghost shrink-0 px-2 py-1 text-xs"
            onClick={() => void addAll()}
          >
            {t('suggestions.addAll')}
          </button>
        )}
      </div>

      {open &&
        (suggestions.length === 0 ? (
          <p className="border-t border-line px-4 py-6 text-center text-sm text-ink-soft">
            {t('suggestions.empty')}
          </p>
        ) : (
            <ul className="max-h-80 divide-y divide-line/60 overflow-y-auto border-t border-line">
                {suggestions.map((s) => (
                  <li key={s.item.id} className="transition-colors hover:bg-paper-sunk">
                    <div className="flex items-center gap-3 px-4 py-2">
                      <button
                        className="btn-secondary h-7 w-7 shrink-0 p-0 text-base leading-none"
                        aria-label={t('suggestions.addAria', { name: s.item.name })}
                        onClick={() => void add(s)}
                      >
                        +
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-sm">{s.item.name}</span>
                          {s.quantity > 1 && (
                            <span className="font-mono text-xs tabular-nums text-ink-faint">
                              ×{s.quantity}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {s.essential ? (
                            <span className="chip bg-paper-sunk text-ink-faint">{t('suggestions.essential')}</span>
                          ) : (
                            s.reasonTags.map((tag) => (
                              <span key={tag.id} className="chip bg-stamp-soft text-stamp">
                                {tTag(tag.label)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      {s.item.notes && (
                        <button
                          className="btn-ghost shrink-0 px-1.5 py-1"
                          aria-label={t('suggestions.infoAria', { name: s.item.name })}
                          aria-expanded={infoId === s.item.id}
                          title={t('suggestions.itemDetails')}
                          onClick={() => setInfoId((id) => (id === s.item.id ? null : s.item.id))}
                        >
                          <InfoIcon />
                        </button>
                      )}
                      <span className="shrink-0 font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
                        {tCategory(s.item.category)}
                      </span>
                    </div>
                    {s.item.notes && infoId === s.item.id && (
                      <p className="whitespace-pre-wrap border-t border-line/60 bg-paper-sunk/40 px-4 py-2 text-sm text-ink-soft">
                        {s.item.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
        ))}
    </section>
  );
}
