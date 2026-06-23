import { useMemo, useState } from 'react';
import { useAppData } from '../db/store';
import { CATEGORIES, type Category, type LibraryItem } from '../types';
import { searchLibrary } from '../types';
import { rememberItem, editLibraryItem, forgetItemById, restoreDefaults } from '../db/library';
import TagEditor from '../components/TagEditor';
import { InfoIcon, EditIcon, DeleteIcon } from '../components/icons';

const byName = (a: LibraryItem, b: LibraryItem) => a.name.localeCompare(b.name);

/** Distinct tag keys across the library, sorted — for the filter row + autocomplete. */
function allTagKeys(library: LibraryItem[]): string[] {
  return [...new Set(library.flatMap((i) => i.tagKeys))].sort();
}

// ---------------------------------------------------------------------------
// Item row (read-only) + inline info / edit panels
// ---------------------------------------------------------------------------

function LibraryItemRow({ item, suggestions }: { item: LibraryItem; suggestions: string[] }) {
  const [panel, setPanel] = useState<'none' | 'info' | 'edit'>('none');

  if (panel === 'edit') {
    return (
      <li>
        <LibraryItemEdit item={item} suggestions={suggestions} onDone={() => setPanel('none')} />
      </li>
    );
  }

  return (
    <li className="flex flex-col">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-display text-sm font-medium text-ink">{item.name}</span>
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

        <div className="flex shrink-0 items-center gap-1">
          <button
            className="btn-ghost px-1.5 py-1"
            aria-label={`Info about ${item.name}`}
            aria-expanded={panel === 'info'}
            onClick={() => setPanel((p) => (p === 'info' ? 'none' : 'info'))}
          >
            <InfoIcon />
          </button>
          <button
            className="btn-ghost px-1.5 py-1"
            aria-label={`Edit ${item.name}`}
            onClick={() => setPanel('edit')}
          >
            <EditIcon />
          </button>
          <button
            className="btn-danger px-1.5 py-1"
            aria-label={`Remove ${item.name} from your library`}
            onClick={() => void forgetItemById(item.id)}
          >
            <DeleteIcon />
          </button>
        </div>
      </div>

      {panel === 'info' && (
        <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 border-t border-line bg-paper-sunk/40 px-4 py-3 text-sm">
          <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Type</dt>
          <dd className="text-ink-soft">{item.custom ? 'Custom' : 'Default'}</dd>
          <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Category</dt>
          <dd className="text-ink-soft">{item.category}</dd>
          {item.quantity?.kind === 'perTrip' && (
            <>
              <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Default qty</dt>
              <dd className="text-ink-soft">{item.quantity.count}</dd>
            </>
          )}
          {item.count > 0 && (
            <>
              <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Used</dt>
              <dd className="text-ink-soft">{item.count}×</dd>
            </>
          )}
          <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Notes</dt>
          <dd className="whitespace-pre-wrap text-ink-soft">{item.notes || '—'}</dd>
        </dl>
      )}
    </li>
  );
}

/** Inline edit form for a library row: name, category, tags, notes. */
function LibraryItemEdit({
  item,
  suggestions,
  onDone,
}: {
  item: LibraryItem;
  suggestions: string[];
  onDone: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<Category>(item.category);
  const [tags, setTags] = useState<string[]>(item.tagKeys);
  const [notes, setNotes] = useState(item.notes ?? '');
  // A fixed default quantity shows as a number; smart/none rules show blank.
  const initialQty = item.quantity?.kind === 'perTrip' ? String(item.quantity.count) : '';
  const [qty, setQty] = useState(initialQty);
  const [error, setError] = useState('');

  function save() {
    if (!name.trim()) return;
    const patch: Parameters<typeof editLibraryItem>[1] = { name, category, tagKeys: tags, notes };
    // Only touch quantity if the field changed, so untouched smart rules survive.
    if (qty !== initialQty) {
      const n = parseInt(qty, 10);
      patch.quantity = Number.isFinite(n) && n > 0 ? { kind: 'perTrip', count: n } : null;
    }
    const res = editLibraryItem(item.id, patch);
    if (!res.ok) {
      setError('Another item already has that name.');
      return;
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-2 bg-paper-sunk/40 px-4 py-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_11rem_5rem]">
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
        <input
          type="number"
          min="1"
          inputMode="numeric"
          className="input min-w-0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Qty"
          aria-label="Default quantity"
          title="Default quantity when added to a trip (blank = 1, or its built-in rule)"
        />
      </div>
      <TagEditor value={tags} onChange={setTags} suggestions={suggestions} ariaLabel={`Tags for ${item.name}`} />
      <textarea
        className="input min-h-[3rem] resize-y"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes / description (optional)"
        aria-label={`Notes for ${item.name}`}
      />
      {error && <p className="font-mono text-xs text-vermilion">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button className="btn-ghost text-xs" onClick={onDone}>
          Cancel
        </button>
        <button className="btn-primary text-xs" onClick={save} disabled={!name.trim()}>
          Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible category section
// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  forceOpen = false,
  children,
}: {
  title: React.ReactNode;
  count: number;
  /** Keep the section expanded regardless of the toggle (e.g. while filtering). */
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expanded = open || forceOpen;
  return (
    <section className="card overflow-hidden">
      <button
        className="flex w-full items-center gap-2 p-3 text-left"
        aria-expanded={expanded}
        disabled={forceOpen}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden className="font-mono text-ink-faint">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="font-display text-base font-bold">{title}</span>
        <span className="chip bg-paper-sunk text-ink-faint tabular-nums">{count}</span>
      </button>
      {expanded && <ul className="divide-y divide-line/60 border-t border-line">{children}</ul>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Add custom item
// ---------------------------------------------------------------------------

function AddItemForm({ suggestions }: { suggestions: string[] }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [tags, setTags] = useState<string[]>([]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    void rememberItem(trimmed, category, tags);
    setName('');
    setTags([]);
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
        className="grid gap-3 border-t border-line p-4 sm:grid-cols-[1fr_12rem_1fr_auto] sm:items-start"
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
          <span className="label mb-1 block">Tags</span>
          <TagEditor value={tags} onChange={setTags} suggestions={suggestions} ariaLabel="Tags for new item" />
        </div>
        <button type="submit" className="btn-primary sm:mt-[1.4rem]">
          Add
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ItemsPage() {
  const data = useAppData();
  const library = useMemo(
    () => data.library.map((r) => ({ ...r, tagKeys: r.tagKeys ?? [], custom: r.custom ?? true })),
    [data.library],
  );
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tagKeys = useMemo(() => allTagKeys(library), [library]);

  const results = useMemo(() => {
    let r = searchLibrary(library, query);
    if (selectedTags.length > 0) r = r.filter((i) => selectedTags.some((t) => i.tagKeys.includes(t)));
    return r;
  }, [library, query, selectedTags]);

  const filtering = query.trim() !== '' || selectedTags.length > 0;

  const categoryGroups = CATEGORIES.map((category) => ({
    category,
    items: results.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);

  function toggleTag(t: string) {
    setSelectedTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  return (
    <div className="flex flex-col gap-5 print:hidden">
      <AddItemForm suggestions={tagKeys} />

      {/* Search + restore defaults */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
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
        <button
          className="btn-secondary text-xs"
          onClick={() => void restoreDefaults()}
          title="Re-add any built-in default items you removed or edited (your custom items are untouched)"
        >
          Restore defaults
        </button>
      </div>

      {/* Tag filter */}
      {tagKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label mr-1">Filter</span>
          {tagKeys.map((t) => {
            const on = selectedTags.includes(t);
            return (
              <button
                key={t}
                aria-pressed={on}
                onClick={() => toggleTag(t)}
                className={`chip transition-colors ${
                  on ? 'bg-ink text-paper-raised' : 'bg-paper-sunk text-ink-soft hover:bg-line'
                }`}
              >
                {t}
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button className="btn-ghost px-2 py-0.5 text-xs" onClick={() => setSelectedTags([])}>
              Clear
            </button>
          )}
        </div>
      )}

      {library.length === 0 ? (
        <p className="text-sm text-ink-soft">No items yet — add one above.</p>
      ) : filtering && results.length === 0 ? (
        <p className="text-sm text-ink-soft">No items match your filter.</p>
      ) : (
        // Two-column masonry on wider screens, single column on phones. Multi-
        // column (not grid) so collapsing one card doesn't leave a tall gap.
        <div className="gap-3 [column-fill:balance] sm:columns-2 [&>section]:mb-3 [&>section]:break-inside-avoid">
          {categoryGroups.map((g) => (
            <Section key={g.category} title={g.category} count={g.items.length} forceOpen={filtering}>
              {[...g.items].sort(byName).map((item) => (
                <LibraryItemRow key={item.id} item={item} suggestions={tagKeys} />
              ))}
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}
