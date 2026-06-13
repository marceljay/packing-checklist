import { useState } from 'react';
import type { Trip, TagType } from '../types';
import { tripDurationDays } from '../types';
import { uid } from '../db/db';

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
}

const TAG_TYPE_STYLES: Record<TagType, string> = {
  activity: 'bg-emerald-100 text-emerald-800',
  weather: 'bg-sky-100 text-sky-800',
  destination: 'bg-amber-100 text-amber-800',
  custom: 'bg-slate-200 text-slate-700',
};

export default function ContextPanel({ trip, update }: Props) {
  const [tagLabel, setTagLabel] = useState('');
  const [tagType, setTagType] = useState<TagType>('activity');
  const [destLabel, setDestLabel] = useState('');
  const [bagName, setBagName] = useState('');

  const days = tripDurationDays(trip);

  function addTag() {
    const label = tagLabel.trim();
    if (!label) return;
    update((d) => {
      d.tags.push({ id: uid(), label, type: tagType });
    });
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

  function addBag() {
    const name = bagName.trim();
    if (!name) return;
    update((d) => {
      d.bags.push({ id: uid(), name, type: 'custom' });
    });
    setBagName('');
  }

  return (
    <aside className="card flex flex-col gap-5 p-4">
      {/* Name */}
      <div>
        <label className="label" htmlFor="trip-name">
          Trip name
        </label>
        <input
          id="trip-name"
          className="input mt-1"
          value={trip.name}
          onChange={(e) => update((d) => void (d.name = e.target.value))}
          placeholder="e.g. Portugal surf, Oct 2026"
        />
      </div>

      {/* Dates */}
      <div>
        <span className="label">Dates</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="date"
            aria-label="Start date"
            className="input"
            value={trip.startDate ?? ''}
            onChange={(e) => update((d) => void (d.startDate = e.target.value || undefined))}
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            aria-label="End date"
            className="input"
            value={trip.endDate ?? ''}
            onChange={(e) => update((d) => void (d.endDate = e.target.value || undefined))}
          />
        </div>
        {days != null && (
          <p className="mt-1 text-xs text-slate-500">
            {days} day{days === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {/* Destinations */}
      <div>
        <span className="label">Destinations</span>
        <ul className="mt-1 space-y-1">
          {trip.destinations.map((dest) => (
            <li key={dest.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{dest.label}</span>
              <button
                className={`chip ${dest.isPrimary ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}
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
        <span className="label">Tags</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {trip.tags.length === 0 && (
            <span className="text-xs text-slate-400">No tags yet</span>
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
        <div className="mt-2 flex gap-2">
          <select
            className="input w-auto"
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
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add a tag…"
          />
          <button className="btn-secondary" onClick={addTag}>
            Add
          </button>
        </div>
      </div>

      {/* Bags */}
      <div>
        <span className="label">Bags</span>
        <ul className="mt-1 space-y-1">
          {trip.bags.map((bag) => (
            <li key={bag.id} className="flex items-center gap-2 text-sm">
              <input
                className="input py-1"
                value={bag.name}
                aria-label={`Bag name`}
                onChange={(e) =>
                  update((d) => {
                    const b = d.bags.find((x) => x.id === bag.id);
                    if (b) b.name = e.target.value;
                  })
                }
              />
              <button
                className="btn-ghost px-1.5 py-0.5"
                aria-label={`Remove ${bag.name}`}
                onClick={() =>
                  update((d) => {
                    d.bags = d.bags.filter((x) => x.id !== bag.id);
                    d.items.forEach((it) => {
                      if (it.bagId === bag.id) it.bagId = undefined;
                    });
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
            value={bagName}
            onChange={(e) => setBagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addBag()}
            placeholder="Add a bag…"
          />
          <button className="btn-secondary" onClick={addBag}>
            Add
          </button>
        </div>
      </div>

      {/* Laundry */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          checked={trip.settings.laundryAvailable}
          onChange={(e) =>
            update((d) => void (d.settings.laundryAvailable = e.target.checked))
          }
        />
        Laundry available (reduces suggested quantities)
      </label>
    </aside>
  );
}
