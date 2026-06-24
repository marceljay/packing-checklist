import { useState } from 'react';
import type { Trip, Category } from '../types';
import { CATEGORIES, computeQuantity } from '../types';
import { rememberItem, editLibraryItem } from '../db/library';
import TagEditor from './TagEditor';

interface Props {
  update: (mutator: (draft: Trip) => void) => void;
  /** Known tag keys for autocomplete in the tag editor. */
  tagSuggestions?: string[];
}

/**
 * "Add custom item" — a dedicated card (above the packing list). Every item is a
 * library item now, so adding always resolves-or-creates the library row and the
 * trip stores only a reference. Re-adding an item already on the trip bumps its
 * quantity instead of duplicating.
 */
export default function AddItemCard({ update, tagSuggestions = [] }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Comfort & Misc');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  function add() {
    const clean = name.trim();
    if (!clean) return;
    const row = rememberItem(clean, category, tags);
    // Notes are a shared library field; persist them on the resolved row. May fork
    // a built-in default into a custom (editLibraryItem returns the effective id).
    const id = notes.trim() ? editLibraryItem(row.id, { notes }).id : row.id;
    // Start at the item's remembered default quantity (1 when it has none).
    const qty = computeQuantity(row.quantity ?? { kind: 'none' }, null, false);
    update((d) => {
      const existing = d.items.find((i) => i.libraryId === id);
      if (existing) {
        existing.quantityTaken += 1;
      } else {
        d.items.push({ libraryId: id, quantitySuggested: null, quantityTaken: qty, packed: false });
      }
    });
    setName('');
    setTags([]);
    setNotes('');
    // category stays sticky for the next add
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 p-4">
        <span aria-hidden className="h-4 w-1 rounded-full bg-vermilion" />
        <h2 className="font-display text-base font-bold">Add item</h2>
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
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <TagEditor value={tags} onChange={setTags} suggestions={tagSuggestions} ariaLabel="Tags for new item" />
          </div>
          <button className="btn-primary shrink-0" onClick={add} disabled={!name.trim()}>
            Add item
          </button>
        </div>
        <textarea
          className="input min-h-[3rem] resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes / description (optional)"
          aria-label="Notes for new item"
        />
        <p className="font-mono text-[0.625rem] text-ink-faint">
          Saved to your item library and reusable on future trips.
        </p>
      </div>
    </section>
  );
}
