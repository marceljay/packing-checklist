import { useEffect, useRef, useState } from 'react';
import { searchPlaces, type GeoResult } from '../engine/weather';

interface Props {
  /** A place was chosen from the suggestions (carries coordinates). */
  onSelect: (place: GeoResult) => void;
  /** Free text added without a match (offline / not found). */
  onAddManual: (label: string) => void;
}

/** Destination search with geocoded autocomplete (Open-Meteo). Falls back to a
 *  plain text add when offline or no match is chosen. */
export default function PlaceSearch({ onSelect, onAddManual }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  // Debounced, abortable search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchPlaces(q, 8, controller.signal)
        .then((r) => {
          setResults(r);
          setActive(-1);
          setOpen(true);
        })
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setResults([]);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function choose(place: GeoResult) {
    onSelect(place);
    reset();
  }

  function addManual() {
    const label = query.trim();
    if (!label) return;
    onAddManual(label);
    reset();
  }

  function reset() {
    setQuery('');
    setResults([]);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && results[active]) choose(results[active]);
      else addManual();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div className="relative mt-2" ref={ref}>
      <div className="flex gap-2">
        <input
          className="input min-w-0 flex-1"
          value={query}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-label="Search for a place"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search a place…"
        />
        <button className="btn-secondary shrink-0" onClick={addManual} disabled={!query.trim()}>
          Add
        </button>
      </div>

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-line bg-paper-raised py-1 shadow-pass"
        >
          {loading && results.length === 0 && (
            <li className="px-3 py-2 font-mono text-xs text-ink-faint">Searching…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-soft">
              No matches. Press Add to use “{query.trim()}” as typed.
            </li>
          )}
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lon}`} role="option" aria-selected={i === active}>
              <button
                className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm ${
                  i === active ? 'bg-paper-sunk' : 'hover:bg-paper-sunk'
                }`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
              >
                <span className="truncate">{r.name}</span>
                <span className="ml-auto shrink-0 truncate font-mono text-[0.625rem] uppercase tracking-wide text-ink-faint">
                  {[r.admin1, r.country].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
