import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  /** Both items run this — the browser print dialog is also where "Save as PDF" lives. */
  onPrint: () => void;
  disabled?: boolean;
  /** Lets the nav style the trigger to match its bar segments. */
  triggerClassName?: string;
}

/** "Print ▾" dropdown offering Print and Save as PDF (both open the print dialog).
 *  Closes on outside-click / Escape, mirroring SettingsMenu. */
export default function PrintMenu({ onPrint, disabled = false, triggerClassName = '' }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function run() {
    setOpen(false);
    onPrint();
  }

  return (
    <div ref={ref} className="relative flex flex-1">
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? t('printMenu.addItemsFirst') : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {t('printMenu.print')}
        <span aria-hidden className="text-[0.625rem]">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded border border-line bg-paper-raised shadow-pass"
        >
          <MenuItem onClick={run}>{t('printMenu.printItem')}</MenuItem>
          <MenuItem onClick={run}>{t('printMenu.savePdf')}</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="menuitem"
      className="block w-full px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-paper-sunk"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
