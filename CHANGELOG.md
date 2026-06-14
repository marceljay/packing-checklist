# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
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
