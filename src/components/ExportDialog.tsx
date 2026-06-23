import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  trips: { id: string; name: string }[];
  onCancel: () => void;
  /** Selected trip ids (empty = none) + whether to also export the item library. */
  onExport: (tripIds: string[], includeLibrary: boolean) => void;
}

/**
 * Export picker — choose which trips to export (and optionally the item library)
 * before downloading. Same Manifest modal shell as ConfirmDialog.
 */
export default function ExportDialog({ trips, onCancel, onExport }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(trips.map((t) => t.id)));
  const [includeLibrary, setIncludeLibrary] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const allSelected = trips.length > 0 && selected.size === trips.length;
  const nothing = selected.size === 0 && !includeLibrary;

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(trips.map((t) => t.id)));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Export" className="card w-full max-w-sm overflow-hidden">
        <div aria-hidden className="airmail h-1 w-full" />
        <div className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-lg font-bold leading-tight">Export</h2>

          {/* Trips */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label">Trips</span>
              {trips.length > 0 && (
                <button className="btn-ghost px-2 py-0.5 text-xs" onClick={toggleAll}>
                  {allSelected ? 'Select none' : 'Select all'}
                </button>
              )}
            </div>
            {trips.length === 0 ? (
              <p className="text-sm text-ink-faint">No trips to export yet.</p>
            ) : (
              <ul className="max-h-52 space-y-0.5 overflow-y-auto rounded border border-line p-1">
                {trips.map((t) => (
                  <li key={t.id}>
                    <label className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-paper-sunk">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-line text-vermilion focus:ring-vermilion"
                        checked={selected.has(t.id)}
                        onChange={() => toggle(t.id)}
                      />
                      <span className="min-w-0 truncate">{t.name || 'Untitled trip'}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Item library */}
          <label className="flex items-center gap-2.5 border-t border-line pt-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 rounded border-line text-vermilion focus:ring-vermilion"
              checked={includeLibrary}
              onChange={(e) => setIncludeLibrary(e.target.checked)}
            />
            <span>
              Item library
              <span className="block text-xs text-ink-faint">Your full item list, as a separate file</span>
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <button className="btn-ghost text-sm" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn-primary text-sm"
              disabled={nothing}
              onClick={() => onExport([...selected], includeLibrary)}
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
