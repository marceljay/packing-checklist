import { useState } from 'react';
import type { Item, Trip, Category } from '../types';
import { CATEGORIES, tagKey, ensureTripTags } from '../types';
import { uid } from '../db/db';
import { rememberItem } from '../db/library';

interface Props {
  update: (mutator: (draft: Trip) => void) => void;
}

/**
 * "Add custom item" — a dedicated card (above the packing list) for adding an
 * item with a chosen category and tags, optionally saving it to the library.
 */
export default function AddItemCard({ update }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Comfort & Misc');
  const [tagInput, setTagInput] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(true);

  function add() {
    const clean = name.trim();
    if (!clean) return;
    const keys = tagInput
      .split(',')
      .map((t) => tagKey(t))
      .filter(Boolean);
    update((d) => {
      const { tags, tagIds } = ensureTripTags(d.tags, keys, uid);
      d.tags = tags;
      const item: Item = {
        id: uid(),
        name: clean,
        category,
        tagIds,
        quantitySuggested: null,
        quantityTaken: 1,
        packed: false,
        source: 'custom',
      };
      d.items.push(item);
    });
    if (saveToLibrary) void rememberItem(clean, category, keys);
    setName('');
    setTagInput('');
    // category + save preference stay sticky for the next add
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 p-4">
        <span aria-hidden className="h-4 w-1 rounded-full bg-vermilion" />
        <h2 className="font-display text-base font-bold">Add custom item</h2>
      </div>
      <div className="flex flex-col gap-3 border-t border-line p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
          <input
            className="input min-w-0"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Item name"
            aria-label="Item name"
          />
          <select
            className="input min-w-0"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            aria-label="Category"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <input
          className="input"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Tags (comma-separated, optional)"
          aria-label="Tags, comma-separated"
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 rounded border-line text-vermilion focus:ring-vermilion"
              checked={saveToLibrary}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
            />
            <span className="font-mono text-[0.6875rem] text-ink-soft">Save to my items</span>
          </label>
          <button className="btn-primary shrink-0" onClick={add} disabled={!name.trim()}>
            Add item
          </button>
        </div>
      </div>
    </section>
  );
}
