# Packing Checklist

A privacy-first, offline-capable web app that builds packing checklists tailored
to a trip's destination, weather, duration, and activities — then lets you check
items off in the browser or print them for offline use.

The app **suggests** items via a rule-based engine but never forces them on you:
you tag your trip (activities, weather, places), and matching items surface in a
ranked "Recommended" tray for you to pull into the list. Each item carries a
suggested quantity (laundry-aware) that you can adjust, and you check items off as
you pack. Everything is stored locally — no accounts, no server, no tracking.

See [`SPEC.md`](./SPEC.md) for the full specification.

## Features

- **Trips** — create, duplicate, and delete trips; each gets an IATA-style
  destination code derived from its primary destination.
- **Tags drive suggestions** — quick-add activity/weather tags (beach, hiking,
  cold, rainy…) or add custom ones; the engine ranks matching catalog items by
  weight and shows why each was suggested.
- **Smart quantities** — per-day / per-trip / bucket rules scaled to trip length,
  reduced when laundry is available.
- **Manifest checklist** — adjustable quantities, packed check-off with a packed
  meter, and grouping by category or tag.

## Tech stack

- **Vite** + **React 18** + **TypeScript** — static, client-only SPA
- **Tailwind CSS** — the "Manifest" travel-document design system
  (Space Grotesk + Space Mono, paper/ink palette)
- **Dexie** (IndexedDB) — local-only persistence
- **React Router** (hash router) — deployable on any static host
- **Vitest** — unit tests for the domain logic and suggestion engine

## Setup

```sh
npm install
```

## Development

```sh
npm run dev         # start dev server (binds --host on port 5000)
npm run build       # type-check + production build
npm run preview     # preview the production build
npm run lint        # ESLint (zero-warning policy)
npm run typecheck   # tsc, no emit
npm test            # run the Vitest suite once
npm run test:watch  # tests in watch mode
npm run test:ui     # tests in the browser UI
```

## Status

The suggestion engine, tag system, and the "Manifest" visual design are in place,
with unit tests over the domain logic. See [`STATUS.md`](./STATUS.md) for current
work, [`_planning/backlog.md`](./_planning/backlog.md) for what's next (print/PDF
output, weather lookup), and [`CHANGELOG.md`](./CHANGELOG.md) for milestones.

## Deployment

Static build (`dist/`) deploys to any static host (Netlify, Vercel static,
GitHub Pages, Cloudflare Pages). No server runtime required.

## Privacy

All trip data stays in your browser (IndexedDB) — no analytics, no accounts.
The current outbound request is for web fonts (Google Fonts CDN); self-hosting
those for full offline use is on the backlog. A user-triggered weather/geocoding
lookup is planned for a later phase.
