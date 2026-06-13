import { useMemo, useState } from 'react';
import type { Item, Trip } from '../types';
import { CATEGORIES } from '../types';
import { uid } from '../db/db';
import ItemRow from './ItemRow';

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
}

type GroupBy = 'category' | 'bag' | 'tag';

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
      status: 'pack',
      quantitySuggested: null,
      quantityTaken: 1,
      packed: false,
      source: 'custom',
    };
    update((d) => void d.items.push(item));
    setNewName('');
  }

  const groups = useMemo<Group[]>(() => {
    const items = trip.items;
    if (groupBy === 'category') {
      return CATEGORIES.map((cat) => ({
        key: cat,
        label: cat,
        items: items.filter((i) => i.category === cat),
      })).filter((g) => g.items.length > 0);
    }
    if (groupBy === 'bag') {
      const out: Group[] = trip.bags.map((b) => ({
        key: b.id,
        label: b.name,
        items: items.filter((i) => i.status === 'pack' && i.bagId === b.id),
      }));
      out.push({
        key: '__unassigned',
        label: 'Unassigned / not packing',
        items: items.filter((i) => i.status !== 'pack' || !i.bagId),
      });
      return out.filter((g) => g.items.length > 0);
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
  }, [trip.items, trip.bags, trip.tags, groupBy]);

  const packCount = trip.items.filter((i) => i.status === 'pack').length;
  const packedCount = trip.items.filter((i) => i.status === 'pack' && i.packed).length;

  return (
    <section className="card flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <h2 className="font-semibold">Checklist</h2>
        {packCount > 0 && (
          <span className="text-xs text-slate-500">
            {packedCount}/{packCount} packed
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 text-xs">
          <span className="text-slate-400">Group by</span>
          {(['category', 'bag', 'tag'] as GroupBy[]).map((g) => (
            <button
              key={g}
              className={`rounded px-2 py-1 capitalize ${
                groupBy === g ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
              onClick={() => setGroupBy(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Add item */}
      <div className="flex gap-2 border-b border-slate-100 p-3">
        <input
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add an item…"
        />
        <button className="btn-primary" onClick={addItem}>
          Add
        </button>
      </div>

      {/* Groups */}
      {trip.items.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-slate-400">
          No items yet. Add one above.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.label}{' '}
                <span className="font-normal normal-case text-slate-400">
                  ({group.items.length})
                </span>
              </h3>
              <div className="divide-y divide-slate-50">
                {group.items.map((item) => (
                  <ItemRow key={item.id} item={item} trip={trip} update={update} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
