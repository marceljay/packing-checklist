import React from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom';
// Self-hosted fonts (bundled into the build → fully offline, no CDN call).
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './index.css';
import App from './App';
import HomeLayout from './pages/HomeLayout';
import TripsListPage from './pages/TripsListPage';
import TripEditorPage from './pages/TripEditorPage';
import ItemsPage from './pages/ItemsPage';
import { seedLibrary } from './db/library';
import { seedTagMeta } from './db/tags';
import { initTheme } from './lib/theme';
import { initI18n } from './i18n';
import RootRedirect from './i18n/RootRedirect';

// Hash router keeps the app deployable on any static host (GitHub Pages etc.)
// without server-side rewrite rules. A `/:lang` segment carries the UI language
// in the URL (e.g. /#/pt/items); App validates it and syncs i18n.
const router = createHashRouter([
  {
    path: '/:lang',
    element: <App />,
    children: [
      {
        element: <HomeLayout />,
        children: [
          { index: true, element: <Navigate to="trips" replace /> },
          { path: 'trips', element: <TripsListPage /> },
          { path: 'items', element: <ItemsPage /> },
        ],
      },
      { path: 'trip/:tripId', element: <TripEditorPage /> },
    ],
  },
  { path: '*', element: <RootRedirect /> },
]);

/** Apply the saved theme and seed any missing built-in defaults before rendering. */
function boot() {
  initTheme();
  initI18n();
  seedLibrary();
  seedTagMeta(); // after seedLibrary so library tags get backfilled into the registry

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

boot();
