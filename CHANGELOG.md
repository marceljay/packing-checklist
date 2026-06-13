# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- Project scaffold: Vite + React + TS + Tailwind SPA, ESLint (zero-warning),
  hash router, Dexie/IndexedDB persistence.
- Domain model (`src/types.ts`): Trip, typed Tags, Bags, Items with
  pack/rent/buy-there/have-there status and suggested/taken quantities.
- Trips list page: create, clone (deep id-remapped copy), delete.
- Trip editor (Phase 1): context panel (name, dates, destinations, typed tags,
  bags, laundry) and checklist with per-item quantity/status/bag/tags and
  grouping by category / bag / tag.
- `SPEC.md` — full specification from the requirements interview.
