import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  ariaLabel?: string;
  /** Associates an external <label htmlFor> with the trigger. */
  id?: string;
  /** Extra classes on the trigger (e.g. layout helpers like `min-w-0`). */
  className?: string;
  /** Map an option value to its display label (e.g. translate built-ins). The
   *  value passed to `onChange` stays the original option string. */
  renderOption?: (value: string) => string;
}

type Pos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/**
 * Single-select dropdown styled to match the app (and the TagEditor): a trigger
 * that looks like `.input` plus a portalled panel of options with the current
 * one checked. Portalled with fixed positioning so it is never clipped by the
 * surrounding `overflow-hidden` cards. Keyboard: ↑/↓ move, Enter selects, Esc closes.
 */
export default function Select({ value, onChange, options, ariaLabel, id, className = '', renderOption }: Props) {
  const display = renderOption ?? ((v: string) => v);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function reposition() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    setPos({
      left: r.left,
      width: r.width,
      ...(openUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      maxHeight: Math.max(160, (openUp ? spaceAbove : spaceBelow) - 12),
    });
  }

  useLayoutEffect(() => {
    if (open) {
      setActive(Math.max(0, options.indexOf(value)));
      reposition();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    function onReflow() {
      reposition();
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open]);

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`input flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className="truncate">{display(value)}</span>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-ink-faint">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-50 overflow-y-auto rounded-md border border-line bg-paper-raised py-1 shadow-pass"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          >
            {options.map((opt, i) => {
              const selected = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(opt)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink ${i === active ? 'bg-paper-sunk' : ''}`}
                >
                  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 text-vermilion ${selected ? '' : 'invisible'}`}>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span className="truncate">{display(opt)}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
