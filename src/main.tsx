import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import TripsListPage from './pages/TripsListPage';
import TripEditorPage from './pages/TripEditorPage';
import ItemsPage from './pages/ItemsPage';

// Hash router keeps the app deployable on any static host (GitHub Pages etc.)
// without server-side rewrite rules.
const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <TripsListPage /> },
      { path: 'trip/:tripId', element: <TripEditorPage /> },
      { path: 'items', element: <ItemsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
