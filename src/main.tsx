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

/** Apply the saved theme and seed any missing built-in defaults before rendering. */
function boot() {
  initTheme();
  seedLibrary();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

boot();
