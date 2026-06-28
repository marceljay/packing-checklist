import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Trip,
  TagType,
  LibraryItem,
  Destination,
  CityForecast,
} from "../types";
import type { TagGroup } from "../types";
import {
  tagKey,
  tripDurationDays,
  isInternationalTrip,
  tripCountryCodes,
  tripItemsWithAnyTag,
  selectQuickAddTags,
} from "../types";
import { uid, useAppData } from "../db/store";
import { rememberItem } from "../db/library";
import { PLUGS, powerSummary, travelPowerAdvice } from "../data/plugs";
import { useHomeCountry, setHomeCountry } from "../lib/homeCountry";
import { placeLabel, shortPlace, type GeoResult } from "../engine/weather";
import {
  refreshWeather,
  applyWeather,
  recomputeWeatherAfterRemoval,
  type WeatherDest,
  type WeatherStatus,
} from "../engine/weatherSync";
import DateRangeField from "./DateRangeField";
import PlaceSearch from "./PlaceSearch";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
  /** Library rows by id, to resolve item tags when pruning after a destination removal. */
  library: Map<string, LibraryItem>;
  /** Forecast-lookup status, lifted to the editor so the WeatherCard can show a
   *  loading placeholder the moment a destination is added. */
  weatherStatus: WeatherStatus;
  setWeatherStatus: (s: WeatherStatus) => void;
  weatherMsg: string;
  setWeatherMsg: (m: string) => void;
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

/** A registry group maps to the trip Tag's type; 'other' has no own TagType. */
function tagTypeForGroup(group: TagGroup): TagType {
  return group === "other" ? "custom" : group;
}

const GROUP_LABELS: { group: TagGroup; label: string }[] = [
  { group: "activity", label: "Activities" },
  { group: "weather", label: "Weather" },
  { group: "other", label: "Other" },
];

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

export default function ContextPanel({
  trip,
  update,
  library,
  weatherStatus,
  setWeatherStatus,
  weatherMsg,
  setWeatherMsg,
}: Props) {
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
  // Whether the quick-add palette is showing the overflow (non-default) tags.
  const [showMore, setShowMore] = useState(false);

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
  const { tagMeta } = useAppData();
  const activeKeys = new Set(trip.tags.map((t) => tagKey(t.label)));
  // Quick-add palette is driven by the tag registry: defaults first, filled to a
  // floor of 20, with the remainder behind a "more" toggle. Grouped for display.
  const { visible, rest } = selectQuickAddTags(tagMeta, activeKeys);
  const shown = showMore ? [...visible, ...rest] : visible;
  const quickGroups = GROUP_LABELS.map(({ group, label }) => ({
    label,
    tags: shown
      .filter((m) => m.group === group)
      .map((m) => ({ key: m.key, type: tagTypeForGroup(m.group) }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  })).filter((g) => g.tags.length > 0);

  function addTag(label: string, type: TagType) {
    const clean = label.trim();
    if (!clean || activeKeys.has(tagKey(clean))) return;
    update((d) => {
      d.tags.push({ id: uid(), label: clean, type });
    });
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
  const homeCountry = useHomeCountry();
  const advice = travelPowerAdvice(homeCountry, tripCountryCodes(trip));
  const countryOptions = useMemo(
    () =>
      Object.entries(PLUGS)
        .map(([code, info]) => ({ code, name: info.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
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

      {/* Name is edited in the boarding-pass header (PassHeader). */}

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
              <span className="min-w-0 flex-1 truncate" title={dest.label}>
                {shortPlace(dest.label)}
              </span>
              <button
                className={`chip shrink-0 ${dest.isPrimary ? "bg-vermilion-soft text-vermilion-deep" : "bg-paper-sunk text-ink-faint hover:text-ink"}`}
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
                className="btn-ghost shrink-0 px-1.5 py-0.5"
                aria-label={`Remove ${dest.label}`}
                onClick={() => removeDestination(dest)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <PlaceSearch onSelect={addPlace} />
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
        {quickGroups.map((g) => (
          <TagPalette key={g.label} label={g.label} tags={g.tags} onAdd={addTag} />
        ))}
        {rest.length > 0 && (
          <button
            className="mt-3 font-mono text-[0.625rem] uppercase tracking-code text-ink-faint hover:text-ink-soft"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? "− Fewer tags" : `+ ${rest.length} more tag${rest.length === 1 ? "" : "s"}`}
          </button>
        )}
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

                {/* Home country → adapter / converter advice */}
                <div className="mt-3">
                  <label
                    htmlFor="home-country"
                    className="label mb-1.5 block"
                  >
                    Your home country
                  </label>
                  <select
                    id="home-country"
                    className="input w-full"
                    value={homeCountry}
                    onChange={(e) => setHomeCountry(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {countryOptions.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {advice.home && (advice.needsAdapter || advice.needsConverter) && (
                    <ul className="mt-2 space-y-1 text-xs text-vermilion-deep">
                      {advice.needsAdapter && (
                        <li>
                          Bring a plug adapter — destinations use type{" "}
                          {advice.adapterFor.join("/")}, which your{" "}
                          {advice.home.info.name} plugs don’t fit.
                        </li>
                      )}
                      {advice.needsConverter && (
                        <li>
                          Voltage differs ({advice.home.info.voltage}V at home vs{" "}
                          {advice.voltageMismatch.join("/")}V) — check your
                          devices are dual-voltage or bring a converter.
                        </li>
                      )}
                    </ul>
                  )}
                  {advice.home &&
                    !advice.needsAdapter &&
                    !advice.needsConverter &&
                    power.known.length > 0 && (
                      <p className="mt-2 text-xs text-ink-faint">
                        Your plugs and voltage work at every destination — no
                        adapter or converter needed.
                      </p>
                    )}
                </div>

                <button
                  className="btn-secondary mt-3 w-full text-xs"
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
          I’ll do laundry on this trip
          <span className="block text-xs text-ink-faint">
            Packs fewer clothes. Leave off to pack full quantities even if laundry
            is available.
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
