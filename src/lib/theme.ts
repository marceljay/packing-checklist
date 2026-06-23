/**
 * Light / dark / system theme. The resolved theme is applied as a `.dark` class
 * on <html> (Tailwind `darkMode: 'class'`); the palette itself lives in CSS
 * variables (`index.css`). Preference persists in localStorage; in `system`
 * mode we follow the OS and react to it changing live.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'packing-checklist-theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemeMode(): ThemeMode {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (media().matches ? 'dark' : 'light') : mode;
}

function apply(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', resolveTheme(mode) === 'dark');
}

export function setThemeMode(mode: ThemeMode): void {
  localStorage.setItem(KEY, mode);
  apply(mode);
}

/** Apply the stored preference and keep `system` mode in sync with the OS. */
export function initTheme(): void {
  apply(getThemeMode());
  media().addEventListener('change', () => {
    if (getThemeMode() === 'system') apply('system');
  });
}
