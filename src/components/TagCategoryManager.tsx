import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TagGroup } from '../types';
import { useAppData } from '../db/store';
import {
  listCategories,
  addCategory,
  renameCategory,
  deleteCategory,
  FALLBACK_CATEGORY,
} from '../db/categories';
import TagEditorDialog from './TagEditorDialog';
import ConfirmDialog from './ConfirmDialog';
import { EditIcon, DeleteIcon } from './icons';

const GROUP_LABELS: { group: TagGroup; label: string }[] = [
  { group: 'activity', label: 'Activities' },
  { group: 'weather', label: 'Weather' },
  { group: 'other', label: 'Other' },
];

/**
 * Library-wide manager for the tag registry and categories, in one Manifest modal
 * with two tabs. Tags reuse {@link TagEditorDialog} (group / pin / rename / delete);
 * categories can be added, renamed, and deleted (items reassigned to the fallback).
 * Reads the live document so edits reflect immediately.
 */
export default function TagCategoryManager({ onClose }: { onClose: () => void }) {
  const { tagMeta } = useAppData();
  const [tab, setTab] = useState<'tags' | 'categories'>('tags');
  const [editingTag, setEditingTag] = useState<string | null>(null);

  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // A sub-dialog (tag editor / delete confirm) owns Escape while it's open.
  const subOpen = editingTag !== null || confirmDel !== null;
  const subOpenRef = useRef(subOpen);
  subOpenRef.current = subOpen;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !subOpenRef.current) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const grouped = GROUP_LABELS.map(({ group, label }) => ({
    label,
    tags: tagMeta
      .filter((t) => t.group === group)
      .map((t) => t.key)
      .sort((a, b) => a.localeCompare(b)),
  })).filter((g) => g.tags.length > 0);

  const categories = listCategories();

  function commitAdd() {
    const c = newCat.trim();
    if (!c) return;
    addCategory(c);
    setNewCat('');
  }

  function commitRename(from: string) {
    renameCategory(from, renameVal);
    setRenaming(null);
    setRenameVal('');
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !subOpen) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit tags and categories"
        className="card flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden"
      >
        <div aria-hidden className="airmail h-1 w-full" />
        <div className="flex items-center justify-between gap-2 p-5 pb-0">
          <h2 className="font-display text-lg font-bold leading-tight">Edit tags &amp; categories</h2>
          <button className="btn-ghost px-2 py-1 text-sm" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Manager tabs" className="flex gap-1 px-5 pt-3">
          {(['tags', 'categories'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`chip capitalize transition-colors ${
                tab === t ? 'bg-ink text-paper-raised' : 'bg-paper-sunk text-ink-soft hover:bg-line'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'tags' ? (
            grouped.length === 0 ? (
              <p className="text-sm text-ink-soft">No tags yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {grouped.map((g) => (
                  <div key={g.label}>
                    <p className="label mb-1.5">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.tags.map((k) => (
                        <button
                          key={k}
                          onClick={() => setEditingTag(k)}
                          title={`Edit tag “${k}”`}
                          className="chip bg-airblue-soft text-airblue transition-colors hover:bg-airblue/20"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-ink-faint">
                  Tap a tag to change its group, pin it to the trip page, rename, or delete it.
                </p>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3">
              {/* Add */}
              <div className="flex gap-2">
                <input
                  className="input min-w-0 flex-1"
                  placeholder="New category…"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitAdd();
                    }
                  }}
                  aria-label="New category name"
                />
                <button className="btn-secondary text-sm" onClick={commitAdd} disabled={!newCat.trim()}>
                  Add
                </button>
              </div>

              <ul className="divide-y divide-line/60 rounded-md border border-line">
                {categories.map((c) => (
                  <li key={c} className="flex items-center gap-2 px-3 py-2 text-sm">
                    {renaming === c ? (
                      <>
                        <input
                          className="input h-8 min-w-0 flex-1 py-1"
                          value={renameVal}
                          autoFocus
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitRename(c);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setRenaming(null);
                            }
                          }}
                          aria-label={`Rename ${c}`}
                        />
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => commitRename(c)}>
                          Save
                        </button>
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setRenaming(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate">{c}</span>
                        <button
                          className="btn-ghost px-1.5 py-1"
                          aria-label={`Rename ${c}`}
                          onClick={() => {
                            setRenaming(c);
                            setRenameVal(c);
                          }}
                        >
                          <EditIcon />
                        </button>
                        {c !== FALLBACK_CATEGORY && (
                          <button
                            className="btn-danger px-1.5 py-1"
                            aria-label={`Delete ${c}`}
                            onClick={() => setConfirmDel(c)}
                          >
                            <DeleteIcon />
                          </button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-faint">
                Renaming keeps every item in place. Deleting a category moves its items to “{FALLBACK_CATEGORY}”.
              </p>
            </div>
          )}
        </div>
      </div>

      {editingTag && <TagEditorDialog tag={editingTag} onClose={() => setEditingTag(null)} />}

      {confirmDel && (
        <ConfirmDialog
          title={`Delete “${confirmDel}”?`}
          confirmLabel="Delete category"
          tone="danger"
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            deleteCategory(confirmDel);
            setConfirmDel(null);
          }}
        >
          <p>
            Moves every item in <strong>{confirmDel}</strong> to <strong>{FALLBACK_CATEGORY}</strong>. No items are
            lost.
          </p>
        </ConfirmDialog>
      )}
    </div>,
    document.body,
  );
}
