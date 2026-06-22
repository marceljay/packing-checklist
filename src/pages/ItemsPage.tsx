import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CATEGORIES,
  tagKey,
  libraryByTag,
  searchLibrary,
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

type View = 'category' | 'tag' | 'all';

/** Order-sensitive key-list equality (the tag transforms preserve order). */
function sameKeys(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const byName = (a: LibraryItem, b: LibraryItem) => a.name.localeCompare(b.name);

// ---------------------------------------------------------------------------
// Item row
// ---------------------------------------------------------------------------

function LibraryItemRow({ item }: { item: LibraryItem }) {
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState<Category>(item.category);
  const [newTag, setNewTag] = useState('');

  function handleNameBlur() {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditName(item.name);
      return;
    }
    // Re-keys the row (renameLibraryItem) so nameKey === tagKey(name) holds.
    if (trimmed !== item.name) void renameLibraryItem(item.nameKey, trimmed);
  }

  function handleCategoryChange(cat: Category) {
    setEditCategory(cat);
    void updateItem(item.nameKey, { category: cat });
  }

  function handleRemoveTag(key: string) {
    void updateItem(item.nameKey, { tagKeys: item.tagKeys.filter((k) => k !== key) });
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
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            className="input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameBlur}
            aria-label="Item name"
          />
          {!item.custom && (
            <span className="chip shrink-0 bg-paper-sunk text-ink-faint">default</span>
          )}
        </div>
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

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1">
          {item.tagKeys.map((k) => (
            <span key={k} className="chip bg-airblue-soft text-airblue">
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
            aria-label={`Add a tag to ${item.name}`}
          />
          <button type="submit" className="btn-secondary shrink-0">
            Add
          </button>
        </form>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
        <span className="font-mono text-[0.6875rem] text-ink-faint">used {item.count}×</span>
        <button
          className="btn-danger text-xs"
          aria-label={`Remove ${item.name} from your library`}
          onClick={() => void forgetItem(item.nameKey)}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  headerExtra,
  children,
}: {
  title: React.ReactNode;
  count: number;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 p-3">
        <button
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden className="font-mono text-ink-faint">
            {open ? '▾' : '▸'}
          </span>
          <span className="truncate font-display text-base font-bold">{title}</span>
          <span className="chip bg-paper-sunk text-ink-faint tabular-nums">{count}</span>
        </button>
        {headerExtra}
      </div>
      {open && <ul className="divide-y divide-line/60 border-t border-line">{children}</ul>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tag section (by-tag view) — header carries rename/remove for the whole library
// ---------------------------------------------------------------------------

function TagSection({
  tag,
  items,
  allItems,
}: {
  tag: string;
  items: LibraryItem[];
  allItems: LibraryItem[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tag);

  function persist(updated: LibraryItem[]) {
    for (const next of updated) {
      const orig = allItems.find((i) => i.nameKey === next.nameKey);
      if (orig && !sameKeys(orig.tagKeys, next.tagKeys)) {
        void updateItem(next.nameKey, { tagKeys: next.tagKeys });
      }
    }
  }

  function handleRename() {
    const toKey = tagKey(value);
    if (!toKey || toKey === tag) {
      setEditing(false);
      return;
    }
    persist(renameLibraryTag(allItems, tag, toKey));
    setEditing(false);
  }

  const untagged = tag === '';
  const headerExtra = untagged ? undefined : editing ? (
    <form
      className="flex shrink-0 gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        handleRename();
      }}
    >
      <input
        autoFocus
        className="input w-28"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Rename tag ${tag}`}
      />
      <button type="submit" className="btn-secondary shrink-0 text-xs">
        Save
      </button>
      <button type="button" className="btn-ghost shrink-0 text-xs" onClick={() => setEditing(false)}>
        Cancel
      </button>
    </form>
  ) : (
    <div className="flex shrink-0 gap-1">
      <button
        className="btn-ghost text-xs"
        aria-label={`Rename tag ${tag}`}
        onClick={() => {
          setValue(tag);
          setEditing(true);
        }}
      >
        Rename
      </button>
      <button
        className="btn-danger text-xs"
        aria-label={`Remove tag ${tag}`}
        onClick={() => persist(removeLibraryTag(allItems, tag))}
      >
        Remove
      </button>
    </div>
  );

  return (
    <Section title={untagged ? 'Untagged' : tag} count={items.length} headerExtra={headerExtra}>
      {[...items].sort(byName).map((item) => (
        <LibraryItemRow key={item.nameKey} item={item} />
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Add custom item
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
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 p-4">
        <span aria-hidden className="h-4 w-1 rounded-full bg-vermilion" />
        <h2 className="font-display text-base font-bold">Add custom item</h2>
      </div>
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 border-t border-line p-4 sm:grid-cols-[1fr_12rem_1fr_auto] sm:items-end"
      >
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
            Tags (comma-separated)
          </label>
          <input
            id="add-item-tags"
            className="input"
            placeholder="e.g. hiking, camping"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary">
          Add
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const VIEWS: { key: View; label: string }[] = [
  { key: 'category', label: 'By category' },
  { key: 'tag', label: 'By tag' },
  { key: 'all', label: 'All items' },
];

export default function ItemsPage() {
  const library = useLiveQuery(listLibrary, [], undefined);
  const [view, setView] = useState<View>('category');
  const [query, setQuery] = useState('');

  if (library === undefined) {
    return (
      <div className="py-16 text-center font-mono text-sm text-ink-faint print:hidden">Loading…</div>
    );
  }

  const results = searchLibrary(library, query);
  const searching = query.trim() !== '';

  const categoryGroups = CATEGORIES.map((category) => ({
    category,
    items: results.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-5 print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Library</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Item library</h1>
        </div>
        <Link to="/" className="btn-ghost text-xs">
          ← All trips
        </Link>
      </div>

      <AddItemForm />

      {/* View switcher + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex w-fit items-center gap-1 rounded bg-paper-sunk p-0.5"
          role="tablist"
          aria-label="Library view"
        >
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              className={`rounded px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-wide transition-colors ${
                view === v.key
                  ? 'bg-ink text-paper-raised'
                  : 'text-ink-faint hover:bg-paper-sunk hover:text-ink'
              }`}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="search"
            className="input pl-8"
            placeholder="Search items, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search items"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-faint"
          >
            ⌕
          </span>
        </div>
      </div>

      {library.length === 0 ? (
        <p className="text-sm text-ink-soft">No items yet — add one above.</p>
      ) : searching && results.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No items match “{query.trim()}”.
        </p>
      ) : view === 'category' ? (
        <div className="flex flex-col gap-3">
          {categoryGroups.map((g) => (
            <Section key={g.category} title={g.category} count={g.items.length}>
              {[...g.items].sort(byName).map((item) => (
                <LibraryItemRow key={item.nameKey} item={item} />
              ))}
            </Section>
          ))}
        </div>
      ) : view === 'tag' ? (
        <div className="flex flex-col gap-3">
          {libraryByTag(results).map((g) => (
            <TagSection key={g.tag || '__untagged'} tag={g.tag} items={g.items} allItems={library} />
          ))}
        </div>
      ) : (
        <Section title={searching ? 'Results' : 'All items'} count={results.length}>
          {[...results].sort(byName).map((item) => (
            <LibraryItemRow key={item.nameKey} item={item} />
          ))}
        </Section>
      )}
    </div>
  );
}
