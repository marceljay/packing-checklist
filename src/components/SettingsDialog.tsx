import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWeightThresholds, setWeightThresholds, DEFAULT_THRESHOLDS } from '../lib/weightSettings';

/**
 * App settings modal (Manifest style). For now: the editable weight-scale
 * thresholds (kg) that drive the trip load gauge. Escape or a backdrop click
 * closes; changes save explicitly.
 */
export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const current = useWeightThresholds();
  const [light, setLight] = useState(String(current.lightMaxKg));
  const [medium, setMedium] = useState(String(current.mediumMaxKg));
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function save() {
    const l = parseFloat(light);
    const m = parseFloat(medium);
    setWeightThresholds({
      lightMaxKg: Number.isFinite(l) ? l : current.lightMaxKg,
      mediumMaxKg: Number.isFinite(m) ? m : current.mediumMaxKg,
    });
    onClose();
  }

  function reset() {
    setLight(String(DEFAULT_THRESHOLDS.lightMaxKg));
    setMedium(String(DEFAULT_THRESHOLDS.mediumMaxKg));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Settings" className="card w-full max-w-sm overflow-hidden">
        <div aria-hidden className="airmail h-1 w-full" />
        <div className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-lg font-bold leading-tight">Settings</h2>

          <div>
            <p className="label mb-1.5">Weight scale (kg)</p>
            <p className="mb-3 text-xs text-ink-faint">
              Thresholds for the trip load gauge. Up to the first is “Light” (backpack); up to the
              second is “Medium” (wheeled suitcase); above is “Heavy”.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-soft">Light up to</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  inputMode="decimal"
                  className="input"
                  value={light}
                  onChange={(e) => setLight(e.target.value)}
                  aria-label="Light band maximum (kg)"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-soft">Medium up to</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  inputMode="decimal"
                  className="input"
                  value={medium}
                  onChange={(e) => setMedium(e.target.value)}
                  aria-label="Medium band maximum (kg)"
                />
              </label>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 border-t border-line pt-3">
            <button className="btn-ghost text-sm" onClick={reset}>
              Reset
            </button>
            <div className="flex gap-2">
              <button className="btn-ghost text-sm" onClick={onClose}>
                Cancel
              </button>
              <button ref={closeRef} className="btn-primary text-sm" onClick={save}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
