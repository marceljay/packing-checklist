# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- **Print / Save as PDF.** Print-only packing sheet grouped by category with
  hand-checkable boxes and quantities; `window.print()` covers print and
  Save-as-PDF (no extra deps, fully offline). New `itemsByCategory` helper.
- **Weather tags (Open-Meteo).** User-triggered forecast lookup for the primary
  destination derives weather tags (hot/cold/rainy/sunny/windy); clamps to the
  16-day forecast horizon; falls back gracefully when offline or not found.
- **Personal item library ("Your items").** Custom items now live in a global
  IndexedDB store (DB v2), not inside a single trip, so they resurface on future
  trips ranked by use count + recency. Tap to add; remove from the tray to forget.
- **Unit tests (Vitest).** 33 colocated tests covering the pure domain logic —
  `tagKey`, `tripDurationDays`, `destinationCode`, `computeQuantity`, and the
  suggestion engine (`suggestItems`: essentials, union matching, weighted
  ranking, reason chips, dedupe of already-added, quantity). `npm test` /
  `test:watch` / `test:ui`. Pinned Vitest v3 to match Vite 5 (clean output).
- **Visual overhaul — "Manifest" design system.** Travel-document identity:
  luggage-tag trip cards with IATA-style destination codes (`destinationCode()`),
  a boarding-pass stub editor header (route · dates · nights · packed gauge),
  airmail-striped accent edges, and a paper/ink-navy palette with one airmail
  vermilion accent. Type: Space Grotesk (display/UI) + Space Mono (codes/data).
  New tokens in `tailwind.config.js` + `src/index.css`; reduced-motion respected.
  Fonts load from Google Fonts (self-host later for full offline — backlog).

- Suggestion engine (rule-based): built-in tag catalog (~60 items) with
  union matching + weighted ranking; essentials always suggested; laundry-aware
  quantity rules (per-day/per-trip/bucket).
- Suggestions tray UI (ranked, reason chips, tap-to-add / add-all, hides items
  already on the list) and quick-add built-in activity/weather tag chips.
- Vite dev server binds `--host` on port 5000; devcontainer forwards the port.

### Changed
- Dropped **bags** and the **rent/buy-there/have-there** item statuses for v1;
  items are now simple check-off lines. Grouping is by category or tag.

- Project scaffold: Vite + React + TS + Tailwind SPA, ESLint (zero-warning),
  hash router, Dexie/IndexedDB persistence.
- Domain model (`src/types.ts`): Trip, typed Tags, Bags, Items with
  pack/rent/buy-there/have-there status and suggested/taken quantities.
- Trips list page: create, clone (deep id-remapped copy), delete.
- Trip editor (Phase 1): context panel (name, dates, destinations, typed tags,
  bags, laundry) and checklist with per-item quantity/status/bag/tags and
  grouping by category / bag / tag.
- `SPEC.md` — full specification from the requirements interview.
