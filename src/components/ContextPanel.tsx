import { useState } from 'react';
import type { Trip, TagType } from '../types';
import { tagKey, tripDurationDays } from '../types';
import { uid } from '../db/db';
import { BUILTIN_TAGS } from '../data/tags';
import { lookupWeatherTags, placeLabel, type GeoResult } from '../engine/weather';
import DateRangeField from './DateRangeField';
import PlaceSearch from './PlaceSearch';

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
}

const TAG_TYPE_STYLES: Record<TagType, string> = {
  activity: 'bg-stamp-soft text-stamp',
  weather: 'bg-airblue-soft text-airblue',
  destination: 'bg-vermilion-soft text-vermilion-deep',
  custom: 'bg-paper-sunk text-ink-soft',
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

export default function ContextPanel({ trip, update }: Props) {
  const [tagLabel, setTagLabel] = useState('');
  const [weatherStatus, setWeatherStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [weatherMsg, setWeatherMsg] = useState('');

  const days = tripDurationDays(trip);
  const primaryDest = trip.destinations.find((d) => d.isPrimary) ?? trip.destinations[0];

  async function suggestWeather() {
    if (!primaryDest) return;
    setWeatherStatus('loading');
    setWeatherMsg('');
    try {
      const res = await lookupWeatherTags(
        { label: primaryDest.label, lat: primaryDest.lat, lon: primaryDest.lon },
        trip.startDate,
        trip.endDate,
      );
      if (!res) {
        setWeatherStatus('error');
        setWeatherMsg(`Couldn't find “${primaryDest.label}”. Add weather tags manually.`);
        return;
      }
      const existing = new Set(trip.tags.map((t) => tagKey(t.label)));
      const toAdd = res.tags.filter((k) => !existing.has(k));
      update((d) => {
        for (const k of toAdd) d.tags.push({ id: uid(), label: k, type: 'weather' });
        d.weather = {
          place: res.place.name,
          fetchedAt: Date.now(),
          datedWindow: res.datedWindow,
          ...res.summary,
        };
      });
      const note = res.datedWindow ? '' : ' (7-day forecast — set trip dates for accuracy)';
      setWeatherStatus('done');
      setWeatherMsg(
        toAdd.length > 0
          ? `Added ${toAdd.join(', ')}${note}`
          : res.tags.length > 0
            ? `Already covered${note}`
            : `No strong weather signal${note}`,
      );
    } catch {
      setWeatherStatus('error');
      setWeatherMsg('Forecast lookup failed (offline?). Add weather tags manually.');
    }
  }
  const activeKeys = new Set(trip.tags.map((t) => tagKey(t.label)));
  const quickTags = BUILTIN_TAGS.filter((b) => !activeKeys.has(b.key));
  const quickActivities = quickTags.filter((b) => b.type === 'activity');
  const quickWeather = quickTags.filter((b) => b.type === 'weather');

  function addTag(label: string, type: TagType) {
    const clean = label.trim();
    if (!clean || activeKeys.has(tagKey(clean))) return;
    update((d) => {
      d.tags.push({ id: uid(), label: clean, type });
    });
  }

  function addCustomTag() {
    addTag(tagLabel, 'custom');
    setTagLabel('');
  }

  function addPlace(place: GeoResult) {
    update((d) => {
      d.destinations.push({
        id: uid(),
        label: placeLabel(place),
        lat: place.lat,
        lon: place.lon,
        countryCode: place.countryCode,
        isPrimary: d.destinations.length === 0,
      });
    });
  }

  function addManualPlace(label: string) {
    update((d) => {
      d.destinations.push({ id: uid(), label, isPrimary: d.destinations.length === 0 });
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
          onChange={(startDate, endDate) =>
            update((d) => {
              d.startDate = startDate;
              d.endDate = endDate;
            })
          }
        />
        {days != null && (
          <p className="mt-1.5 font-mono text-xs text-ink-soft">
            {days} night{days === 1 ? '' : 's'}
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
                className={`chip ${dest.isPrimary ? 'bg-vermilion-soft text-vermilion-deep' : 'bg-paper-sunk text-ink-faint hover:text-ink'}`}
                title="Set as primary destination"
                onClick={() =>
                  update((d) => {
                    d.destinations.forEach((x) => (x.isPrimary = x.id === dest.id));
                  })
                }
              >
                {dest.isPrimary ? 'Primary' : 'Set primary'}
              </button>
              <button
                className="btn-ghost px-1.5 py-0.5"
                aria-label={`Remove ${dest.label}`}
                onClick={() =>
                  update((d) => {
                    d.destinations = d.destinations.filter((x) => x.id !== dest.id);
                    if (!d.destinations.some((x) => x.isPrimary) && d.destinations[0]) {
                      d.destinations[0].isPrimary = true;
                    }
                  })
                }
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
            <span className="font-mono text-xs text-ink-faint">No tags yet</span>
          )}
          {trip.tags.map((tag) => (
            <span key={tag.id} className={`chip ${TAG_TYPE_STYLES[tag.type]}`}>
              {tag.label}
              <button
                className="ml-0.5 opacity-60 hover:opacity-100"
                aria-label={`Remove tag ${tag.label}`}
                onClick={() =>
                  update((d) => {
                    d.tags = d.tags.filter((t) => t.id !== tag.id);
                    d.items.forEach((it) => {
                      it.tagIds = it.tagIds.filter((id) => id !== tag.id);
                    });
                  })
                }
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        {/* Quick-add palettes — grouped so the choice reads as intentional. */}
        {quickActivities.length > 0 && (
          <TagPalette label="Activities" tags={quickActivities} onAdd={addTag} />
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
            onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
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
          disabled={!primaryDest || weatherStatus === 'loading'}
          title={!primaryDest ? 'Add a destination first' : undefined}
        >
          {weatherStatus === 'loading' ? 'Checking forecast…' : '☀ Suggest weather tags'}
        </button>
        {weatherMsg && (
          <p
            className={`mt-1.5 text-xs ${
              weatherStatus === 'error' ? 'text-vermilion-deep' : 'text-ink-soft'
            }`}
          >
            {weatherMsg}
          </p>
        )}
        {!primaryDest && (
          <p className="mt-1.5 text-xs text-ink-faint">
            Add a destination to check its forecast.
          </p>
        )}
      </div>

      {/* Laundry */}
      <label className="flex items-start gap-2.5 border-t border-line pt-4 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-vermilion focus:ring-vermilion"
          checked={trip.settings.laundryAvailable}
          onChange={(e) => update((d) => void (d.settings.laundryAvailable = e.target.checked))}
        />
        <span>
          Laundry available
          <span className="block text-xs text-ink-faint">Reduces suggested quantities</span>
        </span>
      </label>
    </aside>
  );
}
