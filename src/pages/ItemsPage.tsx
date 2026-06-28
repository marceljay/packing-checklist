import { useMemo, useState } from 'react';
import { useAppData } from '../db/store';
import { orderedCategories, type Category, type LibraryItem } from '../types';
import { searchLibrary } from '../types';
import { rememberItem, editLibraryItem, forgetItemById } from '../db/library';
import TagEditor from '../components/TagEditor';
import TagCategoryManager from '../components/TagCategoryManager';
import { categoriesFrom } from '../db/categories';
import Select from '../components/Select';
import ConfirmDialog from '../components/ConfirmDialog';
import { InfoIcon, EditIcon, DeleteIcon } from '../components/icons';

const byName = (a: LibraryItem, b: LibraryItem) => a.name.localeCompare(b.name);

/** Distinct tag keys across the library, sorted — for the filter row + autocomplete. */
function allTagKeys(library: LibraryItem[]): string[] {
  return [...new Set(library.flatMap((i) => i.tagKeys))].sort();
}

// ---------------------------------------------------------------------------
// Item row (read-only) + inline info / edit panels
// ---------------------------------------------------------------------------

function LibraryItemRow({
  item,
  suggestions,
  categories,
}: {
  item: LibraryItem;
  suggestions: string[];
  categories: Category[];
}) {
  const [panel, setPanel] = useState<'none' | 'info' | 'edit'>('none');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (panel === 'edit') {
    return (
      <li>
        <LibraryItemEdit
          item={item}
          suggestions={suggestions}
          categories={categories}
          onDone={() => setPanel('none')}
        />
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
            onClick={() => setConfirmDelete(true)}
          >
            <DeleteIcon />
          </button>
        </div>
      </div>

      {panel === 'info' && (
        <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 border-t border-line bg-paper-sunk/40 px-4 py-3 text-sm">
          <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Type</dt>
          <dd className="text-ink-soft">{item.custom ? 'User created (Custom)' : 'App default item'}</dd>
          <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Category</dt>
          <dd className="text-ink-soft">{item.category}</dd>
          {item.essential && (
            <>
              <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Essential</dt>
              <dd className="text-ink-soft">Suggested on every trip</dd>
            </>
          )}
          {item.quantity?.kind === 'perTrip' && (
            <>
              <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Default qty</dt>
              <dd className="text-ink-soft">{item.quantity.count}</dd>
            </>
          )}
          {typeof item.weight === 'number' && (
            <>
              <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Weight</dt>
              <dd className="text-ink-soft">{item.weight} g</dd>
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

      {confirmDelete && (
        <ConfirmDialog
          title={`Remove “${item.name}”?`}
          confirmLabel="Remove item"
          tone="danger"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            forgetItemById(item.id);
            setConfirmDelete(false);
          }}
        >
          <p>
            Removes <strong>{item.name}</strong> from your library. It stays on any trip that
            already has it.{item.custom ? '' : ' You can bring built-in items back with “Return to defaults”.'}
          </p>
        </ConfirmDialog>
      )}
    </li>
  );
}

/** Inline edit form for a library row: name, category, tags, notes. */
function LibraryItemEdit({
  item,
  suggestions,
  categories,
  onDone,
}: {
  item: LibraryItem;
  suggestions: string[];
  categories: Category[];
  onDone: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<Category>(item.category);
  const [tags, setTags] = useState<string[]>(item.tagKeys);
  const [notes, setNotes] = useState(item.notes ?? '');
  // A fixed default quantity shows as a number; smart/none rules show blank.
  const initialQty = item.quantity?.kind === 'perTrip' ? String(item.quantity.count) : '';
  const [qty, setQty] = useState(initialQty);
  const initialWeight = item.weight != null ? String(item.weight) : '';
  const [weight, setWeight] = useState(initialWeight);
  const [essential, setEssential] = useState(item.essential === true);
  const [error, setError] = useState('');

  function save() {
    if (!name.trim()) return;
    const patch: Parameters<typeof editLibraryItem>[1] = {
      name,
      category,
      tagKeys: tags,
      notes,
      essential,
    };
    // Only touch quantity if the field changed, so untouched smart rules survive.
    if (qty !== initialQty) {
      const n = parseInt(qty, 10);
      patch.quantity = Number.isFinite(n) && n > 0 ? { kind: 'perTrip', count: n } : null;
    }
    if (weight !== initialWeight) {
      const w = parseInt(weight, 10);
      patch.weight = Number.isFinite(w) && w > 0 ? w : null;
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
      <div className="grid gap-2 sm:grid-cols-[1fr_11rem_5rem_6rem]">
        <input
          className="input min-w-0"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Item name"
          autoFocus
        />
        <Select
          className="min-w-0"
          value={category}
          onChange={(v) => setCategory(v as Category)}
          options={categories}
          ariaLabel="Category"
        />
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
        <input
          type="number"
          min="1"
          inputMode="numeric"
          className="input min-w-0"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Weight g"
          aria-label="Weight in grams"
          title="Per-unit weight in grams (blank = unset)"
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-line text-vermilion focus:ring-vermilion"
          checked={essential}
          onChange={(e) => setEssential(e.target.checked)}
        />
        <span>
          Essential
          <span className="ml-1.5 text-xs text-ink-faint">suggested on every trip</span>
        </span>
      </label>
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

function AddItemForm({ suggestions, categories }: { suggestions: string[]; categories: Category[] }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(categories[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [weight, setWeight] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const row = rememberItem(trimmed, category, tags);
    const w = parseInt(weight, 10);
    if (Number.isFinite(w) && w > 0) editLibraryItem(row.id, { weight: w });
    setName('');
    setTags([]);
    setWeight('');
    setCategory(categories[0]);
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 p-4">
        <span aria-hidden className="h-4 w-1 rounded-full bg-vermilion" />
        <h2 className="font-display text-base font-bold">Add custom item</h2>
      </div>
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 border-t border-line p-4 sm:grid-cols-[1fr_12rem_1fr_6rem_auto] sm:items-start"
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
          <Select
            id="add-item-category"
            value={category}
            onChange={(v) => setCategory(v as Category)}
            options={categories}
            ariaLabel="Category"
          />
        </div>
        <div>
          <span className="label mb-1 block">Tags</span>
          <TagEditor value={tags} onChange={setTags} suggestions={suggestions} ariaLabel="Tags for new item" />
        </div>
        <div>
          <label className="label mb-1" htmlFor="add-item-weight">
            Weight (g)
          </label>
          <input
            id="add-item-weight"
            type="number"
            min="1"
            inputMode="numeric"
            className="input"
            placeholder="e.g. 150"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
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
  const [essentialOnly, setEssentialOnly] = useState(false);
  // Whether the tag & category manager dialog is open.
  const [managerOpen, setManagerOpen] = useState(false);

  const tagKeys = useMemo(() => allTagKeys(library), [library]);
  // Built-in (minus deleted) + custom + item-only categories, from the registry,
  // so added/imported categories are pickable in the add/edit forms.
  const categoryOptions = useMemo(() => categoriesFrom(data), [data]);
  const hasEssentials = useMemo(() => library.some((i) => i.essential), [library]);

  const results = useMemo(() => {
    let r = searchLibrary(library, query);
    if (selectedTags.length > 0) r = r.filter((i) => selectedTags.some((t) => i.tagKeys.includes(t)));
    if (essentialOnly) r = r.filter((i) => i.essential);
    return r;
  }, [library, query, selectedTags, essentialOnly]);

  const filtering = query.trim() !== '' || selectedTags.length > 0 || essentialOnly;

  const categoryGroups = orderedCategories(results.map((i) => i.category))
    .map((category) => ({
      category,
      items: results.filter((i) => i.category === category),
    }))
    .filter((g) => g.items.length > 0);

  function toggleTag(t: string) {
    setSelectedTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  return (
    <div className="flex flex-col gap-5 print:hidden">
      <AddItemForm suggestions={tagKeys} categories={categoryOptions} />

      {/* Search */}
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
        <button className="btn-secondary shrink-0 text-sm" onClick={() => setManagerOpen(true)}>
          Edit tags &amp; categories
        </button>
      </div>

      {/* Tag filter — plus a special "essentials" chip (essential is a property,
          not a tag, but it filters here alongside tags). */}
      {(tagKeys.length > 0 || hasEssentials) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label mr-1">Filter</span>
          {hasEssentials && (
            <button
              aria-pressed={essentialOnly}
              onClick={() => setEssentialOnly((v) => !v)}
              className={`chip transition-colors ${
                essentialOnly
                  ? 'bg-vermilion text-paper-raised'
                  : 'bg-vermilion-soft text-vermilion-deep hover:bg-vermilion/20'
              }`}
            >
              essentials
            </button>
          )}
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
          {(selectedTags.length > 0 || essentialOnly) && (
            <button
              className="btn-ghost px-2 py-0.5 text-xs"
              onClick={() => {
                setSelectedTags([]);
                setEssentialOnly(false);
              }}
            >
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
                <LibraryItemRow
                  key={item.id}
                  item={item}
                  suggestions={tagKeys}
                  categories={categoryOptions}
                />
              ))}
            </Section>
          ))}
        </div>
      )}

      {managerOpen && <TagCategoryManager onClose={() => setManagerOpen(false)} />}
    </div>
  );
}
