import { useState } from 'react';
import { getThemeMode, setThemeMode, type ThemeMode } from '../lib/theme';

const NEXT: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' };
const ICON: Record<ThemeMode, string> = { light: '☀', dark: '☾', system: '◐' };
const LABEL: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };

/** A single button that cycles Light → Dark → System; the icon shows the current
 *  mode. Preference persists and `System` follows the OS (see lib/theme). */
export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);

  function cycle() {
    const next = NEXT[mode];
    setThemeMode(next);
    setMode(next);
  }

  return (
    <button
      className="btn-ghost px-2 py-1.5"
      onClick={cycle}
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}.`}
      title={`Theme: ${LABEL[mode]} (tap for ${LABEL[NEXT[mode]]})`}
    >
      <span aria-hidden className="text-base leading-none">
        {ICON[mode]}
      </span>
    </button>
  );
}
