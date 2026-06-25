import { Link, Outlet } from 'react-router-dom';
import SettingsMenu from './components/SettingsMenu';
import ThemeToggle from './components/ThemeToggle';
import DevBar from './components/DevBar';
import { useDevMode } from './lib/devMode';

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
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <TagMark />
            <span className="flex flex-col leading-none">
              <span className="font-display text-base font-bold tracking-tight text-ink">
                Packing Checklist
              </span>
              <span className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
                Packing lists
              </span>
            </span>
          </Link>
          <span className="ml-auto hidden font-mono text-[0.625rem] uppercase tracking-code text-ink-faint sm:inline">
            private · offline · no account
          </span>
          <div className="ml-auto flex items-center gap-1 sm:ml-3">
            <ThemeToggle />
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
