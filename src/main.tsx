import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import HomeLayout from './pages/HomeLayout';
import TripsListPage from './pages/TripsListPage';
import TripEditorPage from './pages/TripEditorPage';
import ItemsPage from './pages/ItemsPage';
import { seedLibrary } from './db/library';
import { hasStoredDoc, setData } from './db/store';
import { importLegacyIndexedDB } from './db/legacy';
import { initTheme } from './lib/theme';

// Hash router keeps the app deployable on any static host (GitHub Pages etc.)
// without server-side rewrite rules.
const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <HomeLayout />,
        children: [
          { index: true, element: <TripsListPage /> },
          { path: 'items', element: <ItemsPage /> },
        ],
      },
      { path: 'trip/:tripId', element: <TripEditorPage /> },
    ],
  },
]);

/** First run on the JSON-document model: best-effort import the old IndexedDB,
 *  then seed any missing defaults, before rendering. */
async function boot() {
  initTheme();
  if (!hasStoredDoc()) {
    const legacy = await importLegacyIndexedDB();
    if (legacy) setData((d) => void Object.assign(d, legacy));
  }
  seedLibrary();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

void boot();
