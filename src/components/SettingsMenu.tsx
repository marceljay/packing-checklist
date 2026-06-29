import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { importTripFromText, exportTrips, importAllTripsFromText, listTrips } from '../db/trips';
import { listLibrary, replaceLibrary, applyLibraryImport, restoreDefaults } from '../db/library';
import { listTagMeta } from '../db/tags';
import { listCustomCategories } from '../db/categories';
import {
  serializeLibrary,
  parseLibrary,
  planLibraryImport,
  type LibraryImportPlan,
  type ConflictResolution,
} from '../db/libraryTransfer';
import { downloadText, downloadBlob, pickTextFile } from '../lib/file';
import { useDevMode, setDevMode } from '../lib/devMode';
import { useUnits, setUnits, type UnitSystem } from '../lib/units';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { useLocalePath } from '../i18n/useLocalePath';
import ExportDialog from './ExportDialog';
import SettingsDialog from './SettingsDialog';
import AboutDialog from './AboutDialog';
import ImportLibraryDialog from './ImportLibraryDialog';
import ConfirmDialog from './ConfirmDialog';

/** Header menu (hidden until opened) for backup/transfer actions: import a trip,
 *  and export / import the whole item library. */
export default function SettingsMenu() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const lp = useLocalePath();
  const { t, i18n } = useTranslation();
  const devMode = useDevMode();
  const units = useUnits();
  const [open, setOpen] = useState(false);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === (i18n.resolvedLanguage ?? i18n.language)) ?? SUPPORTED_LANGUAGES[0];

  /** Switch language and reflect it in the URL's `/:lang` segment, keeping the rest of the path. */
  function chooseLanguage(code: string) {
    void i18n.changeLanguage(code);
    navigate(`/${code}${pathname.replace(/^\/[^/]+/, '')}`);
  }
  const [showExport, setShowExport] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
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
      alert(t('settingsMenu.offlineUnavailable'));
    }
  }

  async function importTrip() {
    setOpen(false);
    const text = await pickTextFile();
    if (text == null) return;
    try {
      const id = await importTripFromText(text);
      navigate(lp(`/trip/${id}`));
    } catch (e) {
      alert(e instanceof Error ? e.message : t('settingsMenu.importFail'));
    }
  }

  function runExport(tripIds: string[], includeLibrary: boolean) {
    if (tripIds.length > 0) {
      downloadText('packing-checklist-trips.json', exportTrips(tripIds));
    }
    if (includeLibrary) {
      downloadText('packing-checklist-library.json', serializeLibrary(listLibrary(), listTagMeta(), listCustomCategories()));
    }
    setShowExport(false);
  }

  async function importTrips() {
    setOpen(false);
    const text = await pickTextFile();
    if (text == null) return;
    try {
      const n = importAllTripsFromText(text);
      alert(n > 0 ? t('settingsMenu.importedTrips', { count: n }) : t('settingsMenu.noTripsInFile'));
    } catch (e) {
      alert(e instanceof Error ? e.message : t('settingsMenu.importFail'));
    }
  }

  async function importLibrary() {
    setOpen(false);
    const text = await pickTextFile();
    if (text == null) return;
    try {
      const incoming = parseLibrary(text);
      setLibImport({ plan: planLibraryImport(incoming.items, listLibrary()), incoming });
    } catch (e) {
      alert(e instanceof Error ? e.message : t('settingsMenu.importFail'));
    }
  }

  function applyLibImport(mode: 'merge' | 'replace', resolutions: ConflictResolution[]) {
    if (!libImport) return;
    const { plan, incoming } = libImport;
    const newCatsLine = (cats: string[]) =>
      cats.length > 0 ? `\n\n${t('settingsMenu.newCats', { cats: cats.join(', ') })}` : '';
    if (mode === 'replace') {
      const { count, newCategories } = replaceLibrary(incoming.items, incoming.tagMeta, incoming.customCategories);
      alert(`${t('settingsMenu.replacedLib', { count })}${newCatsLine(newCategories)}`);
    } else {
      const { added, replaced, skipped, newCategories } = applyLibraryImport(plan, resolutions, incoming.tagMeta, incoming.customCategories);
      alert(`${t('settingsMenu.importedLib', { added, replaced, skipped })}${newCatsLine(newCategories)}`);
    }
    setLibImport(null);
  }

  return (
    <div ref={ref} className="relative">
      <button
        className="btn-ghost px-2 py-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('common.menu')}
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
            {t('settingsMenu.export')}
          </MenuItem>
          {canDownloadApp && (
            <MenuItem onClick={downloadApp}>{t('settingsMenu.downloadApp')}</MenuItem>
          )}

          <div className="border-t border-line" />
          <MenuLabel>{t('settingsMenu.import')}</MenuLabel>
          <MenuItem onClick={importTrip}>{t('settingsMenu.importTrip')}</MenuItem>
          <MenuItem onClick={importTrips}>{t('settingsMenu.importTrips')}</MenuItem>
          <MenuItem onClick={importLibrary}>{t('settingsMenu.importLibrary')}</MenuItem>

          <div className="border-t border-line" />
          <MenuItem
            onClick={() => {
              setOpen(false);
              setShowRestore(true);
            }}
          >
            {t('settingsMenu.returnToDefaults')}
          </MenuItem>

          <div className="border-t border-line" />
          <MenuItem
            onClick={() => {
              setOpen(false);
              setShowSettings(true);
            }}
          >
            {t('settingsMenu.settings')}
          </MenuItem>
          <div className="px-3 py-2 text-sm text-ink">
            <span className="mb-1.5 block">{t('settingsMenu.language')}</span>
            <div role="group" aria-label={t('settingsMenu.language')} className="flex flex-wrap gap-1">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  aria-pressed={currentLang.code === l.code}
                  onClick={() => chooseLanguage(l.code)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    currentLang.code === l.code
                      ? 'border-ink bg-ink text-paper-raised'
                      : 'border-line text-ink-soft hover:text-ink'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-sm text-ink">
            <span>{t('settingsMenu.temperature')}</span>
            <div
              role="group"
              aria-label={t('settingsMenu.temperatureUnits')}
              className="flex overflow-hidden rounded-full border border-line font-mono text-[0.625rem] uppercase tracking-wide"
            >
              {(['metric', 'imperial'] as UnitSystem[]).map((sys) => (
                <button
                  key={sys}
                  aria-pressed={units === sys}
                  onClick={() => setUnits(sys)}
                  className={`px-2.5 py-0.5 transition-colors ${
                    units === sys ? 'bg-ink text-paper-raised' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {sys === 'metric' ? '°C' : '°F'}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-line" />
          <MenuItem
            onClick={() => {
              setDevMode(!devMode);
              setOpen(false);
            }}
          >
            <span className="flex items-center justify-between">
              {t('settingsMenu.devMode')}
              <span className="font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
                {devMode ? t('settingsMenu.on') : t('settingsMenu.off')}
              </span>
            </span>
          </MenuItem>

          <div className="border-t border-line" />
          <MenuItem
            onClick={() => {
              setOpen(false);
              setShowAbout(true);
            }}
          >
            {t('settingsMenu.about')}
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
          incomingCount={libImport.incoming.items.length}
          onCancel={() => setLibImport(null)}
          onApply={applyLibImport}
        />
      )}

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}

      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}

      {showRestore && (
        <ConfirmDialog
          title={t('settingsMenu.restoreTitle')}
          confirmLabel={t('settingsMenu.restoreConfirm')}
          onConfirm={() => {
            restoreDefaults();
            setShowRestore(false);
          }}
          onCancel={() => setShowRestore(false)}
        >
          <p>{t('settingsMenu.restoreBody')}</p>
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
