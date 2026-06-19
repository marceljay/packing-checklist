import { useState } from 'react';
import type { Trip, TagType } from '../types';
import { tagKey, tripDurationDays } from '../types';
import { uid } from '../db/db';
import { BUILTIN_TAGS } from '../data/tags';

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

export default function ContextPanel({ trip, update }: Props) {
  const [tagLabel, setTagLabel] = useState('');
  const [tagType, setTagType] = useState<TagType>('activity');
  const [destLabel, setDestLabel] = useState('');

  const days = tripDurationDays(trip);
  const activeKeys = new Set(trip.tags.map((t) => tagKey(t.label)));
  const quickTags = BUILTIN_TAGS.filter((b) => !activeKeys.has(b.key));

  function addTag(label: string, type: TagType) {
    const clean = label.trim();
    if (!clean || activeKeys.has(tagKey(clean))) return;
    update((d) => {
      d.tags.push({ id: uid(), label: clean, type });
    });
  }

  function addCustomTag() {
    addTag(tagLabel, tagType);
    setTagLabel('');
  }

  function addDestination() {
    const label = destLabel.trim();
    if (!label) return;
    update((d) => {
      d.destinations.push({
        id: uid(),
        label,
        isPrimary: d.destinations.length === 0,
      });
    });
    setDestLabel('');
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
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="date"
            aria-label="Start date"
            className="input font-mono"
            value={trip.startDate ?? ''}
            onChange={(e) => update((d) => void (d.startDate = e.target.value || undefined))}
          />
          <span className="text-ink-faint">→</span>
          <input
            type="date"
            aria-label="End date"
            className="input font-mono"
            value={trip.endDate ?? ''}
            onChange={(e) => update((d) => void (d.endDate = e.target.value || undefined))}
          />
        </div>
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
              <span className="flex-1 truncate">{dest.label}</span>
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
        <div className="mt-2 flex gap-2">
          <input
            className="input"
            value={destLabel}
            onChange={(e) => setDestLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDestination()}
            placeholder="Add a place…"
          />
          <button className="btn-secondary" onClick={addDestination}>
            Add
          </button>
        </div>
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
        {/* Quick-add built-in tags (these drive suggestions) */}
        {quickTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickTags.map((b) => (
              <button
                key={b.key}
                className="chip border border-dashed border-line bg-transparent text-ink-soft transition-colors hover:border-solid hover:border-ink/30 hover:bg-paper-sunk hover:text-ink"
                onClick={() => addTag(b.key, b.type)}
              >
                + {b.key}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <select
            className="input w-auto font-mono text-xs"
            aria-label="Tag type"
            value={tagType}
            onChange={(e) => setTagType(e.target.value as TagType)}
          >
            <option value="activity">activity</option>
            <option value="weather">weather</option>
            <option value="destination">destination</option>
            <option value="custom">custom</option>
          </select>
          <input
            className="input"
            value={tagLabel}
            onChange={(e) => setTagLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
            placeholder="Add a tag…"
          />
          <button className="btn-secondary" onClick={addCustomTag}>
            Add
          </button>
        </div>
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
