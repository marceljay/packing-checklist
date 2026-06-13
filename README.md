# Packing Checklist

A privacy-first, offline-capable web app that builds packing checklists tailored
to a trip's destination, weather, duration, and activities — then lets you check
items off in the browser or print/export them for offline use.

The app **suggests** items via a rule-based engine but never forces them on you:
you stay in control and pull suggestions into the list. Items carry quantities, a
packing status (pack / rent / buy-there / have-there), and are assigned to
physical bags. Everything is stored locally — no accounts, no server, no tracking.

See [`SPEC.md`](./SPEC.md) for the full specification.

## Tech stack

- **Vite** + **React 18** + **TypeScript** — static, client-only SPA
- **Tailwind CSS** — mobile-first styling
- **Dexie** (IndexedDB) — local-only persistence
- **React Router** (hash router) — deployable on any static host

## Setup

```sh
npm install
```

## Development

```sh
npm run dev        # start dev server
npm run build      # type-check + production build
npm run preview    # preview the production build
npm run lint       # ESLint (zero-warning policy)
npm run typecheck  # tsc, no emit
```

## Status

Phase 1 (skeleton: trips list + trip editor + item CRUD + grouping) is complete.
See [`STATUS.md`](./STATUS.md) for current work, [`_planning/backlog.md`](./_planning/backlog.md)
for what's next, and [`CHANGELOG.md`](./CHANGELOG.md) for completed milestones.

## Deployment

Static build (`dist/`) deploys to any static host (Netlify, Vercel static,
GitHub Pages, Cloudflare Pages). No server runtime required.

## Privacy

All trip data stays in your browser (IndexedDB). The only outbound request (added
in a later phase) is a user-triggered weather/geocoding lookup. No analytics.
