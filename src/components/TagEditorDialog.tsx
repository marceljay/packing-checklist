import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tagKey, type TagGroup } from '../types';
import { useAppData } from '../db/store';
import { setTagGroup, setTagDefault, renameTag, deleteTag } from '../db/tags';
import Select from './Select';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  /** The tag key being edited. */
  tag: string;
  onClose: () => void;
}

const GROUPS: { value: TagGroup; label: string }[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'weather', label: 'Weather' },
  { value: 'other', label: 'Other' },
];
const labelFor = (g: TagGroup) => GROUPS.find((x) => x.value === g)?.label ?? 'Other';
const groupFor = (label: string) => GROUPS.find((x) => x.label === label)?.value ?? 'other';

/**
 * Edit one tag's registry metadata: its group, whether it's a trip-page default,
 * its name (global rename), or delete it (global, destructive — confirmed first).
 * A paper-card modal in the Manifest design language, matching {@link ConfirmDialog}.
 * Reads the live registry so external edits stay in sync; rename/delete close it.
 */
export default function TagEditorDialog({ tag, onClose }: Props) {
  const { tagMeta } = useAppData();
  const meta = tagMeta.find((m) => m.key === tag);
  const group = meta?.group ?? 'other';
  const isDefault = meta?.default ?? false;

  const [name, setName] = useState(tag);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const renamed = tagKey(name);
  const canRename = renamed.length > 0 && renamed !== tag;

  function saveRename() {
    if (!canRename) return;
    renameTag(tag, renamed);
    onClose();
  }

  if (confirmDelete) {
    return (
      <ConfirmDialog
        title={`Delete “${tag}”?`}
        confirmLabel="Delete tag"
        tone="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteTag(tag);
          onClose();
        }}
      >
        <p>
          Removes <strong>{tag}</strong> from all trips and items. Items keep their place; any
          item left with no tags moves to <strong>misc</strong>.
        </p>
      </ConfirmDialog>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={`Edit tag ${tag}`} className="card w-full max-w-sm overflow-hidden">
        <div aria-hidden className="airmail h-1 w-full" />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold leading-tight">Edit tag</h2>
            <span className="chip bg-airblue-soft text-airblue">{tag}</span>
          </div>

          {/* Group */}
          <div>
            <span className="label mb-1 block">Group</span>
            <Select
              value={labelFor(group)}
              onChange={(v) => setTagGroup(tag, groupFor(v))}
              options={GROUPS.map((g) => g.label)}
              ariaLabel="Tag group"
            />
            <p className="mt-1 text-xs text-ink-faint">
              Groups the chip on the trip page (Activities / Weather / Other).
            </p>
          </div>

          {/* Default on trip page */}
          <button
            type="button"
            aria-pressed={isDefault}
            onClick={() => setTagDefault(tag, !isDefault)}
            className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              isDefault
                ? 'border-vermilion/40 bg-vermilion-soft text-vermilion-deep'
                : 'border-line bg-paper-sunk text-ink-soft hover:text-ink'
            }`}
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill={isDefault ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
              <path d="M12 17v5" />
              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
            </svg>
            <span>
              {isDefault ? 'Pinned to the trip page' : 'Pin to the trip page'}
              <span className="block text-xs opacity-80">
                Default tags show as quick-add chips on every trip.
              </span>
            </span>
          </button>

          {/* Rename */}
          <div>
            <span className="label mb-1 block">Rename</span>
            <div className="flex gap-2">
              <input
                className="input min-w-0 flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveRename();
                  }
                }}
                aria-label="Tag name"
              />
              <button className="btn-secondary text-sm" onClick={saveRename} disabled={!canRename}>
                Save
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Renames everywhere — on every trip and library item.
            </p>
          </div>

          {/* Footer: delete + done */}
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-line pt-3">
            <button className="btn-danger text-sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
            <button ref={closeRef} className="btn-primary text-sm" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
