# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- **One item, everywhere — the library is now the single source of truth.** A
  trip's packing line is a *reference* to a library item plus its per-trip quantity
  and packed state; the item's name, category, and tags live once in the library.
  Editing an item while planning a trip (via the new **pencil**) edits the library
  entry, so the change shows on every trip that uses it. Library items now have a
  short, readable id (e.g. `shi417`) that survives renames. Existing trips migrate
  automatically on first load; trip export bundles the items it needs so files stay
  portable (older exports still import).
- **Search the item library.** A search box on the Item Library page filters by
  name, tag, or category (case-insensitive) across all three views, with a clear
  no-match state. Backed by a unit-tested `searchLibrary` helper.
- **Unified item library.** Built-in defaults + your custom items now live in one
  editable store (seeded on first run, each flagged default/custom). The **Item
  Library** page (`/items`, reachable from the trips page) has three expandable
  views — by category, by tag, all — with tag rename/remove and an **Add custom
  item** form on top.
- **Add item card** on the trip Plan tab — a dedicated card above the list where
  you set name, **category and tags**; the item is saved to your library and
  reusable on future trips.
- **Plan / Checklist tabs.** The trip page splits into a **Plan** tab (build/edit
  the list — no checkboxes) and a **Checklist** tab (check items off with a
  progress bar). Same trip, two focused views.
- **Item Library page** (`/items`) — manage every item (defaults + your own) in
  three views (by category / tag / all), edit each via a pencil, search, and
  rename/remove tags across the whole library.
- **Destination autocomplete.** Type a place and pick from geocoded matches
  (Open-Meteo) with region/country; selecting stores lat/lon + country code
  (sharpens the IATA code and weather lookup). Free-text add still works offline.
- **Import / export trips (JSON).** Export any trip to a JSON file and import it
  back as a new, independent trip (ids regenerated, references rewired). Local-only
  portability/backup — no account. TDD'd serialize/parse.
- **Print / Save as PDF.** Print-only packing sheet grouped by category with
  hand-checkable boxes and quantities; `window.print()` covers print and
  Save-as-PDF (no extra deps, fully offline). New `itemsByCategory` helper.
- **Weather tags + forecast card (Open-Meteo).** User-triggered lookup for
  **every destination** (up to 5) derives weather tags (union across cities) and
  shows a **per-city forecast card** (avg high/low, range, rain, wind, days),
  cached on the trip. Uses **live forecast for the next 7 days** and **historical
  typical weather** (same dates averaged over recent years) beyond that — a trip
  spanning the boundary shows a mixed summary. Uses stored coordinates; needs
  trip dates; falls back gracefully when offline.
- **Personal item library.** Custom items live in a global IndexedDB store, not
  inside a single trip, so they resurface on future trips. Managed from the Item
  Library page (the per-trip "Your items" tray was removed — add items via the
  Add custom item card or suggestions).
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
- **Date range picker.** The two date fields are replaced by a single range
  calendar in a popover (react-day-picker, themed to match) — pick start and end
  as one highlighted range. Fixes the date-field overflow in the context panel.

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
