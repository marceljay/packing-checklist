import { useState } from 'react';
import { getThemeMode, setThemeMode, type ThemeMode } from '../lib/theme';

const MODES: ThemeMode[] = ['light', 'system', 'dark'];
const LABEL: Record<ThemeMode, string> = { light: 'Light', system: 'System', dark: 'Dark' };

function Icon({ mode }: { mode: ThemeMode }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (mode === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
    );
  }
  if (mode === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  }
  // system — a monitor
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/** Sliding segmented theme control: Light · System · Dark. A thumb glides under
 *  the active segment; preference persists and System follows the OS (lib/theme). */
export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);
  const index = MODES.indexOf(mode);

  function select(next: ThemeMode) {
    setThemeMode(next);
    setMode(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="relative flex items-center rounded-full border border-line bg-paper-sunk p-0.5"
    >
      {/* Gliding thumb behind the active segment. */}
      <span
        aria-hidden
        className="absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-paper-raised shadow-tag transition-transform duration-200 ease-out"
        style={{ transform: `translateX(calc(${index} * 1.75rem))` }}
      />
      {MODES.map((m) => {
        const on = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={LABEL[m]}
            title={LABEL[m]}
            onClick={() => select(m)}
            className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              on ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
            }`}
          >
            <Icon mode={m} />
          </button>
        );
      })}
    </div>
  );
}
