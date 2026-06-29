import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Two full-width tabs over the home content: Your trips and Item library.
 *  The active tab is driven by the route (`/` and `/items`) so deep links and
 *  the browser back/forward buttons work. */
export default function HomeLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <nav className="grid grid-cols-2 gap-2" aria-label={t('home.sections')}>
        <TabLink to="/" end hint={t('home.departures')} label={t('home.yourTrips')} />
        <TabLink to="/items" hint={t('home.yourGear')} label={t('home.itemLibrary')} />
      </nav>
      <Outlet />
    </div>
  );
}

function TabLink({
  to,
  end,
  hint,
  label,
}: {
  to: string;
  end?: boolean;
  hint: string;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex flex-col items-center gap-0.5 rounded border px-5 py-3.5 text-center transition-colors',
          isActive
            ? 'border-ink bg-ink text-paper-raised shadow-pass'
            : 'border-line bg-paper-raised text-ink hover:border-ink/40 hover:bg-paper-sunk',
        ].join(' ')
      }
    >
      <span className="font-mono text-[0.625rem] uppercase tracking-code opacity-70">{hint}</span>
      <span className="font-display text-lg font-bold tracking-tight">{label}</span>
    </NavLink>
  );
}
