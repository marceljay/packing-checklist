# Packing Checklist Web App — Specification

> Status: Draft v1 — derived from requirements interview (2026-06).
> Scope below is **v1** unless explicitly marked "Later".
>
> **⚠️ Scope changes since this draft (see CHANGELOG):** two concepts described
> below were **dropped from the built v1** — physical **bags** (bag assignment)
> and per-item **rent / buy-there / have-there** statuses. Items are now simple
> check-off lines grouped by category or tag. The implementation also adds the
> "Manifest" design system and a Vitest suite. Sections mentioning bags/statuses
> are kept for historical context but no longer reflect the code.

## 1. Summary

> The implemented data model is documented in [`DATA_MODEL.md`](./DATA_MODEL.md).

A privacy-first, offline-capable web app that helps a traveler build a packing
checklist tailored to a trip's destination, weather, duration, and activities —
then check items off in the browser or print/export them for offline use.

The app **suggests** items via a rule-based engine but never forces them on the
user: the traveler stays in control and pulls suggestions into the list. Items
carry quantities, a packing status (pack / rent / buy-there / have-there), and
are assigned to physical **bags**. Everything is stored locally; no accounts,
no server, no tracking.

### Core principles
- **Suggest, don't dictate.** The user often knows best; the engine proposes.
- **Local-first & private.** All data lives in the browser. No backend, no
  analytics that phone home.
- **Works where you pack.** Offline-capable PWA, mobile-first.
- **Three modes, one source of truth.** Generate → check off in-app → print/PDF.

---

## 2. Goals & Non-Goals

### Goals (v1)
- Create trips with destination(s), dates, and tags.
- Rule-based suggestion engine driven by a **typed-tag** system.
- Editable checklist with per-item quantity, status, bag assignment, and tags.
- Physical **bags** as the packing unit; group/filter items by bag, tag, or category.
- Weather lookup for a primary destination + manual extra condition tags.
- "Remember" custom items across trips (suggestion pool, frequent items, clone).
- Print (print-CSS) and PDF export.
- JSON import/export of all data.
- Offline PWA, mobile-first, accessible.

### Non-Goals (v1) — candidates for later
- User accounts, cloud sync, multi-device.
- Multiple travelers / family or group lists (single packer only in v1).
- Multi-leg itinerary modeling (replaced by tags + bags; see §4.1).
- LLM-generated lists (engine is deterministic rules in v1).
- Sharing/collaboration, social features.
- Native mobile apps (PWA install covers the need).

---

## 3. Personas & Primary Use Cases

- **The weekend tripper** — quick beach or city weekend; wants a fast, mostly
  pre-filled-by-suggestion list and a printout.
- **The multi-activity traveler** — e.g. a trip with surfing + hiking + a couple
  of nice dinners; needs multi-purpose items handled gracefully and gear marked
  as rented at destination.
- **The repeat packer** — takes similar trips often; wants past custom items and
  preferences to resurface so each new list is faster than the last.

### Representative scenarios the design must handle
1. **Multi-purpose item.** A merino shirt is useful both hiking and on cold city
   nights — it must surface for *either* reason and appear only once. (See §5.)
2. **Rented gear.** A surfboard is rented at the destination — it should appear
   as a reminder but **not** count toward any bag.
3. **Quantity + laundry.** Socks suggested ≈ trip length, but if laundry is
   available the suggested count drops.
4. **Mixed climate.** Primary destination is warm, but one side-trip is cold —
   user adds a `cold` condition tag manually to pull in warm layers.

---

## 4. Domain Model

All entities are stored locally (see §9). IDs are UUIDs.

### 4.1 Trip
```
Trip {
  id: string
  name: string                 // "Portugal surf + Lisbon, Oct 2026"
  startDate?: ISODate
  endDate?: ISODate
  destinations: Destination[]  // primary + optional others
  tags: Tag[]                  // active tags for this trip (see 4.4)
  bags: Bag[]                  // physical bags (see 4.3)
  items: Item[]                // the checklist (see 4.2)
  settings: {
    laundryAvailable: boolean  // reduces quantity suggestions
    suggestionRanking: 'weighted' // see §5.3
  }
  createdAt, updatedAt
}

Destination {
  id, label                    // "Lisbon, PT"
  lat?, lon?, countryCode?     // from geocoding
  isPrimary: boolean
  weather?: WeatherSnapshot    // cached lookup (see §6)
}
```

`tripDurationDays` is derived from start/end dates (default 7 if absent).

### 4.2 Item (a checklist line)
```
Item {
  id
  name: string                 // "Merino base layer"
  category: Category           // for grouping/print (see 4.5)
  tags: TagRef[]               // why it's here / how it's filtered
  status: 'pack' | 'rent' | 'buy-there' | 'have-there'
  quantitySuggested: number    // from the engine (may be null)
  quantityTaken: number        // what the user actually packs (editable)
  packed: boolean              // checked off
  bagId?: string               // which Bag it goes in (only if status='pack')
  source: 'suggested' | 'custom'
  reasons: ReasonChip[]        // derived: which active tags matched (display)
  notes?: string               // e.g. "blister plasters in front pocket"
}
```
- Only `status: 'pack'` items count toward bag contents and the "what to pack"
  totals. `rent` / `buy-there` / `have-there` render as reminders.
- `quantityTaken` is the printed/authoritative count; `quantitySuggested` seeds it.

### 4.3 Bag (the physical packing unit)
```
Bag {
  id, name                     // "Carry-on", "Checked", "Daypack"
  type?: 'carry-on'|'checked'|'daypack'|'personal'|'custom'
  notes?: string
}
```
- Default bags offered on a new trip: **Carry-on**, **Checked**. User adds more.
- Carry-on enables **liquid (100 ml) awareness** hints on toiletries (see §7.4).

### 4.4 Tag (typed) — the heart of suggestions & filtering
```
Tag {
  id
  label: string                // "surfing", "cold", "Lisbon", "kids' stuff"
  type: 'activity' | 'weather' | 'destination' | 'custom'
}
```
- **activity** & **weather** tags are drawn from a built-in catalog and carry
  **suggestion rules** (link to catalog items). Examples: `surfing`, `hiking`,
  `beach`, `business`, `skiing`, `camping`, `formal`, `swimming`; `hot`, `cold`,
  `rainy`, `humid`, `windy`, `variable`.
- **destination** tags are created from the trip's destinations; mostly used for
  filtering and to infer plug-adapter type (see §7.3).
- **custom** tags are free-text; they filter and group but trigger no built-in
  rules (though a custom item the user tagged with them will resurface — §8).
- Users may also add custom *activity/weather-style* tags; these behave like
  custom tags (no rules) unless mapped to the catalog later.

### 4.5 Category (fixed, for grouping & print order)
`Documents, Clothing, Footwear, Toiletries & Health, Electronics, Gear &
Equipment, Money & Cards, Comfort & Misc`. Catalog items declare a category;
custom items default to `Comfort & Misc` and are re-categorizable.

### 4.6 Suggestion Catalog (built-in, shipped with app)
```
CatalogItem {
  id, name, category
  tagLinks: { tagId, weight }[]   // many-to-many item<->tag
  quantityRule?: QuantityRule     // see §5.4
  flags?: { liquid?: boolean, perDestinationCountry?: boolean, ... }
}
```
The catalog is static data bundled in the app (a JSON/TS module), versioned so
it can grow without breaking saved trips.

---

## 5. Suggestion Engine (rule-based, deterministic)

### 5.1 Inputs
Active trip tags (activity/weather/destination), trip duration, laundry setting,
destination country codes.

### 5.2 Matching (union, not intersection)
A catalog item is suggested if **any** of its linked tags is active on the trip.
The item appears **once** (deduped by catalog id) regardless of how many tags
match. Each matching tag yields a **reason chip** (e.g. `Hiking · Cold`).

> Worked example — merino base layer linked to `hiking` (weight 2) and
> `cold` (weight 2):
> - Hiking-only trip → suggested, chip **Hiking**.
> - Cold city break → suggested, chip **Cold**.
> - Hiking + cold trip → suggested **once**, chips **Hiking · Cold**, ranked
>   higher (see 5.3).

### 5.3 Ranking (weighted)
Suggestion-tray ordering score = **sum of `weight` over matching active tags**.
Items matching more active tags (or higher-weight links) float to the top.
Ties broken by category order then name. This makes broadly-relevant,
multi-purpose items prominent without auto-adding anything.

### 5.4 Quantities
Each catalog item may carry a `QuantityRule`. Supported rule kinds:
- `perDay` — `ceil(days * factor)` capped at `max` (e.g. underwear: factor 1,
  max 10; socks: factor 1, max 10).
- `perTrip` — fixed count (e.g. toothbrush: 1).
- `perDaysBucket` — tiered by duration (weekend / week / 2+ weeks).
- `none` — checkbox only, no suggested count.

**Laundry modifier:** when `laundryAvailable` is true, `perDay`-style counts are
reduced via a configurable divisor (default: cap clothing at ~`min(suggested,
laundryCap)` where `laundryCap` ≈ 5–7). The exact formula is a tunable constant,
not hard-coded magic — expose it in one config module.

The engine only ever sets `quantitySuggested`; the user edits `quantityTaken`
freely (the "5× socks" case). Suggested vs taken are both visible.

### 5.5 Behavior in the UI
- Nothing is auto-added. Suggestions live in a **Suggestions tray** grouped by
  reason and ranked per §5.3; the user taps to pull an item into the list.
- Adding/removing trip tags re-computes the tray live.
- Already-added items are hidden from (or marked in) the tray to avoid dupes.
- A dismissed suggestion stays dismissed for that trip.

---

## 6. Weather

**Model (v1):** one **primary destination** drives an automatic weather lookup;
the user can add **manual condition tags** (`cold`, `rainy`, …) for side-trips or
to override. Additional destinations may be listed (for plug-adapter inference
and labeling) without each fetching weather in v1.

- **Provider:** [Open-Meteo](https://open-meteo.com) — free, no API key, CORS-
  friendly, offline-tolerant (we cache results).
  - Geocoding API → lat/lon + country code from a typed place name.
  - Forecast API when the trip falls within the ~16-day forecast window.
  - Climate/seasonal averages (historical) fallback when the trip is further out.
- **Output:** a `WeatherSnapshot` { tempMin, tempMax, precipChance, summary,
  source: 'forecast'|'climate', fetchedAt }. Cached on the destination so the
  app works offline after one online lookup.
- **Effect on suggestions:** the snapshot auto-activates derived weather tags
  (e.g. tempMax < 10 → `cold`; precipChance high → `rainy`). These are shown as
  suggested tags the user can confirm/remove — consistent with "suggest, don't
  dictate." Manual condition tags always win.
- **Failure/offline:** if lookup fails, fall back silently to manual condition
  tags; show a small "couldn't fetch weather — add conditions manually" note.

---

## 7. Built-in Essentials Logic

These are catalog items with special triggers, surfaced as suggestions.

### 7.1 Travel documents
Suggested based on trip type. International trip (destination country ≠ home, or
user marks "international") adds passport, visa reminder, travel insurance;
domestic adds ID/driver's license. Tickets/boarding passes always suggested.

### 7.2 Health / toiletries
Toiletries kit, plus a **personal meds** prompt — the user enters their own
(e.g. specific prescriptions); these become custom items that are **remembered**
for future trips (§8). Prescriptions flagged to keep in carry-on.

### 7.3 Electronics + adapters
Chargers, power bank suggested generally. **Plug adapter type** inferred from
each destination's country code via a bundled static
`country → plug type(s) + voltage` dataset; suggestion reads e.g. "Type F adapter
(Portugal)". No network needed.

### 7.4 Carry-on liquid (100 ml) awareness
Items flagged `liquid: true` assigned to a **carry-on** bag show a 100 ml hint.
This is advisory only — no enforcement.

---

## 8. Remember / Personalization (local)

When a user adds a **custom** item, it is captured for reuse three ways
(all three ship in v1):

1. **Suggestion pool by trip type/tags** — custom items are stored with the tags
   active when added; they resurface in the Suggestions tray on future trips
   whose active tags match (same union logic as the catalog).
2. **Frequent items** — globally track add-frequency; most-added custom items
   surface in a "You often pack…" section regardless of tags.
3. **Clone from past trip** — start a new trip by duplicating a previous trip's
   items/bags/tags wholesale, then edit.

Stored in a local **profile store** separate from individual trips so it persists
across trips (and is included in JSON export). No personal data leaves the device.

> Note: editable *rule profiles* (user rewriting engine rules) are out of scope
> for v1; the above covers the "remember my stuff" need without exposing rule
> internals.

---

## 9. Persistence, Import/Export

- **Store:** IndexedDB via a thin wrapper (recommended: **Dexie**) for trips +
  profile store. Chosen over `localStorage` for capacity and structured queries;
  still 100% client-side.
- **Schema versioning:** a `schemaVersion` field with migration functions, so the
  bundled catalog and saved data can evolve safely.
- **Export:** download a single JSON file containing all trips + profile (the
  full app state). This is also the backup mechanism (no cloud).
- **Import:** load a JSON file; offer **merge** vs **replace**. Validate against
  the schema and run migrations on import.
- **No accounts, no server, no telemetry.** State this in the UI/privacy note.

---

## 10. UI / UX

### 10.1 Navigation & flow
- **Default trip flow (v1): Blank list + quick-add panel.** A new trip opens
  essentially empty; a side/bottom **quick-add panel** lets the user set
  destination, dates, tags, and bags at any time. Suggestions update live as
  context is added. This matches the "try it and give feedback" preference and
  has the lowest friction.
  - *(Later / optional):* a skippable short wizard as an onboarding overlay on
    top of the same editor. Build the editor as the core so the wizard is purely
    additive.

### 10.2 Key screens
1. **Trips list (home)** — all saved trips, "New trip", "Clone", import/export.
2. **Trip editor** — the main workspace:
   - **Context panel** (quick-add): destination(s) + dates, weather summary,
     active tags (add/remove), bags, laundry toggle.
   - **Checklist** — the items, with three switchable groupings:
     **by Category** (default & print order), **by Bag**, **by Tag**.
   - Each item row: name, qty suggested→taken (editable stepper), status
     selector (pack/rent/buy-there/have-there), bag picker (when packing),
     reason chips, packed checkbox, overflow (notes, delete, retag).
   - **Suggestions tray** — collapsible, grouped by reason, weighted order,
     tap-to-add; plus "You often pack…" and per-tag custom-item resurfacing.
   - Progress indicator (packed / to-pack counts; excludes non-pack statuses).
3. **Print / Export view** — see §11.

### 10.3 Interaction details
- Mobile-first: thumb-reachable add/check controls; quick-add as a bottom sheet
  on small screens, side panel on desktop.
- Live recompute of suggestions when tags/weather/duration change.
- Non-pack statuses visually distinct (e.g. muted, "Rent" badge) and excluded
  from bag totals but included in printed reminders.
- Empty states guide first-time users ("Add a destination or a tag to see
  suggestions").

### 10.4 Constraints (baked in)
- **Mobile-first responsive** across phone → desktop.
- **PWA / offline:** installable, service worker caches app shell + catalog +
  prior weather lookups; full functionality offline (weather lookup degrades to
  manual tags). Implemented with `vite-plugin-pwa` (Workbox).
- **Privacy / no tracking:** no third-party analytics; only outbound request is
  the user-triggered weather/geocoding call to Open-Meteo. Document this.
- **Accessibility:** keyboard navigable, ARIA labels on controls, visible focus,
  WCAG AA contrast, screen-reader-friendly checklist semantics, respects
  reduced-motion. Prefer accessible headless primitives (Radix/Headless UI).

---

## 11. Print & PDF Output

Two outputs, both grouped by **Category** by default (bag/tag grouping optional):

1. **Print (print-CSS)** — `@media print` strips app chrome; renders a clean
   checklist with real check boxes, quantities inline (e.g. `☐ 5× socks`),
   category headings, trip name + dates header, fits 1–2 pages. Triggered via
   `react-to-print` for reliable scoping.
2. **PDF export** — downloadable file for sharing/archiving, using
   **`@react-pdf/renderer`** (declarative layout control, no headless browser).
   Same content/structure as the print view.

Print/PDF content rules:
- `pack` items: checkbox + `quantityTaken×` + name (+ bag label if grouped by
  category and multiple bags exist).
- `rent` / `buy-there` / `have-there`: rendered in a separate **"Arrange at
  destination / don't pack"** section as reminders (no pack checkbox count).
- Options before printing: grouping (category/bag/tag), include-reasons on/off,
  include notes on/off, include reminders section on/off.

---

## 12. Tech Stack

Chosen for a static, client-only, offline-capable SPA that one person can
maintain.

| Concern | Choice | Why |
|---|---|---|
| Build/tooling | **Vite + React + TypeScript** | Fast, static output, simplest deploy |
| Styling | **Tailwind CSS** | Mobile-first utilities, easy print styles |
| State | **Zustand** | Tiny, ergonomic; pairs with persistence |
| Persistence | **IndexedDB via Dexie** | Capacity + structured data, fully local |
| Routing | **React Router** | Trips list ↔ editor ↔ print view |
| Accessible UI | **Radix UI / Headless UI** | A11y primitives out of the box |
| PWA/offline | **vite-plugin-pwa (Workbox)** | Installable + offline cache |
| Print | **react-to-print + print CSS** | Scoped, reliable browser print |
| PDF | **@react-pdf/renderer** | Declarative PDF, no heavy headless dep |
| Weather/geocode | **Open-Meteo APIs** | Free, no key, CORS-ok, cacheable |
| Plug adapters | **bundled static dataset** | Offline country → plug/voltage |

**Hosting:** any static host (Netlify / Vercel static / GitHub Pages / Cloudflare
Pages). No server runtime required.

---

## 13. Edge Cases & Decisions

- **Multi-purpose items** → union matching + dedup + multi-reason chips (§5.2).
- **Rented / at-destination gear** → item `status` excludes them from bags but
  keeps them as printed reminders (§4.2, §11).
- **Distant-future trips** (beyond forecast) → climate-average fallback (§6).
- **Mixed climates in one trip** → manual condition tags supplement the primary
  destination's auto weather (§6).
- **Laundry** → quantity divisor reduces `perDay` suggestions (§5.4).
- **Offline at packing time** → PWA cache + previously fetched weather; weather
  lookup degrades gracefully to manual tags (§6, §10.4).
- **Catalog growth without data breakage** → versioned catalog + schema
  migrations (§4.6, §9).
- **Duplicate suggestions** → already-added items hidden/marked in the tray (§5.5).
- **Data loss risk (local-only)** → prominent JSON export/backup; import
  merge/replace (§9).
- **Unit/locale** → temperature unit (°C/°F) and date format follow a user
  setting (default from browser locale).

### Open questions to resolve via prototype feedback
- Exact laundry divisor / clothing caps (tune with real trips).
- Whether the optional onboarding wizard is worth adding after the blank-list
  editor is in use.
- Whether to fetch weather for *secondary* destinations (v1 = primary only).
- Catalog breadth for launch (which activities/items to seed first).

---

## 14. Suggested Build Phases

1. **Skeleton** — Vite/React/TS, Tailwind, routing, Dexie store, trips
   list + blank trip editor, manual item CRUD, grouping by category/bag/tag.
2. **Engine + tags** — typed tags, catalog (seed set), union matching + weighted
   suggestions tray, quantity rules + laundry, per-item status.
3. **Bags + essentials** — bag assignment, documents/health/electronics logic,
   plug-adapter dataset, carry-on liquid hints.
4. **Weather** — Open-Meteo geocode/forecast/climate, derived weather tags,
   caching + offline fallback.
5. **Remember** — profile store, suggestion pool, frequent items, clone-from-trip.
6. **Output** — print-CSS view + react-to-print, PDF export, print options.
7. **Polish** — PWA/offline, accessibility pass, import/export UX, settings
   (units/locale), empty states.

---

## 15. Acceptance Criteria (v1)

- Create, edit, clone, delete trips; all data persists locally across reloads.
- Adding activity/weather tags produces ranked suggestions; multi-purpose items
  appear once with all reasons; nothing is auto-added.
- Items support editable suggested→taken quantities, four statuses, bag
  assignment, tags, notes, and check-off; non-pack items excluded from bag totals.
- Weather lookup works for a primary destination online and degrades to manual
  condition tags offline.
- Custom items resurface on matching future trips and via frequent/clone paths.
- Clean print output and a downloadable PDF, both grouped by category with
  quantities and a separate reminders section.
- Full JSON export/import (merge or replace) round-trips all data.
- Installable PWA usable fully offline; mobile-first; meets WCAG AA basics.
