import { useLiveQuery } from 'dexie-react-hooks';
import type { Item, LibraryItem, Trip } from '../types';
import { rankLibrary, tagKey } from '../types';
import { uid } from '../db/db';
import { listLibrary, rememberItem, forgetItem } from '../db/library';

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
}

/**
 * "Your items" — custom items remembered from past trips (the global library),
 * minus anything already on this trip. Tap to add; adding bumps recency so your
 * usual things rise to the top over time.
 */
export default function LibraryTray({ trip, update }: Props) {
  const library = useLiveQuery(listLibrary, [], undefined);

  const onTrip = new Set(trip.items.map((i) => tagKey(i.name)));
  const suggestions = rankLibrary(library ?? [], [...onTrip]);

  if (!library || suggestions.length === 0) return null;

  function add(lib: LibraryItem) {
    const item: Item = {
      id: uid(),
      name: lib.name,
      category: lib.category,
      tagIds: [],
      quantitySuggested: null,
      quantityTaken: 1,
      packed: false,
      source: 'custom',
    };
    update((d) => void d.items.push(item));
    void rememberItem(lib.name, lib.category);
  }

  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 p-4">
        <span aria-hidden className="h-4 w-1 rounded-full bg-airblue" />
        <h2 className="font-display text-base font-bold">Your items</h2>
        <span className="chip bg-airblue-soft text-airblue tabular-nums">{suggestions.length}</span>
        <span className="ml-auto font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
          From past trips
        </span>
      </div>
      <ul className="max-h-60 divide-y divide-line/60 overflow-y-auto border-t border-line">
        {suggestions.map((lib) => (
          <li key={lib.nameKey} className="flex items-center gap-3 px-4 py-2 hover:bg-paper-sunk">
            <button
              className="btn-secondary h-7 w-7 shrink-0 p-0 text-base leading-none"
              aria-label={`Add ${lib.name}`}
              onClick={() => add(lib)}
            >
              +
            </button>
            <div className="min-w-0 flex-1">
              <span className="truncate text-sm">{lib.name}</span>
              {lib.count > 1 && (
                <span className="ml-1.5 font-mono text-[0.625rem] text-ink-faint">
                  used {lib.count}×
                </span>
              )}
            </div>
            <span className="shrink-0 font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
              {lib.category}
            </span>
            <button
              className="btn-ghost px-1.5 py-0.5 text-ink-faint"
              aria-label={`Forget ${lib.name}`}
              title="Remove from your items"
              onClick={() => void forgetItem(lib.nameKey)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
