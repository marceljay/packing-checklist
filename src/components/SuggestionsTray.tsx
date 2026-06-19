import { useMemo, useState } from 'react';
import type { Item, Trip } from '../types';
import { uid } from '../db/db';
import { suggestItems, type Suggestion } from '../engine/suggest';

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
}

function suggestionToItem(s: Suggestion): Item {
  return {
    id: uid(),
    name: s.catalog.name,
    category: s.catalog.category,
    tagIds: s.reasonTags.map((t) => t.id),
    quantitySuggested: s.quantity,
    quantityTaken: s.quantity,
    packed: false,
    source: 'suggested',
    catalogId: s.catalog.id,
  };
}

export default function SuggestionsTray({ trip, update }: Props) {
  const [open, setOpen] = useState(true);
  const suggestions = useMemo(() => suggestItems(trip), [trip]);

  function add(s: Suggestion) {
    update((d) => void d.items.push(suggestionToItem(s)));
  }

  function addAll() {
    update((d) => {
      for (const s of suggestions) d.items.push(suggestionToItem(s));
    });
  }

  return (
    <section className="card flex flex-col overflow-hidden">
      <button
        className="flex items-center gap-2.5 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span aria-hidden className="airmail h-4 w-1 rounded-full" />
        <h2 className="font-display text-base font-bold">Recommended</h2>
        <span className="chip bg-vermilion-soft text-vermilion-deep tabular-nums">
          {suggestions.length}
        </span>
        <span className="ml-auto font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {open && (
        <>
          {suggestions.length === 0 ? (
            <p className="border-t border-line px-4 py-6 text-center text-sm text-ink-soft">
              Add activity or weather tags (or dates) to get tailored suggestions.
              Anything already on your manifest is hidden here.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between border-t border-line px-4 py-2">
                <span className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
                  Tap to add
                </span>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={addAll}>
                  Add all
                </button>
              </div>
              <ul className="max-h-80 divide-y divide-line/60 overflow-y-auto">
                {suggestions.map((s) => (
                  <li
                    key={s.catalog.id}
                    className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-paper-sunk"
                  >
                    <button
                      className="btn-secondary h-7 w-7 shrink-0 p-0 text-base leading-none"
                      aria-label={`Add ${s.catalog.name}`}
                      onClick={() => add(s)}
                    >
                      +
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-sm">{s.catalog.name}</span>
                        {s.quantity > 1 && (
                          <span className="font-mono text-xs tabular-nums text-ink-faint">
                            ×{s.quantity}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {s.essential ? (
                          <span className="chip bg-paper-sunk text-ink-faint">Essential</span>
                        ) : (
                          s.reasonTags.map((t) => (
                            <span key={t.id} className="chip bg-stamp-soft text-stamp">
                              {t.label}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
                      {s.catalog.category}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
