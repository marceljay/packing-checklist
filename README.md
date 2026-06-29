# Packing Checklist

A privacy-first, offline-capable web app that builds packing checklists tailored
to a trip's destination, weather, duration, and activities — then lets you check
items off in the browser or print them for offline use.

The app **suggests** items via a rule-based engine but never forces them on you:
you tag your trip (activities, weather, places), and matching items surface in a
ranked "Recommended" tray for you to pull into the list. Each item carries a
suggested quantity (laundry-aware) that you can adjust, and you check items off as
you pack. Everything is stored locally — no accounts, no server, no tracking.

See [`docs/architecture.md`](./docs/architecture.md) for how the app is built and
[`DATA_MODEL.md`](./docs/DATA_MODEL.md) for the persisted data model.

## Features

- **Trips** — create, duplicate, and delete trips; each gets an IATA-style
  destination code derived from its primary destination. Abandoned, never-edited
  trips are pruned automatically.
- **Tag-driven suggestions** — quick-add activity/weather tags (beach, hiking,
  climbing, festival, cold, rainy…) or add custom ones; the **Recommended** tray
  ranks your item library by how many active tags an item matches (ties broken by
  how often you've used it) and shows why each was suggested.
- **Smart quantities** — per-day / per-trip / bucket rules scaled to trip length
  and reduced when laundry is available; you can also set a default quantity per
  item.
- **Automatic weather** — adding a destination (or changing the dates) fetches the
  forecast from Open-Meteo and derives hot/cold/rainy/sunny/windy tags (near dates
  use the live forecast, far dates a year-ago "typical" archive). A
  per-destination **forecast card** shows highs/lows, rain, average gusts, average
  sunshine, and a UV range, plus an expandable **day-by-day** breakdown — all with
  a **°C/°F (metric/imperial)** toggle. It refreshes when you open a trip and falls
  back to bundled climate normals offline. Removing a destination re-derives the
  tags and offers to drop the items that tag had pulled in.
- **Item library (single source of truth)** — every item lives in one editable
  library shared across trips (built-in defaults + your own). Edit a name,
  category, tags, notes, default quantity, or mark it **essential** (suggested on
  every trip). Search, filter by tag or essentials, and restore built-in defaults
  you've changed or removed.
- **International trips & travel adapters** — flagged international automatically
  when destinations span more than one country (or tick the box yourself); shows
  each country's plug type(s) and mains voltage, and offers a separate one-tap
  adapter item per plug type you actually need (each noting the countries and
  regions that use it).
- **Light / dark / system theme** — a header toggle; _system_ follows your OS.
- **Backup & transfer** — an **Export** picker lets you choose which trips and/or
  the whole item library to download as JSON, and import them back later.
- **Print / Save as PDF** — a clean, category-grouped sheet you can print or save
  as PDF straight from the browser.

## Tech stack

- **Vite** + **React 18** + **TypeScript** — static, client-only SPA
- **Tailwind CSS** — the "Manifest" travel-document design system, with
  self-hosted **Space Grotesk** + **Space Mono** (no font CDN)
- **Persistence** — the whole app state is one versioned JSON document in
  `localStorage` (no backend, no IndexedDB); migrations are pure object transforms
- **React Router** (hash router) — deployable on any static host
- **Vitest** — unit tests for the domain logic, suggestion engine, and helpers

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

See [`CHANGELOG.md`](./CHANGELOG.md) for completed milestones. Day-to-day status
and the forward backlog are kept in the project's local planning workspace
(outside the repo).

## Deployment

The static build (`dist/`) deploys to any static host (Netlify, Vercel static,
GitHub Pages, Cloudflare Pages) or a plain web root — assets use relative paths
and routing lives after the URL `#`, so no server runtime or rewrite rules are
required.

## Privacy

All trip and library data stays in your browser's `localStorage` — no analytics,
no accounts, no tracking. Fonts are bundled with the app (no CDN call). The only
outbound request is the weather/geocoding lookup (Open-Meteo), which sends only a
destination name and coordinates; it runs when you add a place, change dates, or
open a trip. With no network (including the double-clicked single-file copy), it
falls back to **bundled offline data**: ~1,000 cities for destination search and
monthly climate normals for 104 of them for an approximate forecast.

## Data & credits

Offline city/climate data is generated by `npm run gen:city-data` and committed
under `src/data/`:

- City coordinates from [`all-the-cities`](https://www.npmjs.com/package/all-the-cities)
  (GeoNames, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
- Monthly climate normals from [`michaelx/climate`](https://github.com/michaelx/climate).

Live weather and geocoding are from [Open-Meteo](https://open-meteo.com/)
([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
