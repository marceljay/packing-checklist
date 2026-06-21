import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CATEGORIES,
  tagKey,
  renameLibraryTag,
  removeLibraryTag,
  type Category,
  type LibraryItem,
} from '../types';
import {
  listLibrary,
  rememberItem,
  updateItem,
  renameLibraryItem,
  forgetItem,
} from '../db/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect every distinct tag key that appears across all library items. */
function allTagKeys(items: LibraryItem[]): string[] {
  return [...new Set(items.flatMap((i) => i.tagKeys))].sort();
}

/** Order-sensitive key-list equality (the transforms preserve order). */
function sameKeys(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ItemRowProps {
  item: LibraryItem;
}

function LibraryItemRow({ item }: ItemRowProps) {
  // Inline edit state — starts from the live item so edits survive re-renders.
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState<Category>(item.category);
  const [newTag, setNewTag] = useState('');

  /**
   * Renaming re-keys the row (see `renameLibraryItem`) so `nameKey` always equals
   * `tagKey(name)` — the tray exclusion and de-duping rely on that invariant.
   * Renaming onto an existing item's name merges the two.
   */
  function handleNameBlur() {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditName(item.name); // revert if cleared
      return;
    }
    if (trimmed !== item.name) {
      void renameLibraryItem(item.nameKey, trimmed);
    }
  }

  function handleCategoryChange(cat: Category) {
    setEditCategory(cat);
    void updateItem(item.nameKey, { category: cat });
  }

  function handleRemoveTag(key: string) {
    const next = item.tagKeys.filter((k) => k !== key);
    void updateItem(item.nameKey, { tagKeys: next });
  }

  function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    const k = tagKey(newTag);
    if (!k || item.tagKeys.includes(k)) {
      setNewTag('');
      return;
    }
    void updateItem(item.nameKey, { tagKeys: [...item.tagKeys, k] });
    setNewTag('');
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      {/* Name + category */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <input
          className="input"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleNameBlur}
          aria-label="Item name"
        />
        <select
          className="input"
          value={editCategory}
          onChange={(e) => handleCategoryChange(e.target.value as Category)}
          aria-label="Category"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1">
          {item.tagKeys.map((k) => (
            <span
              key={k}
              className="chip bg-airblue-soft text-airblue"
            >
              {k}
              <button
                onClick={() => handleRemoveTag(k)}
                aria-label={`Remove tag ${k}`}
                className="ml-0.5 rounded-full text-airblue/70 hover:text-airblue"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={handleAddTag} className="flex gap-1.5">
          <input
            className="input"
            placeholder="Add tag…"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            aria-label="New tag"
          />
          <button type="submit" className="btn-secondary shrink-0">
            Add
          </button>
        </form>
      </div>

      {/* Count + remove */}
      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
        <span className="font-mono text-[0.6875rem] text-ink-faint">
          used {item.count}×
        </span>
        <button
          className="btn-danger text-xs"
          aria-label={`Remove ${item.name} from your items`}
          onClick={() => void forgetItem(item.nameKey)}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Tags management section
// ---------------------------------------------------------------------------

interface TagsManagerProps {
  items: LibraryItem[];
}

function TagsManager({ items }: TagsManagerProps) {
  const tags = allTagKeys(items);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (tags.length === 0) return null;

  function handleRename(fromKey: string) {
    const toKey = tagKey(renameValue);
    if (!toKey || toKey === fromKey) {
      setEditingKey(null);
      return;
    }
    // Compute next state for each affected item then persist the changed ones.
    const updated = renameLibraryTag(items, fromKey, toKey);
    for (const next of updated) {
      const orig = items.find((i) => i.nameKey === next.nameKey);
      if (orig && !sameKeys(orig.tagKeys, next.tagKeys)) {
        void updateItem(next.nameKey, { tagKeys: next.tagKeys });
      }
    }
    setEditingKey(null);
    setRenameValue('');
  }

  function handleRemove(key: string) {
    const updated = removeLibraryTag(items, key);
    for (const next of updated) {
      const orig = items.find((i) => i.nameKey === next.nameKey);
      if (orig && !sameKeys(orig.tagKeys, next.tagKeys)) {
        void updateItem(next.nameKey, { tagKeys: next.tagKeys });
      }
    }
  }

  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 p-4">
        <span aria-hidden className="h-4 w-1 rounded-full bg-airblue" />
        <h2 className="font-display text-base font-bold">Tags</h2>
        <span className="chip bg-airblue-soft text-airblue tabular-nums">{tags.length}</span>
      </div>
      <ul className="divide-y divide-line/60 border-t border-line">
        {tags.map((key) => (
          <li key={key} className="flex items-center gap-3 px-4 py-2">
            {editingKey === key ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRename(key);
                }}
              >
                <input
                  autoFocus
                  className="input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  aria-label={`Rename tag ${key}`}
                />
                <button type="submit" className="btn-secondary shrink-0">
                  Save
                </button>
                <button
                  type="button"
                  className="btn-ghost shrink-0"
                  onClick={() => setEditingKey(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="chip bg-airblue-soft text-airblue">{key}</span>
                <button
                  className="btn-ghost ml-auto text-xs"
                  aria-label={`Rename tag ${key}`}
                  onClick={() => {
                    setEditingKey(key);
                    setRenameValue(key);
                  }}
                >
                  Rename
                </button>
                <button
                  className="btn-danger text-xs"
                  aria-label={`Remove tag ${key}`}
                  onClick={() => handleRemove(key)}
                >
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Add item form
// ---------------------------------------------------------------------------

function AddItemForm() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [tagInput, setTagInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const tagKeys = tagInput
      .split(',')
      .map((t) => tagKey(t))
      .filter(Boolean);
    void rememberItem(trimmed, category, tagKeys);
    setName('');
    setTagInput('');
    setCategory(CATEGORIES[0]);
  }

  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 p-4">
        <span aria-hidden className="h-4 w-1 rounded-full bg-vermilion" />
        <h2 className="font-display text-base font-bold">Add an item</h2>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-line p-4">
        <div>
          <label className="label mb-1" htmlFor="add-item-name">
            Name
          </label>
          <input
            id="add-item-name"
            className="input"
            placeholder="e.g. Packing cubes"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label mb-1" htmlFor="add-item-category">
            Category
          </label>
          <select
            id="add-item-category"
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-1" htmlFor="add-item-tags">
            Tags (comma-separated, optional)
          </label>
          <input
            id="add-item-tags"
            className="input"
            placeholder="e.g. hiking, camping"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary self-start">
          Save item
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ItemsPage() {
  const library = useLiveQuery(listLibrary, [], undefined);

  if (library === undefined) {
    return (
      <div className="py-16 text-center font-mono text-sm text-ink-faint print:hidden">
        Loading…
      </div>
    );
  }

  if (library.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center print:hidden">
        <p className="label mb-3">Your items</p>
        <h1 className="mb-4 font-display text-2xl font-bold">Nothing saved yet</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Items you add on a trip are remembered here so they resurface next time.
          Head to a trip and use the checklist to start building your library.
        </p>
        <Link to="/" className="btn-primary">
          Go to your trips
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 print:hidden">
      <div>
        <p className="label">Library</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Your items</h1>
      </div>

      {/* Items list */}
      <section className="card flex flex-col overflow-hidden">
        <div className="flex items-center gap-2.5 p-4">
          <span aria-hidden className="h-4 w-1 rounded-full bg-airblue" />
          <h2 className="font-display text-base font-bold">Saved items</h2>
          <span className="chip bg-airblue-soft text-airblue tabular-nums">{library.length}</span>
        </div>
        <ul className="divide-y divide-line/60 border-t border-line">
          {library.map((item) => (
            <LibraryItemRow key={item.nameKey} item={item} />
          ))}
        </ul>
      </section>

      <TagsManager items={library} />

      <AddItemForm />
    </div>
  );
}
