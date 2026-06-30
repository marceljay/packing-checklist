import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { GlobeIcon, ChevronIcon } from './icons';

/**
 * Compact language switcher for the header. Shows the active language as its
 * uppercase code (EN/DE/…) and opens a small menu of native names. Choosing a
 * language switches i18n and reflects it in the URL's `/:lang` segment, keeping
 * the rest of the path so the current page stays put.
 */
export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === (i18n.resolvedLanguage ?? i18n.language)) ?? SUPPORTED_LANGUAGES[0];

  function choose(code: string) {
    setOpen(false);
    if (code !== current.code) void i18n.changeLanguage(code);
    navigate(`/${code}${pathname.replace(/^\/[^/]+/, '')}`);
  }

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('common.language')}
        title={t('common.language')}
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost flex items-center gap-1 px-2 py-1.5"
      >
        <GlobeIcon />
        <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-code">{current.code}</span>
        <ChevronIcon size={14} className={`text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('common.language')}
          className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded border border-line bg-paper-raised py-1 shadow-pass"
        >
          {SUPPORTED_LANGUAGES.map((l) => {
            const active = current.code === l.code;
            return (
              <button
                key={l.code}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(l.code)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-paper-sunk ${
                  active ? 'text-ink' : 'text-ink-soft'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width={15}
                  height={15}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className={`shrink-0 text-vermilion ${active ? '' : 'invisible'}`}
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span className="flex-1 truncate">{l.label}</span>
                <span className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">{l.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
