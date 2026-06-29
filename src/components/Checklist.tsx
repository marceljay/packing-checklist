import { useMemo, useState } from "react";
import type { ResolvedItem, Trip, LibraryItem } from "../types";
import { orderedCategories, resolveItems, resolvedByCategory, resolvedByTag, ESSENTIAL_GROUP_KEY } from "../types";
import ItemRow from "./ItemRow";
import type { ItemRowMode } from "./ItemRow";

interface Props {
  trip: Trip;
  update: (mutator: (draft: Trip) => void) => void;
  /** Library rows by id, for joining each trip reference to its display fields. */
  library: Map<string, LibraryItem>;
  /** plan = editable list; checklist = check-off view with progress bar. */
  mode?: ItemRowMode;
}

type GroupBy = "category" | "tag";

interface Group {
  key: string;
  label: string;
  items: ResolvedItem[];
}

export default function Checklist({
  trip,
  update,
  library,
  mode = "plan",
}: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Built-ins plus any custom categories in the library, for the edit dropdowns.
  const categoryOptions = useMemo(
    () => orderedCategories([...library.values()].map((i) => i.category)),
    [library],
  );

  function toggleGroup(key: string) {
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const resolved = useMemo(
    () => resolveItems(trip.items, library),
    [trip.items, library],
  );

  const groups = useMemo<Group[]>(() => {
    if (groupBy === "category") {
      return resolvedByCategory(resolved).map((g) => ({
        key: g.category,
        label: g.category,
        items: g.items,
      }));
    }
    return resolvedByTag(resolved).map((g) => ({
      key: g.tag || "__untagged",
      label: g.tag === ESSENTIAL_GROUP_KEY ? "Essential" : g.tag || "Untagged",
      items: g.items,
    }));
  }, [resolved, groupBy]);

  const total = trip.items.length;
  const packedCount = trip.items.filter((i) => i.packed).length;
  const pct = total > 0 ? Math.round((packedCount / total) * 100) : 0;

  return (
    <section className="card flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line p-4">
        <h2 className="font-display text-base font-bold">Packing list</h2>
        {total > 0 && (
          <span className="font-mono text-xs tabular-nums text-ink-faint">
            {packedCount}/{total} packed
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="label mr-1">Group by</span>
          {(["category", "tag"] as GroupBy[]).map((g) => (
            <button
              key={g}
              className={`rounded px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-wide transition-colors ${
                groupBy === g
                  ? "bg-ink text-paper-raised"
                  : "text-ink-faint hover:bg-paper-sunk hover:text-ink"
              }`}
              onClick={() => setGroupBy(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Checklist mode: prominent progress bar */}
      {mode === "checklist" && total > 0 && (
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-paper-sunk">
            <div
              className="h-full rounded-full bg-vermilion transition-[width]"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={packedCount}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="Packing progress"
            />
          </div>
          <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
            {packedCount}/{total}
          </span>
          <span className="shrink-0 font-mono text-xs tabular-nums text-ink-faint">
            {pct}%
          </span>
        </div>
      )}

      {/* Groups */}
      {total === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-ink-soft">Your packing list is empty.</p>
          {mode === "plan" && (
            <p className="mt-1 font-mono text-xs text-ink-faint">
              Add items above or pull from suggestions.
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-line">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            const groupPacked = group.items.filter((i) => i.packed).length;
            const groupTotal = group.items.length;
            const groupPct =
              groupTotal > 0 ? Math.round((groupPacked / groupTotal) * 100) : 0;
            return (
              <div key={group.key}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center gap-2 bg-paper-sunk px-4 py-1.5 text-left transition-colors hover:bg-line/60"
                  >
                    <span
                      aria-hidden
                      className="font-mono text-[0.625rem] text-ink-faint"
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-code text-ink-soft">
                      {group.label}
                    </span>
                    {mode === "checklist" && (
                      <span className="ml-auto flex items-center gap-2">
                        <span className="h-1 w-12 overflow-hidden rounded-full bg-paper">
                          <span
                            className="block h-full rounded-full bg-vermilion transition-[width]"
                            style={{ width: `${groupPct}%` }}
                          />
                        </span>
                        <span className="font-mono text-[0.625rem] tabular-nums text-ink-faint">
                          {groupPacked}/{groupTotal}
                        </span>
                      </span>
                    )}
                  </button>
                </h3>
                {!isCollapsed && (
                  <div className="divide-y divide-line/60">
                    {group.items.map((item) => (
                      <ItemRow
                        key={item.libraryId}
                        item={item}
                        update={update}
                        showCategory={groupBy !== "category"}
                        categories={categoryOptions}
                        mode={mode}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
