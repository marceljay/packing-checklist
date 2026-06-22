import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import HomeLayout from './pages/HomeLayout';
import TripsListPage from './pages/TripsListPage';
import TripEditorPage from './pages/TripEditorPage';
import ItemsPage from './pages/ItemsPage';
import { seedLibrary, migrateTripsToLibraryRefs } from './db/library';

// Seed built-in defaults (idempotent), then migrate any legacy trips whose items
// predate the library-reference model. Order matters: refs resolve against seeds.
void seedLibrary().then(() => migrateTripsToLibraryRefs());

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
