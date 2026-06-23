# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Fixed
- **Edited or removed built-in items now stick.** Deleting a default item, or
  editing one (which forks it into your own copy), survives a reload — the boot
  seeder no longer resurrects it, so trip-page edits show correctly in the Item
  Library instead of reappearing as the original. **Restore defaults** brings
  removed built-ins back.

### Added
- **More activity tags + items.** Added **climbing, BBQ, road trip, and festival**
  as quick-add tags, each with relevant suggestions (climbing shoes/harness/chalk,
  BBQ tools, car charger/snacks/cool box, earplugs/poncho/wellies/power bank, a
  shared first-aid kit). New built-ins appear automatically on next load.
- **"Essential" is now visible and editable everywhere.** An item being suggested
  on every trip (an essential) is a property, not a tag — it shows in the item's
  info panel and has a checkbox in **both** the Item Library edit form and the
  trip-page item editor. The Item Library filter row has an **essentials** chip to
  show just those. (Editing a built-in forks it into your own copy, as with any
  edit; "Restore defaults" brings the original back.)
- **Smarter forecast upkeep.** Opening a trip refreshes its forecast (falling back
  to the cached card when offline). Removing a destination re-derives the weather
  tags instantly from the remaining cities (no network, no flakiness) — and if
  that orphans items (e.g. removing the only cold place leaves a beanie behind),
  an in-app dialog asks whether to remove the city with those items, keep the
  items, or cancel.
- **Default item quantities.** An item in the Item Library can carry a default
  quantity (set it in the edit form); adding that item to a trip starts at it.
- **International trips & travel adapters.** A trip is flagged international
  automatically when its destinations span two or more countries, with a
  **checkbox** to set it yourself when there's only one (or no) detected country.
  International trips show a **Power & plugs** panel — each destination country's
  plug type(s) and mains voltage — plus a one-tap **Add travel adapter**. Backed
  by a country→plug/voltage dataset for ~50 common destinations.
- **°C/°F (metric/imperial) toggle.** A switch on the forecast card flips the
  weather between metric and imperial — temperatures (°C/°F), precipitation
  (mm/in), and wind (km/h/mph). The choice persists across trips.
- **Fonts are bundled, not fetched.** Space Grotesk and Space Mono ship with the
  app instead of loading from Google Fonts, so it renders fully offline with no
  external request.
- **Icon buttons.** The info / edit / delete actions in the Item Library (and the
  edit/remove actions on a trip's items) use real line icons instead of unicode
  glyphs.
- **No past trip dates.** The date-range calendar disables days before today, so
  a trip can't start in the past.
- **Automatic weather lookup.** The forecast now runs on its own when you add a
  place or set the trip dates (still skipped silently until dates exist); the
  button became a manual **Refresh forecast**. Overlapping lookups can't clobber
  each other with stale results.
- **Light / dark / system theme.** A header button cycles Light → Dark → System;
  the choice persists and System tracks the OS live. The whole palette moved to
  CSS variables, so every surface repaints with no flash on load.
- **Export / import all trips.** The header ⋯ menu can now export **every trip**
  (plus the library rows they reference) as one backup file and import it back,
  each trip restored as a new, independent trip.
- **Suggestions read your library.** Recommendations are now drawn from the Item
  Library (defaults *and* your custom items) rather than a fixed catalog, so
  edits, removals, and new custom items change what's suggested. Ranking is by
  number of matched tags, ties broken by how often you've used the item.
- **Item Library, reworked.** Items show their tags as chips; **category and
  default/custom status moved into an ⓘ info panel** (with an optional notes /
  description field) instead of inline badges. The three view tabs are gone —
  it's always grouped by category, with a **clickable tag-filter** row up top
  (pick one or more tags to narrow the list) plus search. Tags are edited with a
  **chip editor** (type + Enter/comma adds, ✕ removes, known tags autocomplete).
- **Editing a built-in default forks it into your own copy** (its id changes to a
  custom one and your trips follow the edit), and a **Restore defaults** button
  re-adds any built-ins you removed or edited — leaving your custom items alone.
- **Abandoned trips don't linger.** A "New trip" you create but never edit is
  dropped when you return to the trips list.
- **Storage is now a single JSON document** in `localStorage` instead of
  IndexedDB/Dexie. Migrations became pure object transforms (no schema-upgrade
  failures), and the in-app state matches the export shape. Existing IndexedDB data
  is imported once on first load. Reactivity uses `useSyncExternalStore`.
- **Collision-safe item identity.** Built-in defaults get a deterministic id
  (`d:<catalogId>`, identical on every install — so importing someone else's library
  never duplicates the built-ins), and custom items get a collision-resistant random
  id (`c:…`, so two same-named items like surf vs. snow "gloves" stay distinct and
  merging foreign libraries doesn't clash). Identity is the id, never the name.
- **Header menu + item-library backup.** A `⋯` menu in the header (hidden until
  opened) gathers the transfer actions: **Import trip**, and **Export / Import the
  whole item library** as JSON. Library import de-dups by id (your existing items
  win). Trip import moved out of the trips page into this menu.
- **One item, everywhere — the library is now the single source of truth.** A
  trip's packing line is a *reference* to a library item plus its per-trip quantity
  and packed state; the item's name, category, and tags live once in the library.
  Editing an item while planning a trip (via the new **pencil**) edits the library
  entry, so the change shows on every trip that uses it. Library items now have a
  short, readable id (e.g. `shi417`) that survives renames. Existing trips migrate
  automatically on first load; trip export bundles the items it needs so files stay
  portable (older exports still import). An item's **id is its identity** (the
  database key), so import de-duplicates by id — re-importing your own data never
  forks an item, while two genuinely separate items may share a name.
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
- **Two-column Item Library.** Category cards flow into a responsive two-column
  masonry on wider screens (single column on phones) instead of stretching full
  width.
- **Home is now two full-width tabs** — **Your trips** and **Item library** —
  spanning the content width, instead of a separate page reached by a link. The
  active tab follows the route (`/` and `/items`), so deep links and back/forward
  still work.
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
