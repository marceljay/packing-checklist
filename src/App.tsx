import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SettingsMenu from './components/SettingsMenu';
import ThemeToggle from './components/ThemeToggle';
import DevBar from './components/DevBar';
import { GithubIcon } from './components/icons';
import { useDevMode } from './lib/devMode';

const REPO_URL = 'https://github.com/marceljay/packing-checklist';

/** Luggage-tag mark — crisp ink shape with a punched eyelet. */
function TagMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="h-7 w-7 shrink-0">
      <path
        d="M14.6 4H27a1 1 0 0 1 1 1v12.4a2 2 0 0 1-.6 1.4l-8.6 8.6a2 2 0 0 1-2.8 0L6.6 19.4a2 2 0 0 1 0-2.8l7.6-7.6A2 2 0 0 0 14.6 4Z"
        className="fill-ink"
      />
      <circle cx="22.5" cy="9.5" r="2.1" className="fill-paper-raised" />
    </svg>
  );
}

export default function App() {
  const devMode = useDevMode();
  const { t } = useTranslation();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <TagMark />
            <span className="flex flex-col leading-none">
              <span className="font-display text-base font-bold tracking-tight text-ink">
                {t('common.appName')}
              </span>
              <span className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
                {t('common.packingLists')}
              </span>
            </span>
          </Link>
          <span className="ml-auto hidden font-mono text-[0.625rem] uppercase tracking-code text-ink-faint sm:inline">
            {t('common.tagline')}
          </span>
          <div className="ml-auto flex items-center gap-1 sm:ml-3">
            <ThemeToggle />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost px-2 py-1.5"
              aria-label={t('common.viewSource')}
              title={t('common.viewSource')}
            >
              <GithubIcon />
            </a>
            <SettingsMenu />
          </div>
        </div>
        <div aria-hidden className="airmail h-1 w-full opacity-90" />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {devMode && <DevBar />}
        <Outlet />
      </main>
    </div>
  );
}
