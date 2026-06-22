import { useMemo, useState } from 'react';
import { useAppData } from '../db/store';
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
  rememberItem,
  updateItemById,
  renameLibraryItemById,
  forgetItemById,
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
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <LibraryItemEdit item={item} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-medium text-ink">{item.name}</span>
          {!item.custom && (
            <span className="chip shrink-0 bg-paper-sunk text-ink-faint">default</span>
          )}
          <span className="chip bg-paper-sunk font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
            {item.category}
          </span>
        </div>
        {item.tagKeys.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tagKeys.map((k) => (
              <span key={k} className="chip bg-airblue-soft text-airblue">
                {k}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.count > 0 && (
          <span className="font-mono text-[0.625rem] text-ink-faint">used {item.count}×</span>
        )}
        <button
          className="btn-ghost px-1.5 py-1"
          aria-label={`Edit ${item.name}`}
          onClick={() => setEditing(true)}
        >
          ✎
        </button>
        <button
          className="btn-danger px-1.5 py-1"
          aria-label={`Remove ${item.name} from your library`}
          onClick={() => void forgetItemById(item.id)}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

/** Inline edit form for a library row: name, category, comma-separated tags. */
function LibraryItemEdit({ item, onDone }: { item: LibraryItem; onDone: () => void }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<Category>(item.category);
  const [tagInput, setTagInput] = useState(item.tagKeys.join(', '));
  const [error, setError] = useState('');

  async function save() {
    const clean = name.trim();
    if (!clean) return;
    const tagKeys = [...new Set(tagInput.split(',').map((t) => tagKey(t)).filter(Boolean))];
    if (clean !== item.name) {
      const ok = await renameLibraryItemById(item.id, clean);
      if (!ok) {
        setError('Another item already has that name.');
        return;
      }
    }
    await updateItemById(item.id, { category, tagKeys });
    onDone();
  }

  return (
    <div className="flex flex-col gap-2 bg-paper-sunk/40 px-4 py-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <input
          className="input min-w-0"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Item name"
          autoFocus
        />
        <select
          className="input min-w-0"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          aria-label="Category"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <input
        className="input"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        placeholder="Tags (comma-separated)"
        aria-label={`Tags for ${item.name}`}
      />
      {error && <p className="font-mono text-xs text-vermilion">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button className="btn-ghost text-xs" onClick={onDone}>
          Cancel
        </button>
        <button className="btn-primary text-xs" onClick={() => void save()} disabled={!name.trim()}>
          Save
        </button>
      </div>
    </div>
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
      const orig = allItems.find((i) => i.id === next.id);
      if (orig && !sameKeys(orig.tagKeys, next.tagKeys)) {
        void updateItemById(next.id, { tagKeys: next.tagKeys });
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
  const data = useAppData();
  const library = useMemo(
    () => data.library.map((r) => ({ ...r, tagKeys: r.tagKeys ?? [], custom: r.custom ?? true })),
    [data.library],
  );
  const [view, setView] = useState<View>('category');
  const [query, setQuery] = useState('');

  const results = searchLibrary(library, query);
  const searching = query.trim() !== '';

  const categoryGroups = CATEGORIES.map((category) => ({
    category,
    items: results.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-5 print:hidden">
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
