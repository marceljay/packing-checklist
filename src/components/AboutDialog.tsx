import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const REPO_URL = 'https://github.com/marceljay/packing-checklist';

/**
 * About modal: app name, version, and the commit the build was cut from
 * (injected at build time in vite.config.ts). Escape or a backdrop click closes.
 */
export default function AboutDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="About" className="card w-full max-w-sm overflow-hidden">
        <div aria-hidden className="airmail h-1 w-full" />
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">Packing Checklist</h2>
            <p className="font-mono text-sm text-ink-soft">v{__APP_VERSION__}</p>
          </div>

          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Build</dt>
            <dd className="break-words text-ink-soft">{__GIT_COMMIT__}</dd>
            <dt className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">Source</dt>
            <dd>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="text-airblue underline-offset-2 hover:underline"
              >
                github.com/marceljay/packing-checklist
              </a>
            </dd>
          </dl>

          <p className="text-xs text-ink-faint">
            A privacy-first, offline-capable packing app. All your data stays in this browser.
          </p>

          <div className="mt-1 flex justify-end">
            <button ref={closeRef} className="btn-primary text-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
