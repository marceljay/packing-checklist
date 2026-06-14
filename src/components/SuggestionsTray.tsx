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
    <section className="card flex flex-col">
      <button
        className="flex items-center gap-2 border-b border-slate-100 p-3 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span aria-hidden>💡</span>
        <h2 className="font-semibold">Suggestions</h2>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
          {suggestions.length}
        </span>
        <span className="ml-auto text-xs text-slate-400">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <>
          {suggestions.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              Add activity or weather tags (or dates) to get tailored suggestions.
              Everything already on your list is hidden here.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-slate-400">Tap to add to your list</span>
                <button className="btn-ghost py-1 text-xs" onClick={addAll}>
                  Add all
                </button>
              </div>
              <ul className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
                {suggestions.map((s) => (
                  <li
                    key={s.catalog.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50"
                  >
                    <button
                      className="btn-secondary h-7 w-7 shrink-0 p-0 text-base"
                      aria-label={`Add ${s.catalog.name}`}
                      onClick={() => add(s)}
                    >
                      +
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-sm">{s.catalog.name}</span>
                        {s.quantity > 1 && (
                          <span className="text-xs text-slate-400">×{s.quantity}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {s.essential ? (
                          <span className="chip bg-slate-100 text-slate-500">Essential</span>
                        ) : (
                          s.reasonTags.map((t) => (
                            <span key={t.id} className="chip bg-emerald-50 text-emerald-700">
                              {t.label}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-300">{s.catalog.category}</span>
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
