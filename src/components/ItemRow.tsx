import type { Item, Trip } from '../types';
import { CATEGORIES } from '../types';

interface Props {
  item: Item;
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
  /** Show the per-row category control (hidden when the list is grouped by it). */
  showCategory?: boolean;
}

export default function ItemRow({ item, trip, update, showCategory = false }: Props) {
  function patch(fn: (it: Item) => void) {
    update((d) => {
      const target = d.items.find((x) => x.id === item.id);
      if (target) fn(target);
    });
  }

  const itemTags = trip.tags.filter((t) => item.tagIds.includes(t.id));
  const availableTags = trip.tags.filter((t) => !item.tagIds.includes(t.id));
  const hasMeta = showCategory || itemTags.length > 0 || availableTags.length > 0;

  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-2.5 transition-colors ${
        item.packed ? 'bg-paper-sunk/40' : 'hover:bg-paper-sunk/40'
      }`}
    >
      {/* Packed checkbox */}
      <input
        type="checkbox"
        className="mt-1.5 h-5 w-5 shrink-0 rounded border-line text-vermilion focus:ring-vermilion"
        checked={item.packed}
        aria-label={`Mark ${item.name} packed`}
        onChange={(e) => patch((it) => void (it.packed = e.target.checked))}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Line 1: name + quantity */}
        <div className="flex items-center gap-2">
          <input
            className={`input min-w-0 flex-1 ${item.packed ? 'text-ink-faint line-through' : ''}`}
            value={item.name}
            aria-label="Item name"
            onChange={(e) => patch((it) => void (it.name = e.target.value))}
          />
          <div className="flex shrink-0 items-center gap-1" aria-label="Quantity">
            <button
              className="btn-secondary h-7 w-7 p-0 text-base leading-none"
              aria-label="Decrease quantity"
              onClick={() =>
                patch((it) => void (it.quantityTaken = Math.max(1, it.quantityTaken - 1)))
              }
            >
              −
            </button>
            <span className="w-5 text-center font-mono text-sm tabular-nums">
              {item.quantityTaken}
            </span>
            <button
              className="btn-secondary h-7 w-7 p-0 text-base leading-none"
              aria-label="Increase quantity"
              onClick={() => patch((it) => void (it.quantityTaken = it.quantityTaken + 1))}
            >
              +
            </button>
          </div>
        </div>

        {/* Line 2: secondary meta — category (when shown) + tags */}
        {hasMeta && (
          <div className="flex flex-wrap items-center gap-1.5">
            {showCategory && (
              <select
                className="input w-auto max-w-[11rem] py-1 font-mono text-xs"
                aria-label="Category"
                value={item.category}
                onChange={(e) =>
                  patch((it) => void (it.category = e.target.value as Item['category']))
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {itemTags.map((t) => (
              <span key={t.id} className="chip bg-paper-sunk text-ink-soft">
                {t.label}
                <button
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  aria-label={`Remove tag ${t.label} from ${item.name}`}
                  onClick={() =>
                    patch((it) => void (it.tagIds = it.tagIds.filter((id) => id !== t.id)))
                  }
                >
                  ✕
                </button>
              </span>
            ))}

            {availableTags.length > 0 && (
              <select
                className="input w-auto py-1 font-mono text-xs"
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
          </div>
        )}
      </div>

      <button
        className="btn-danger mt-0.5 shrink-0 px-1.5 py-1"
        aria-label={`Delete ${item.name}`}
        onClick={() => update((d) => void (d.items = d.items.filter((x) => x.id !== item.id)))}
      >
        ✕
      </button>
    </div>
  );
}
