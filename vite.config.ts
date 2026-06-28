import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkgVersion = JSON.parse(readFileSync('./package.json', 'utf8')).version as string;

/** Latest commit "shorthash · YYYY-MM-DD · subject", captured at build time;
 *  falls back gracefully when git isn't available. */
function gitCommit(): string {
  try {
    return execSync("git log -1 --date=short --format='%h · %cd · %s'").toString().trim();
  } catch {
    return 'unknown';
  }
}

// `vite build --mode single` (npm run build:single) emits ONE self-contained
// index.html (JS + CSS + fonts all inlined, non-module script) that runs by
// double-clicking from file:// — not just from an http server. The normal build
// stays code-split for hosting.
export default defineConfig(({ mode }) => {
  const singleFile = mode === 'single';
  return {
    // Relative asset paths so the build works copied into any web root or subfolder
    // (httpdocs/, httpdocs/packing/, GitHub Pages project path, …). Safe with the
    // hash router, which keeps all routing after the URL '#'.
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkgVersion),
      __GIT_COMMIT__: JSON.stringify(gitCommit()),
    },
    plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
    build: singleFile
      ? {
          outDir: 'dist-single',
          // Inline everything, including the self-hosted fonts (woff/woff2), as data
          // URIs so nothing is fetched — required for file:// to work fully offline.
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
        }
      : {},
  };
});
