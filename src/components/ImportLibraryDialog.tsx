import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import type { LibraryImportPlan, ConflictResolution } from '../db/libraryTransfer';

type Mode = 'merge' | 'replace';

interface Props {
  plan: LibraryImportPlan;
  /** Total items in the file (for the replace-all summary). */
  incomingCount: number;
  onCancel: () => void;
  onApply: (mode: Mode, resolutions: ConflictResolution[]) => void;
}

const CHOICES: { value: ConflictResolution; labelKey: string }[] = [
  { value: 'mine', labelKey: 'importLib.choiceMine' },
  { value: 'both', labelKey: 'importLib.choiceBoth' },
  { value: 'theirs', labelKey: 'importLib.choiceTheirs' },
];

/** Import-library picker: choose merge (with per-conflict resolution) or replace-all. */
export default function ImportLibraryDialog({ plan, incomingCount, onCancel, onApply }: Props) {
  const { t } = useTranslation();
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
        aria-label={t('importLib.title')}
        className="card flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden"
      >
        <div aria-hidden className="airmail h-1 w-full" />
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <h2 className="font-display text-lg font-bold leading-tight">{t('importLib.title')}</h2>

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
                {m === 'merge' ? t('importLib.merge') : t('importLib.replaceAll')}
              </button>
            ))}
          </div>

          {mode === 'replace' ? (
            <div className="text-sm text-ink-soft">
              <p>
                <Trans i18nKey="importLib.replaceBody" values={{ count: incomingCount }} components={{ strong: <strong /> }} />
              </p>
              <p className="mt-1.5 text-xs text-vermilion-deep">
                {t('importLib.replaceWarn')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-ink-soft">
                {t('importLib.mergeNew', { count: plan.fresh.length })}
                {plan.idMatches.length > 0 && t('importLib.mergeAlsoExisting', { count: plan.idMatches.length })}.
              </p>

              {plan.conflicts.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="label">
                      {t('importLib.nameConflicts', { count: plan.conflicts.length })}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
                      {t('importLib.all')}
                      {CHOICES.map((c) => (
                        <button
                          key={c.value}
                          className="rounded px-1 py-0.5 hover:bg-paper-sunk hover:text-ink"
                          onClick={() => setAll(c.value)}
                        >
                          {t(c.labelKey)}
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
                              {t(choice.labelKey)}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    {t('importLib.conflictHelp')}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button className="btn-ghost text-sm" onClick={onCancel}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary text-sm" onClick={() => onApply(mode, resolutions)}>
              {mode === 'replace' ? t('importLib.replaceLibrary') : t('importLib.import')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
