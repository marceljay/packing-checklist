import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importTripFromText, exportTrips, importAllTripsFromText, listTrips } from '../db/trips';
import { listLibrary, replaceLibrary, applyLibraryImport, restoreDefaults } from '../db/library';
import {
  serializeLibrary,
  parseLibrary,
  planLibraryImport,
  type LibraryImportPlan,
  type ConflictResolution,
} from '../db/libraryTransfer';
import { downloadText, downloadBlob, pickTextFile } from '../lib/file';
import { useDevMode, setDevMode } from '../lib/devMode';
import ExportDialog from './ExportDialog';
import ImportLibraryDialog from './ImportLibraryDialog';
import ConfirmDialog from './ConfirmDialog';

/** Header menu (hidden until opened) for backup/transfer actions: import a trip,
 *  and export / import the whole item library. */
export default function SettingsMenu() {
  const navigate = useNavigate();
  const devMode = useDevMode();
  const [open, setOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  // Pending library import: parsed file + its plan against the current library.
  const [libImport, setLibImport] = useState<{
    plan: LibraryImportPlan;
    incoming: ReturnType<typeof parseLibrary>;
  } | null>(null);
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

  // The self-contained offline copy is bundled into the hosting build as
  // packing-checklist.html. Offer it only in the served app — never in dev (no
  // artifact) or in the downloaded file:// copy itself (can't re-fetch offline).
  const canDownloadApp = import.meta.env.PROD && window.location.protocol !== 'file:';

  async function downloadApp() {
    setOpen(false);
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'packing-checklist.html');
      if (!res.ok) throw new Error();
      downloadBlob('packing-checklist.html', await res.blob());
    } catch {
      alert('The offline app file isn’t available here.');
    }
  }

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

  function runExport(tripIds: string[], includeLibrary: boolean) {
    if (tripIds.length > 0) {
      downloadText('packing-checklist-trips.json', exportTrips(tripIds));
    }
    if (includeLibrary) {
      downloadText('packing-checklist-library.json', serializeLibrary(listLibrary()));
    }
    setShowExport(false);
  }

  async function importTrips() {
    setOpen(false);
    const text = await pickTextFile();
    if (text == null) return;
    try {
      const n = importAllTripsFromText(text);
      alert(n > 0 ? `Imported ${n} trip${n === 1 ? '' : 's'}.` : 'No trips found in that file.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not import that file.');
    }
  }

  async function importLibrary() {
    setOpen(false);
    const text = await pickTextFile();
    if (text == null) return;
    try {
      const incoming = parseLibrary(text);
      setLibImport({ plan: planLibraryImport(incoming, listLibrary()), incoming });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not import that file.');
    }
  }

  function applyLibImport(mode: 'merge' | 'replace', resolutions: ConflictResolution[]) {
    if (!libImport) return;
    const { plan, incoming } = libImport;
    if (mode === 'replace') {
      replaceLibrary(incoming);
      alert(`Replaced your library with ${incoming.length} item${incoming.length === 1 ? '' : 's'}.`);
    } else {
      const { added, replaced, skipped } = applyLibraryImport(plan, resolutions);
      alert(`Imported: ${added} added, ${replaced} replaced, ${skipped} skipped.`);
    }
    setLibImport(null);
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
          <MenuItem
            onClick={() => {
              setOpen(false);
              setShowExport(true);
            }}
          >
            Export…
          </MenuItem>
          {canDownloadApp && (
            <MenuItem onClick={downloadApp}>Download app for offline use…</MenuItem>
          )}

          <div className="border-t border-line" />
          <MenuLabel>Import</MenuLabel>
          <MenuItem onClick={importTrip}>Import trip…</MenuItem>
          <MenuItem onClick={importTrips}>Import trips…</MenuItem>
          <MenuItem onClick={importLibrary}>Import library…</MenuItem>

          <div className="border-t border-line" />
          <MenuItem
            onClick={() => {
              setOpen(false);
              setShowRestore(true);
            }}
          >
            Restore default items…
          </MenuItem>

          <div className="border-t border-line" />
          <MenuItem
            onClick={() => {
              setDevMode(!devMode);
              setOpen(false);
            }}
          >
            <span className="flex items-center justify-between">
              Dev mode
              <span className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
                {devMode ? 'On' : 'Off'}
              </span>
            </span>
          </MenuItem>
        </div>
      )}

      {showExport && (
        <ExportDialog
          trips={listTrips().map((t) => ({ id: t.id, name: t.name }))}
          onCancel={() => setShowExport(false)}
          onExport={runExport}
        />
      )}

      {libImport && (
        <ImportLibraryDialog
          plan={libImport.plan}
          incomingCount={libImport.incoming.length}
          onCancel={() => setLibImport(null)}
          onApply={applyLibImport}
        />
      )}

      {showRestore && (
        <ConfirmDialog
          title="Restore default items?"
          confirmLabel="Restore defaults"
          onConfirm={() => {
            restoreDefaults();
            setShowRestore(false);
          }}
          onCancel={() => setShowRestore(false)}
        >
          <p>
            Re-adds any built-in items you removed or edited, in their original form.
            Your own custom items are left untouched.
          </p>
        </ConfirmDialog>
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
