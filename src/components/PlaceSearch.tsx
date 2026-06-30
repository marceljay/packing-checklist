import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchPlaces, type GeoResult } from '../engine/weather';
import { resolvedLang } from '../i18n';

interface Props {
  /** A place was chosen from the suggestions (carries coordinates). */
  onSelect: (place: GeoResult) => void;
}

/** Destination search with geocoded autocomplete (Open-Meteo, with an offline
 *  fallback to the bundled city list). Only a recognized match can be added —
 *  there is no free-text add, so every destination has coordinates for weather. */
export default function PlaceSearch({ onSelect }: Props) {
  const { t, i18n } = useTranslation();
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
    const timer = setTimeout(() => {
      searchPlaces(q, 8, controller.signal, resolvedLang())
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
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, i18n.resolvedLanguage]);

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
      // Only a recognized match can be added: the highlighted one, or the sole
      // result if there's exactly one. Otherwise Enter does nothing.
      const pick = active >= 0 ? results[active] : results.length === 1 ? results[0] : undefined;
      if (pick) choose(pick);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div className="relative mt-2" ref={ref}>
      <input
        className="input w-full"
        value={query}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-label={t('place.searchAria')}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t('place.placeholder')}
      />

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-line bg-paper-raised py-1 shadow-pass"
        >
          {loading && results.length === 0 && (
            <li className="px-3 py-2 font-mono text-xs text-ink-faint">{t('place.searching')}</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-soft">
              {t('place.noMatches', { query: query.trim() })}
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
