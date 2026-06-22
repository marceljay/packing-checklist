import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importTripFromText } from '../db/trips';
import { listLibrary, importLibraryItems } from '../db/library';
import { serializeLibrary, parseLibrary } from '../db/libraryTransfer';
import { downloadText, pickTextFile } from '../lib/file';

/** Header menu (hidden until opened) for backup/transfer actions: import a trip,
 *  and export / import the whole item library. */
export default function SettingsMenu() {
  const navigate = useNavigate();
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

  async function importTrip() {
    setOpen(false);
    const text = await pickTextFile();
    if (text == null) return;
    try {
      const id = await importTripFromText(text);
      navigate(`/trip/${id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not import that file.');
    }
  }

  async function exportLibrary() {
    setOpen(false);
    const items = await listLibrary();
    downloadText('packing-checklist-library.json', serializeLibrary(items));
  }

  async function importLibrary() {
    setOpen(false);
    const text = await pickTextFile();
    if (text == null) return;
    try {
      const added = await importLibraryItems(parseLibrary(text));
      alert(added > 0 ? `Imported ${added} new item${added === 1 ? '' : 's'}.` : 'No new items to import.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not import that file.');
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        className="btn-ghost px-2 py-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden className="text-lg leading-none">⋯</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded border border-line bg-paper-raised shadow-pass"
        >
          <MenuLabel>Trips</MenuLabel>
          <MenuItem onClick={importTrip}>Import trip…</MenuItem>

          <div className="border-t border-line" />
          <MenuLabel>Item library</MenuLabel>
          <MenuItem onClick={exportLibrary}>Export library</MenuItem>
          <MenuItem onClick={importLibrary}>Import library…</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2.5 font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
      {children}
    </p>
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
