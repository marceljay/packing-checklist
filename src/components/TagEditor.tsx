import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tagKey } from '../types';

interface Props {
  /** Current tag keys. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Known tag keys across the library, offered to pick from. */
  suggestions?: string[];
  ariaLabel?: string;
}

type Pos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/**
 * Tag combobox: selected tags show as chips with a ✕ in the field; clicking the
 * field opens a dropdown with a small search box and a checkbox row per known
 * tag. Toggling a row adds/removes the chip immediately; typing a new label and
 * confirming creates it. The panel is portalled with fixed positioning so it is
 * never clipped by the surrounding `overflow-hidden` cards.
 */
export default function TagEditor({ value, onChange, suggestions = [], ariaLabel = 'Tags' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<Pos | null>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Position the portalled panel under (or above) the control, sized to it.
  function reposition() {
    const el = controlRef.current;
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
    if (open) reposition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!controlRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onReflow() {
      reposition();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open]);

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  function remove(key: string) {
    onChange(value.filter((k) => k !== key));
  }

  function createFromQuery() {
    const key = tagKey(query);
    if (key && !value.includes(key)) onChange([...value, key]);
    setQuery('');
    searchRef.current?.focus();
  }

  const q = tagKey(query);
  const filtered = [...new Set([...suggestions, ...value])].filter((s) => s.includes(q)).sort();
  const canCreate = q.length > 0 && !filtered.includes(q);

  return (
    <div ref={controlRef} className="relative">
      {/* Field: chips + open trigger, styled like .input */}
      <div
        className="input flex min-h-[2.5rem] cursor-text flex-wrap items-center gap-1.5"
        onClick={() => setOpen(true)}
      >
        {value.length === 0 && <span className="text-sm text-ink-faint">Add tags…</span>}
        {value.map((k) => (
          <span key={k} className="chip bg-airblue-soft text-airblue">
            {k}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(k);
              }}
              aria-label={`Remove tag ${k}`}
              className="ml-0.5 rounded-full text-airblue/70 hover:text-airblue"
            >
              ✕
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="ml-auto text-ink-faint transition-colors hover:text-ink-soft"
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-multiselectable="true"
            aria-label={ariaLabel}
            className="fixed z-50 flex flex-col overflow-hidden rounded-md border border-line bg-paper-raised shadow-pass"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          >
            <div className="shrink-0 border-b border-line p-2">
              <input
                ref={searchRef}
                className="input h-8 py-1 text-sm"
                placeholder="Search or add a tag…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (canCreate) createFromQuery();
                    else if (filtered.length === 1) toggle(filtered[0]);
                  }
                }}
                aria-label={`Search ${ariaLabel.toLowerCase()}`}
              />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto py-1">
              {filtered.map((s) => {
                const checked = value.includes(s);
                return (
                  <li key={s}>
                    <label
                      role="option"
                      aria-selected={checked}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-paper-sunk"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s)}
                        className="h-4 w-4 shrink-0 rounded border-line text-vermilion focus:ring-vermilion"
                      />
                      <span className="chip max-w-full truncate bg-airblue-soft text-airblue">{s}</span>
                    </label>
                  </li>
                );
              })}
              {canCreate && (
                <li>
                  <button
                    type="button"
                    onClick={createFromQuery}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-airblue hover:bg-paper-sunk"
                  >
                    <span aria-hidden className="text-base leading-none">+</span>
                    Create “{q}”
                  </button>
                </li>
              )}
              {filtered.length === 0 && !canCreate && (
                <li className="px-3 py-2 text-sm text-ink-faint">No tags yet — type to add one.</li>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
