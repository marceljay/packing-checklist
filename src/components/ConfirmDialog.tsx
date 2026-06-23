import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  title: string;
  /** Body content (description, lists, …). */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Optional middle action (e.g. "Keep items") between cancel and confirm. */
  secondary?: { label: string; onClick: () => void };
  /** `danger` styles the confirm button as destructive. */
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirm dialog in the Manifest design language — a paper card with an
 * airmail accent edge over a dimmed backdrop. Escape or a backdrop click cancels;
 * the confirm button takes focus on open. Rendered in a portal so it's never
 * clipped by a scrolling panel.
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  secondary,
  tone = 'default',
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

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
        aria-label={title}
        className="card w-full max-w-sm overflow-hidden"
      >
        <div aria-hidden className="airmail h-1 w-full" />
        <div className="flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
          {children && <div className="text-sm text-ink-soft">{children}</div>}
          <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
            <button className="btn-ghost text-sm" onClick={onCancel}>
              {cancelLabel}
            </button>
            {secondary && (
              <button className="btn-secondary text-sm" onClick={secondary.onClick}>
                {secondary.label}
              </button>
            )}
            <button
              ref={confirmRef}
              className={`${tone === 'danger' ? 'btn-danger' : 'btn-primary'} text-sm`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
