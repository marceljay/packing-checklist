import { useEffect, useRef, useState } from "react";
import type {
  Trip,
  TagType,
  LibraryItem,
  Destination,
  CityForecast,
} from "../types";
import {
  tagKey,
  tripDurationDays,
  isInternationalTrip,
  tripCountryCodes,
  tripItemsWithAnyTag,
} from "../types";
import { uid } from "../db/store";
import { rememberItem } from "../db/library";
import { powerSummary } from "../data/plugs";
import { BUILTIN_TAGS } from "../data/tags";
import { placeLabel, type GeoResult } from "../engine/weather";
import {
  refreshWeather,
  applyWeather,
  recomputeWeatherAfterRemoval,
  type WeatherDest,
} from "../engine/weatherSync";
import DateRangeField from "./DateRangeField";
import PlaceSearch from "./PlaceSearch";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
  /** Library rows by id, to resolve item tags when pruning after a destination removal. */
  library: Map<string, LibraryItem>;
}

const TAG_TYPE_STYLES: Record<TagType, string> = {
  activity: "bg-stamp-soft text-stamp",
  weather: "bg-airblue-soft text-airblue",
  destination: "bg-vermilion-soft text-vermilion-deep",
  custom: "bg-paper-sunk text-ink-soft",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="label">{children}</span>;
}

/** A labelled, wrapping palette of quick-add tag chips. */
function TagPalette({
  label,
  tags,
  onAdd,
}: {
  label: string;
  tags: { key: string; type: TagType }[];
  onAdd: (key: string, type: TagType) => void;
}) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 font-mono text-[0.625rem] uppercase tracking-code text-ink-faint">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((b) => (
          <button
            key={b.key}
            className="chip border border-dashed border-line bg-transparent text-ink-soft transition-colors hover:border-solid hover:border-ink/30 hover:bg-paper-sunk hover:text-ink"
            onClick={() => onAdd(b.key, b.type)}
          >
            + {b.key}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ContextPanel({ trip, update, library }: Props) {
  const [tagLabel, setTagLabel] = useState("");
  const [weatherStatus, setWeatherStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [weatherMsg, setWeatherMsg] = useState("");
  // Pending destination-removal confirmation (in-app dialog).
  const [pendingRemoval, setPendingRemoval] = useState<{
    dest: Destination;
    dropped: string[];
    items: { libraryId: string; name: string }[];
    keptCities: CityForecast[];
    newTags: string[];
  } | null>(null);
  // Guards against stale results when several lookups overlap (e.g. adding two
  // cities quickly) — only the most recent request applies its outcome.
  const weatherReq = useRef(0);

  const days = tripDurationDays(trip);
  const hasDestinations = trip.destinations.length > 0;

  // Refetch the forecast once when the trip opens, so a cached forecast refreshes.
  // Offline (or no dates) keeps the cached card — runWeatherLookup stays silent.
  const openRefetched = useRef(false);
  useEffect(() => {
    if (openRefetched.current) return;
    openRefetched.current = true;
    if (trip.destinations.length > 0 && trip.startDate && trip.endDate) {
      void runWeatherLookup(
        trip.destinations.map((d) => ({
          label: d.label,
          lat: d.lat,
          lon: d.lon,
        })),
        { auto: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Look up the forecast for an explicit destination list + date window (the
   * caller passes the post-mutation values so it doesn't wait for a re-render).
   * Auto calls stay quiet when dates are missing — the manual button reports it.
   * Orchestration lives in engine/weatherSync (unit-tested); here we only drive
   * UI status and guard against stale overlapping lookups.
   */
  async function runWeatherLookup(
    destinations: WeatherDest[],
    opts: { auto?: boolean; startDate?: string; endDate?: string } = {},
  ) {
    const start = opts.startDate ?? trip.startDate;
    const end = opts.endDate ?? trip.endDate;
    const reqId = ++weatherReq.current;
    setWeatherStatus("loading");
    setWeatherMsg("");
    const outcome = await refreshWeather(destinations, start, end);
    if (reqId !== weatherReq.current) return; // superseded by a newer lookup

    switch (outcome.status) {
      case "empty":
        setWeatherStatus("idle");
        return;
      case "no-dates":
        if (opts.auto) {
          setWeatherStatus("idle");
        } else {
          setWeatherStatus("error");
          setWeatherMsg("Add trip dates to look up the forecast.");
        }
        return;
      case "no-match":
        setWeatherStatus("error");
        setWeatherMsg(
          "Couldn’t find weather for those places. Add weather tags manually.",
        );
        return;
      case "error":
        if (opts.auto) {
          // Silent fallback: keep whatever forecast/tags are cached.
          setWeatherStatus("idle");
        } else {
          setWeatherStatus("error");
          setWeatherMsg(
            "Forecast lookup failed (offline?). Add weather tags manually.",
          );
        }
        return;
      case "done":
        update((d) => applyWeather(d, outcome.result, uid));
        setWeatherStatus("done");
        setWeatherMsg(
          outcome.result.tags.length > 0
            ? `Weather tags: ${outcome.result.tags.join(", ")}`
            : "No strong weather signal",
        );
    }
  }

  function suggestWeather() {
    void runWeatherLookup(
      trip.destinations.map((d) => ({
        label: d.label,
        lat: d.lat,
        lon: d.lon,
      })),
    );
  }
  const activeKeys = new Set(trip.tags.map((t) => tagKey(t.label)));
  const quickTags = BUILTIN_TAGS.filter((b) => !activeKeys.has(b.key));
  const quickActivities = quickTags.filter((b) => b.type === "activity");
  const quickWeather = quickTags.filter((b) => b.type === "weather");

  function addTag(label: string, type: TagType) {
    const clean = label.trim();
    if (!clean || activeKeys.has(tagKey(clean))) return;
    update((d) => {
      d.tags.push({ id: uid(), label: clean, type });
    });
  }

  function addCustomTag() {
    addTag(tagLabel, "custom");
    setTagLabel("");
  }

  function addPlace(place: GeoResult) {
    const dest = {
      id: uid(),
      label: placeLabel(place),
      lat: place.lat,
      lon: place.lon,
      countryCode: place.countryCode,
      isPrimary: trip.destinations.length === 0,
    };
    update((d) => void d.destinations.push(dest));
    void runWeatherLookup([...trip.destinations, dest], { auto: true });
  }

  function addManualPlace(label: string) {
    const dest = {
      id: uid(),
      label,
      isPrimary: trip.destinations.length === 0,
    };
    update((d) => void d.destinations.push(dest));
    void runWeatherLookup([...trip.destinations, dest], { auto: true });
  }

  /**
   * Remove a destination. The forecast is kept honest *locally* (no network):
   * the remaining cities' cached tags are re-unioned, so any weather tag the
   * removed city alone justified disappears. If that orphans items (e.g. "cold"
   * → beanie, gloves), confirm via the in-app dialog whether to drop them too;
   * otherwise remove straight away.
   */
  function removeDestination(dest: Destination) {
    const remaining = trip.destinations.filter((x) => x.id !== dest.id);
    const currentWeatherTags = trip.tags
      .filter((t) => t.type === "weather")
      .map((t) => t.label);
    const { cities: keptCities, tags: newTags } = recomputeWeatherAfterRemoval(
      trip.weather?.cities ?? [],
      remaining,
    );
    const dropped = currentWeatherTags.filter((t) => !newTags.includes(t));
    const items = tripItemsWithAnyTag(trip.items, library, dropped);

    if (items.length === 0) {
      performRemoval(dest, newTags, keptCities, false);
      return;
    }
    setPendingRemoval({ dest, dropped, items, keptCities, newTags });
  }

  /** Apply a destination removal: drop the city, re-derive weather tags + forecast,
   *  reassign primary, and optionally remove the orphaned items. */
  function performRemoval(
    dest: Destination,
    newTags: string[],
    keptCities: CityForecast[],
    removeItems: boolean,
    items: { libraryId: string }[] = [],
  ) {
    const removeIds = new Set(items.map((i) => i.libraryId));
    update((d) => {
      d.destinations = d.destinations.filter((x) => x.id !== dest.id);
      if (!d.destinations.some((x) => x.isPrimary) && d.destinations[0]) {
        d.destinations[0].isPrimary = true;
      }
      d.tags = d.tags.filter(
        (t) => t.type !== "weather" || newTags.includes(t.label),
      );
      if (keptCities.length === 0) d.weather = undefined;
      else if (d.weather) d.weather = { ...d.weather, cities: keptCities };
      if (removeItems)
        d.items = d.items.filter((i) => !removeIds.has(i.libraryId));
    });
    setWeatherStatus("idle");
    setWeatherMsg("");
    setPendingRemoval(null);
  }

  const international = isInternationalTrip(trip);
  const power = powerSummary(tripCountryCodes(trip));
  const autoDetected =
    trip.settings.international === undefined && international;

  function setInternational(checked: boolean) {
    update((d) => void (d.settings.international = checked));
  }

  /** Add a travel adapter to the trip (resolve/create the library item, add once). */
  function addAdapter() {
    const row = rememberItem("Travel adapter", "Electronics", [
      "international",
    ]);
    update((d) => {
      if (!d.items.some((i) => i.libraryId === row.id)) {
        d.items.push({
          libraryId: row.id,
          quantitySuggested: null,
          quantityTaken: 1,
          packed: false,
        });
      }
    });
  }

  return (
    <aside className="card flex h-fit flex-col gap-6 p-5">
      <p className="label -mb-2">Trip details</p>

      {/* Name */}
      <div>
        <label className="label" htmlFor="trip-name">
          Trip name
        </label>
        <input
          id="trip-name"
          className="input mt-1.5"
          value={trip.name}
          onChange={(e) => update((d) => void (d.name = e.target.value))}
          placeholder="Portugal surf, Oct 2026"
        />
      </div>

      {/* Dates */}
      <div>
        <SectionLabel>Dates</SectionLabel>
        <DateRangeField
          start={trip.startDate}
          end={trip.endDate}
          onChange={(startDate, endDate) => {
            update((d) => {
              d.startDate = startDate;
              d.endDate = endDate;
            });
            // Dates just became (or changed to) a usable window — refresh the
            // forecast for any destinations already on the trip.
            if (startDate && endDate && trip.destinations.length > 0) {
              void runWeatherLookup(
                trip.destinations.map((dd) => ({
                  label: dd.label,
                  lat: dd.lat,
                  lon: dd.lon,
                })),
                { auto: true, startDate, endDate },
              );
            }
          }}
        />
        {days != null && (
          <p className="mt-1.5 font-mono text-xs text-ink-soft">
            {days} night{days === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* Destinations */}
      <div>
        <SectionLabel>Destinations</SectionLabel>
        <ul className="mt-1.5 space-y-1">
          {trip.destinations.map((dest) => (
            <li key={dest.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{dest.label}</span>
              <button
                className={`chip ${dest.isPrimary ? "bg-vermilion-soft text-vermilion-deep" : "bg-paper-sunk text-ink-faint hover:text-ink"}`}
                title="Set as primary destination"
                onClick={() =>
                  update((d) => {
                    d.destinations.forEach(
                      (x) => (x.isPrimary = x.id === dest.id),
                    );
                  })
                }
              >
                {dest.isPrimary ? "Primary" : "Set primary"}
              </button>
              <button
                className="btn-ghost px-1.5 py-0.5"
                aria-label={`Remove ${dest.label}`}
                onClick={() => removeDestination(dest)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <PlaceSearch onSelect={addPlace} onAddManual={addManualPlace} />
      </div>

      {/* Tags */}
      <div>
        <SectionLabel>Tags</SectionLabel>
        <p className="mt-1 text-xs text-ink-soft">
          Tags drive your suggestions. Tap one to add it.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {trip.tags.length === 0 && (
            <span className="font-mono text-xs text-ink-faint">
              No tags yet
            </span>
          )}
          {trip.tags.map((tag) => (
            <span key={tag.id} className={`chip ${TAG_TYPE_STYLES[tag.type]}`}>
              {tag.label}
              <button
                className="ml-0.5 opacity-60 hover:opacity-100"
                aria-label={`Remove tag ${tag.label}`}
                onClick={() =>
                  update(
                    (d) =>
                      void (d.tags = d.tags.filter((t) => t.id !== tag.id)),
                  )
                }
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        {/* Quick-add palettes — grouped so the choice reads as intentional. */}
        {quickActivities.length > 0 && (
          <TagPalette
            label="Activities"
            tags={quickActivities}
            onAdd={addTag}
          />
        )}
        {quickWeather.length > 0 && (
          <TagPalette label="Weather" tags={quickWeather} onAdd={addTag} />
        )}

        {/* Custom tag — single shrink-safe row. */}
        <div className="mt-3 flex gap-2">
          <input
            className="input min-w-0 flex-1"
            value={tagLabel}
            onChange={(e) => setTagLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
            placeholder="Add your own tag…"
          />
          <button className="btn-secondary shrink-0" onClick={addCustomTag}>
            Add
          </button>
        </div>
      </div>

      {/* Weather lookup (Open-Meteo, user-triggered) */}
      <div>
        <SectionLabel>Forecast</SectionLabel>
        <button
          className="btn-secondary mt-1.5 w-full"
          onClick={() => void suggestWeather()}
          disabled={!hasDestinations || weatherStatus === "loading"}
          title={!hasDestinations ? "Add a destination first" : undefined}
        >
          {weatherStatus === "loading"
            ? "Checking forecast…"
            : "☀ Refresh forecast"}
        </button>
        {hasDestinations && (
          <p className="mt-1.5 text-xs text-ink-faint">
            Looked up automatically when you add a place or set dates.
          </p>
        )}
        {weatherMsg && (
          <p
            className={`mt-1.5 text-xs ${
              weatherStatus === "error"
                ? "text-vermilion-deep"
                : "text-ink-soft"
            }`}
          >
            {weatherMsg}
          </p>
        )}
        {!hasDestinations && (
          <p className="mt-1.5 text-xs text-ink-faint">
            Add a destination to check its forecast.
          </p>
        )}
      </div>

      {/* Trip type — international + power/adapters */}
      <div className="border-t border-line pt-4">
        <SectionLabel>Trip type</SectionLabel>
        <label className="mt-1.5 flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-vermilion focus:ring-vermilion"
            checked={international}
            onChange={(e) => setInternational(e.target.checked)}
          />
          <span>
            International trip
            <span className="block text-xs text-ink-faint">
              {autoDetected
                ? "Detected — destinations span multiple countries."
                : "Tick if this trip crosses a border (adds plug & adapter info)."}
            </span>
          </span>
        </label>

        {international && (
          <div className="mt-3">
            {power.known.length === 0 && power.unknown.length === 0 ? (
              <p className="text-xs text-ink-faint">
                Add a destination with a country to see plug types and voltage.
              </p>
            ) : (
              <>
                <p className="label mb-1.5">Power &amp; plugs</p>
                <ul className="space-y-1 text-sm">
                  {power.known.map((k) => (
                    <li
                      key={k.code}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <span className="min-w-0 truncate">{k.info.name}</span>
                      <span className="shrink-0 font-mono text-xs text-ink-soft">
                        Type {k.info.types.join("/")} · {k.info.voltage}V
                      </span>
                    </li>
                  ))}
                  {power.unknown.map((code) => (
                    <li
                      key={code}
                      className="flex items-baseline justify-between gap-2 text-ink-faint"
                    >
                      <span>{code}</span>
                      <span className="shrink-0 font-mono text-xs">
                        no plug data
                      </span>
                    </li>
                  ))}
                </ul>
                {power.voltages.length > 0 && (
                  <p className="mt-1.5 text-xs text-ink-faint">
                    Mains {power.voltages.join(" / ")}V — check your devices’
                    range.
                  </p>
                )}
                <button
                  className="btn-secondary mt-2 w-full text-xs"
                  onClick={addAdapter}
                >
                  + Add travel adapter
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Laundry */}
      <label className="flex items-start gap-2.5 border-t border-line pt-4 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-vermilion focus:ring-vermilion"
          checked={trip.settings.laundryAvailable}
          onChange={(e) =>
            update((d) => void (d.settings.laundryAvailable = e.target.checked))
          }
        />
        <span>
          Laundry available
          <span className="block text-xs text-ink-faint">
            Reduces suggested quantities
          </span>
        </span>
      </label>

      {pendingRemoval && (
        <ConfirmDialog
          title={`Remove ${pendingRemoval.dest.label.split(",")[0]}?`}
          confirmLabel={`Remove location with ${pendingRemoval.items.length} item${pendingRemoval.items.length === 1 ? "" : "s"}`}
          secondary={{
            label: "Remove location but keep items",
            onClick: () =>
              performRemoval(
                pendingRemoval.dest,
                pendingRemoval.newTags,
                pendingRemoval.keptCities,
                false,
              ),
          }}
          cancelLabel="Cancel"
          tone="danger"
          onConfirm={() =>
            performRemoval(
              pendingRemoval.dest,
              pendingRemoval.newTags,
              pendingRemoval.keptCities,
              true,
              pendingRemoval.items,
            )
          }
          onCancel={() => setPendingRemoval(null)}
        >
          <p>
            That leaves no destination needing{" "}
            <strong>{pendingRemoval.dropped.join(", ")}</strong>. These items
            were added for it — remove them with the city?
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {pendingRemoval.items.map((i) => (
              <li
                key={i.libraryId}
                className="chip bg-paper-sunk text-ink-soft"
              >
                {i.name}
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
    </aside>
  );
}
