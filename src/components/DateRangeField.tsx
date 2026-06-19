import { useEffect, useRef, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';

interface Props {
  start?: string;
  end?: string;
  onChange: (start?: string, end?: string) => void;
}

/** Local 'YYYY-MM-DD' <-> Date helpers (noon-free, timezone-safe). */
function fromISO(s?: string): Date | undefined {
  return s ? new Date(s + 'T00:00:00') : undefined;
}
function toISO(d?: Date): string | undefined {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function short(d?: Date): string {
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
}

// Theme react-day-picker with the Manifest palette via its CSS variables.
const calendarTheme = {
  '--rdp-accent-color': '#d83a2b',
  '--rdp-accent-background-color': '#f7e3df',
  '--rdp-range_middle-background-color': '#f7e3df',
  '--rdp-range_middle-color': '#16202e',
  '--rdp-range_start-date-background-color': '#d83a2b',
  '--rdp-range_end-date-background-color': '#d83a2b',
  '--rdp-range_start-color': '#fffefb',
  '--rdp-range_end-color': '#fffefb',
  '--rdp-today-color': '#d83a2b',
  '--rdp-day_button-border-radius': '0.375rem',
  fontFamily: 'inherit',
} as React.CSSProperties;

export default function DateRangeField({ start, end, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const from = fromISO(start);
  const to = fromISO(end);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = from
    ? `${short(from)}${to ? ` → ${short(to)} ${to.getFullYear()}` : ' → …'}`
    : 'Add dates';

  function handleSelect(range: DateRange | undefined) {
    onChange(toISO(range?.from), toISO(range?.to));
  }

  return (
    <div className="relative mt-1.5" ref={ref}>
      <button
        type="button"
        className="input flex items-center justify-between text-left font-mono"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={from ? '' : 'text-ink-faint'}>{label}</span>
        <span aria-hidden className="ml-2 shrink-0 text-ink-faint">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose trip dates"
          className="absolute left-0 z-20 mt-1.5 rounded-xl border border-line bg-paper-raised p-2 shadow-pass"
        >
          <DayPicker
            mode="range"
            selected={{ from, to }}
            onSelect={handleSelect}
            defaultMonth={from ?? new Date()}
            numberOfMonths={1}
            weekStartsOn={1}
            showOutsideDays
            style={calendarTheme}
          />
          {from && (
            <div className="flex justify-end border-t border-line px-1 pt-2">
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() => onChange(undefined, undefined)}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
