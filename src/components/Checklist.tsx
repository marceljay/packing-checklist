import { useMemo, useState } from 'react';
import type { Item, Trip } from '../types';
import { itemsByCategory } from '../types';
import { uid } from '../db/db';
import { rememberItem } from '../db/library';
import ItemRow from './ItemRow';

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
}

type GroupBy = 'category' | 'tag';

interface Group {
  key: string;
  label: string;
  items: Item[];
}

export default function Checklist({ trip, update }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [newName, setNewName] = useState('');

  function addItem() {
    const name = newName.trim();
    if (!name) return;
    const item: Item = {
      id: uid(),
      name,
      category: 'Comfort & Misc',
      tagIds: [],
      quantitySuggested: null,
      quantityTaken: 1,
      packed: false,
      source: 'custom',
    };
    update((d) => void d.items.push(item));
    void rememberItem(item.name, item.category); // resurfaces on future trips
    setNewName('');
  }

  const groups = useMemo<Group[]>(() => {
    const items = trip.items;
    if (groupBy === 'category') {
      return itemsByCategory(items).map((g) => ({
        key: g.category,
        label: g.category,
        items: g.items,
      }));
    }
    // group by tag
    const out: Group[] = trip.tags.map((t) => ({
      key: t.id,
      label: t.label,
      items: items.filter((i) => i.tagIds.includes(t.id)),
    }));
    out.push({
      key: '__untagged',
      label: 'Untagged',
      items: items.filter((i) => i.tagIds.length === 0),
    });
    return out.filter((g) => g.items.length > 0);
  }, [trip.items, trip.tags, groupBy]);

  const total = trip.items.length;
  const packedCount = trip.items.filter((i) => i.packed).length;

  return (
    <section className="card flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line p-4">
        <h2 className="font-display text-base font-bold">Manifest</h2>
        {total > 0 && (
          <span className="font-mono text-xs tabular-nums text-ink-faint">
            {packedCount}/{total} packed
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="label mr-1">Group</span>
          {(['category', 'tag'] as GroupBy[]).map((g) => (
            <button
              key={g}
              className={`rounded px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-wide transition-colors ${
                groupBy === g
                  ? 'bg-ink text-paper-raised'
                  : 'text-ink-faint hover:bg-paper-sunk hover:text-ink'
              }`}
              onClick={() => setGroupBy(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Add item */}
      <div className="flex gap-2 border-b border-line p-4">
        <input
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add an item to the manifest…"
        />
        <button className="btn-primary" onClick={addItem}>
          Add
        </button>
      </div>

      {/* Groups */}
      {trip.items.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-ink-soft">Your manifest is empty.</p>
          <p className="mt-1 font-mono text-xs text-ink-faint">
            Add items above or pull from suggestions.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="flex items-baseline gap-2 bg-paper-sunk px-4 py-1.5">
                <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-code text-ink-soft">
                  {group.label}
                </span>
                <span className="font-mono text-[0.625rem] tabular-nums text-ink-faint">
                  {group.items.length}
                </span>
              </h3>
              <div className="divide-y divide-line/60">
                {group.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    trip={trip}
                    update={update}
                    showCategory={groupBy !== 'category'}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
