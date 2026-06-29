# Architecture

A client-only React SPA (Vite + TypeScript + Tailwind). There is no backend: the
whole app state is one versioned JSON document in `localStorage`, and the only
network calls are weather/geocoding lookups to Open-Meteo (with a bundled offline
fallback). This doc covers how the pieces fit; for the persisted shape and entity
relationships see [`DATA_MODEL.md`](DATA_MODEL.md).

## Layers

```
pages/        route screens (trips list, items, trip editor) + useTripEditor hook
components/   presentational + interactive UI (cards, dialogs, checklist, forecast)
engine/       pure domain logic: suggestions, weather lookup/derivation, climate
db/           the localStorage store, migrations, and the editable registries
data/         static seed data: item catalog, tags, plug/voltage, generated cities
lib/          cross-cutting helpers: units, theme, dev mode, file I/O, settings
types.ts      shared types + small pure helpers (ids, quantity, trip predicates)
```

The dependency direction is one-way: `pages` → `components` → `engine`/`db` →
`data`/`lib`/`types`. Engine modules are pure and unit-tested; React state lives
in components and the `useTripEditor` hook.

## State & persistence

- **One JSON document** (`localStorage` key `packing-checklist`) owned by
  `src/db/store.ts`: a synchronous in-memory copy exposed to React via
  `useSyncExternalStore` (`useAppData`).
- **Loading normalizes, it doesn't upgrade.** On load, `normalizeAppData()` (`src/db/appData.ts`)
  takes the parsed JSON and coerces it into a valid document in memory — defaulting
  missing fields and dropping garbage — so a corrupt or older document can't crash
  the app. There is no versioned schema-upgrade machinery; `schemaVersion`
  (currently 3) is stamped on save and the field exists for future transforms.
  Built-ins are seeded idempotently on boot.
- **Editable registries** for tags (`src/db/tags.ts`) and categories
  (`src/db/categories.ts`): rename/delete are global and rewrite every
  referencing item and trip so associations never drift. Tombstones
  (`removedDefaultIds`, `removedTagKeys`, `removedCategories`) let a user hide a
  built-in without it being re-seeded.

## Item library & suggestions

- The **library is the single source of truth**: built-in defaults are _seeded_
  into it (`custom:false`), user items are `custom:true`, and a trip's `Item` is a
  thin reference (`libraryId` + per-trip `quantityTaken`/`quantitySuggested`/
  `packed`) resolved at render by `resolveItems`. See `DATA_MODEL.md` for identity
  and reference-integrity details.
- **Suggestions** (`src/engine/suggest.ts`): an item is suggested if it is an
  _essential_ or any of its `tagKeys` matches an active trip tag. Score is the
  count of matched tags (no per-tag weights), ties break by usage count then name.
  Quantities come from `computeQuantity` (per-day / per-trip / bucket rules scaled
  to trip length and reduced when laundry is available).

## Weather

A trip's destinations + date window drive an automatic forecast lookup whose daily
aggregates become **weather tags** that feed suggestions, and whose summary is
shown in the forecast card. The engine lives in `src/engine/weather.ts`;
`src/engine/weatherSync.ts` is the testable glue (`refreshWeather` runs the
injectable lookup, `applyWeather` writes tags + `TripWeather` onto a trip draft).

### Data sources

1. **Forecast** (Open-Meteo forecast API) — near-future dates; provides every
   metric including `uv_index_max`.
2. **Historical archive** (Open-Meteo archive/ERA5) — far-future dates reuse the
   same dates a year back as a "typical" proxy; provides sunshine **but not UV**.
3. **Offline climate normals** (bundled monthly data, `src/engine/climate.ts`) —
   used when the network is unavailable; temperature + precipitation only (**no
   sunshine, UV, or wind**).

A window can be `mixed` (forecast for the near part, archive for the rest).
`fetchDaily` requests `temperature_2m_max/min`, `precipitation_sum`,
`wind_speed_10m_max`, `sunshine_duration` (→ hours), and `uv_index_max`; missing
series come back empty and every downstream step tolerates their absence.

### Derived tags (`deriveWeatherTags`)

| Tag       | Rule                                                                  |
| --------- | --------------------------------------------------------------------- |
| **hot**   | more than 20% of days have a high > 25 °C                             |
| **cold**  | avg low ≤ 5 °C, or any day ≤ 0 °C                                     |
| **rainy** | ≥ 40% of days wet (≥ 1 mm), or ≥ 20 mm total                          |
| **sunny** | avg sunshine > 5 h/day, plus avg daily-peak UV ≥ 5 when UV is present |
| **windy** | any day with gusts ≥ 35 km/h                                          |

`sunny` always needs sunshine; when UV is present (forecast) it must also clear 5.
The historical archive has no UV, so it falls back to **sunshine alone**; offline
normals carry neither, so sunny can't fire there (a heuristic offline proxy is a
deferred follow-up).

### Surfacing the forecast

`summarizeWeather` produces a `CityForecast`: average daily high/low, warmest/
coldest extremes, total precipitation, **average daily gusts** (`windAvgKmh`), avg
**sunshine h/day**, and a **UV range** (`uvMin`/`uvMax`). Each `CityDay` also
carries that day's sunshine and UV peak. The `WeatherCard` shows the per-location
summary and an expandable **Day by day** breakdown (capped on mobile with a
"load more"); the same data prints on the sheet. Removing a destination
re-derives tags locally (each `CityForecast` remembers which tags it contributed)
and offers to drop the items that tag had pulled in.

## Internationalization of trips (adapters)

A trip is flagged international when its destinations span more than one country
(or the user ticks the box). `src/data/plugs.ts` maps countries to plug type(s)
and mains voltage; the Trip-type panel surfaces them with one-tap "Add travel
adapter", and home-country preference (`src/lib/homeCountry.ts`) tailors the
advice. Passport/visa-check items are gated to international trips via
`essentialWhen`.

## Routing, units, theme

- **React Router** hash router (`src/main.tsx`) — three screens under a shared
  layout: trips list, items library, and the trip editor (`Plan` / `Checklist`
  modes). Hash routing keeps it deployable on any static host.
- **Units** (`src/lib/units.ts`): values are stored in metric and converted for
  display via a `useUnits` store; a header toggle switches °C/°F (metric/imperial).
- **Theme** (`src/lib/theme.ts`): light / dark / system, persisted; _system_
  follows `prefers-color-scheme`.
- **Dev mode** (`src/lib/devMode.ts`): ticket-design / field-style overrides for
  iterating on the "Manifest" visual identity.

## Offline & bundled data

`npm run gen:city-data` generates `src/data/` from `all-the-cities` (GeoNames) and
`michaelx/climate`. With no network — including the double-clicked single-file
build — destination search falls back to ~1,000 bundled cities and weather to
monthly climate normals for 104 of them (nearest within a 750 km cap).

## Build, test, deploy

- **Vitest** unit tests cover the engine (suggestions, weather derivation/sync,
  climate), db registries, and helpers. Lint runs a zero-warning policy.
- `npm run build` type-checks then produces a static `dist/` (relative asset
  paths, routing after the `#`) that deploys to any static host with no server
  runtime or rewrite rules.

## Known tradeoffs / future

- **Replace-all library import** can orphan trip references by `id` (see
  `DATA_MODEL.md`); the UI warns but the data layer doesn't remap.
- **Offline gaps**: climate normals carry no wind/sunshine/UV, so the `windy` and
  `sunny` tags can't fire offline, and climate coverage is sparse (104 cities).
- Some code comments still reference the removed `SPEC.md` section numbers; the
  spec was retired in favour of this doc + `DATA_MODEL.md`.
  </content>
  </invoke>
