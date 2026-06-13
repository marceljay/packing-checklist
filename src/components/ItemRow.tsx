import type { Item, Trip } from '../types';
import { CATEGORIES, ITEM_STATUSES, ITEM_STATUS_LABELS } from '../types';

interface Props {
  item: Item;
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
}

export default function ItemRow({ item, trip, update }: Props) {
  function patch(fn: (it: Item) => void) {
    update((d) => {
      const target = d.items.find((x) => x.id === item.id);
      if (target) fn(target);
    });
  }

  const isPack = item.status === 'pack';
  const itemTags = trip.tags.filter((t) => item.tagIds.includes(t.id));
  const availableTags = trip.tags.filter((t) => !item.tagIds.includes(t.id));

  return (
    <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
      {/* Packed checkbox */}
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-500 focus:ring-brand-500 disabled:opacity-40"
        checked={item.packed}
        disabled={!isPack}
        aria-label={`Mark ${item.name} packed`}
        onChange={(e) => patch((it) => void (it.packed = e.target.checked))}
      />

      {/* Quantity stepper */}
      <div className="flex items-center gap-1" aria-label="Quantity">
        <button
          className="btn-secondary h-7 w-7 p-0"
          aria-label="Decrease quantity"
          onClick={() => patch((it) => void (it.quantityTaken = Math.max(1, it.quantityTaken - 1)))}
        >
          −
        </button>
        <span className="w-6 text-center text-sm tabular-nums">{item.quantityTaken}</span>
        <button
          className="btn-secondary h-7 w-7 p-0"
          aria-label="Increase quantity"
          onClick={() => patch((it) => void (it.quantityTaken = it.quantityTaken + 1))}
        >
          +
        </button>
      </div>

      {/* Name */}
      <input
        className={`input flex-1 ${item.packed && isPack ? 'text-slate-400 line-through' : ''}`}
        value={item.name}
        aria-label="Item name"
        onChange={(e) => patch((it) => void (it.name = e.target.value))}
      />

      {/* Meta controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className="input w-auto py-1 text-xs"
          aria-label="Category"
          value={item.category}
          onChange={(e) => patch((it) => void (it.category = e.target.value as Item['category']))}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="input w-auto py-1 text-xs"
          aria-label="Status"
          value={item.status}
          onChange={(e) =>
            patch((it) => {
              it.status = e.target.value as Item['status'];
              if (it.status !== 'pack') {
                it.packed = false;
                it.bagId = undefined;
              }
            })
          }
        >
          {ITEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ITEM_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {isPack && (
          <select
            className="input w-auto py-1 text-xs"
            aria-label="Bag"
            value={item.bagId ?? ''}
            onChange={(e) => patch((it) => void (it.bagId = e.target.value || undefined))}
          >
            <option value="">No bag</option>
            {trip.bags.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        {/* Tags */}
        {itemTags.map((t) => (
          <span key={t.id} className="chip bg-slate-200 text-slate-700">
            {t.label}
            <button
              className="ml-0.5 opacity-60 hover:opacity-100"
              aria-label={`Remove tag ${t.label} from ${item.name}`}
              onClick={() => patch((it) => void (it.tagIds = it.tagIds.filter((id) => id !== t.id)))}
            >
              ✕
            </button>
          </span>
        ))}
        {availableTags.length > 0 && (
          <select
            className="input w-auto py-1 text-xs"
            aria-label="Add tag to item"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) patch((it) => void it.tagIds.push(id));
            }}
          >
            <option value="">+ tag</option>
            {availableTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}

        <button
          className="btn-danger px-1.5 py-1"
          aria-label={`Delete ${item.name}`}
          onClick={() => update((d) => void (d.items = d.items.filter((x) => x.id !== item.id)))}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
