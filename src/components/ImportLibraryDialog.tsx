import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LibraryImportPlan, ConflictResolution } from '../db/libraryTransfer';

type Mode = 'merge' | 'replace';

interface Props {
  plan: LibraryImportPlan;
  /** Total items in the file (for the replace-all summary). */
  incomingCount: number;
  onCancel: () => void;
  onApply: (mode: Mode, resolutions: ConflictResolution[]) => void;
}

const CHOICES: { value: ConflictResolution; label: string }[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'both', label: 'Both' },
  { value: 'theirs', label: 'Theirs' },
];

/** Import-library picker: choose merge (with per-conflict resolution) or replace-all. */
export default function ImportLibraryDialog({ plan, incomingCount, onCancel, onApply }: Props) {
  const [mode, setMode] = useState<Mode>('merge');
  // Default conflicts to "both" — the only non-destructive choice (keeps mine, adds theirs).
  const [resolutions, setResolutions] = useState<ConflictResolution[]>(
    () => plan.conflicts.map(() => 'both'),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function setOne(i: number, value: ConflictResolution) {
    setResolutions((cur) => cur.map((r, j) => (j === i ? value : r)));
  }
  function setAll(value: ConflictResolution) {
    setResolutions(plan.conflicts.map(() => value));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import library"
        className="card flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden"
      >
        <div aria-hidden className="airmail h-1 w-full" />
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <h2 className="font-display text-lg font-bold leading-tight">Import library</h2>

          {/* Mode */}
          <div className="flex rounded-full border border-line p-0.5 text-sm font-medium">
            {(['merge', 'replace'] as Mode[]).map((m) => (
              <button
                key={m}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full px-3 py-1 transition-colors ${
                  mode === m ? 'bg-ink text-paper-raised' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {m === 'merge' ? 'Merge' : 'Replace all'}
              </button>
            ))}
          </div>

          {mode === 'replace' ? (
            <div className="text-sm text-ink-soft">
              <p>
                Replace your current library with the <strong>{incomingCount}</strong> items in this
                file.
              </p>
              <p className="mt-1.5 text-xs text-vermilion-deep">
                Items your trips use that aren’t in this file will show as missing until re-added.
                Built-in defaults reappear on next load.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-ink-soft">
                <strong>{plan.fresh.length}</strong> new item{plan.fresh.length === 1 ? '' : 's'} to
                add
                {plan.idMatches.length > 0 && `, ${plan.idMatches.length} already in your library`}.
              </p>

              {plan.conflicts.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="label">
                      {plan.conflicts.length} name conflict{plan.conflicts.length === 1 ? '' : 's'}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
                      all:
                      {CHOICES.map((c) => (
                        <button
                          key={c.value}
                          className="rounded px-1 py-0.5 hover:bg-paper-sunk hover:text-ink"
                          onClick={() => setAll(c.value)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {plan.conflicts.map((c, i) => (
                      <li
                        key={`${c.existing.id}-${i}`}
                        className="flex items-center justify-between gap-2 rounded border border-line px-2.5 py-1.5"
                      >
                        <span className="min-w-0 truncate" title={c.incoming.name}>
                          {c.incoming.name}
                        </span>
                        <div className="flex shrink-0 rounded-full border border-line text-[0.6875rem] font-bold">
                          {CHOICES.map((choice) => (
                            <button
                              key={choice.value}
                              aria-pressed={resolutions[i] === choice.value}
                              onClick={() => setOne(i, choice.value)}
                              className={`px-2 py-0.5 first:rounded-l-full last:rounded-r-full transition-colors ${
                                resolutions[i] === choice.value
                                  ? 'bg-ink text-paper-raised'
                                  : 'text-ink-soft hover:bg-paper-sunk'
                              }`}
                            >
                              {choice.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    Mine = keep yours · Theirs = overwrite with imported · Both = keep as two items.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button className="btn-ghost text-sm" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn-primary text-sm" onClick={() => onApply(mode, resolutions)}>
              {mode === 'replace' ? 'Replace library' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
