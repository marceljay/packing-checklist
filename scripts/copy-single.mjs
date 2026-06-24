// Copies the self-contained single-file build into the normal hosting build so
// the deployed app can offer it as a "download for offline use" file.
// Run after both `vite build` (dist/) and `vite build --mode single` (dist-single/).
import { copyFileSync, existsSync } from 'node:fs';

const src = 'dist-single/index.html';
const dest = 'dist/packing-checklist.html';

if (!existsSync(src)) {
  console.error(`copy-single: ${src} not found — run the single-file build first.`);
  process.exit(1);
}

copyFileSync(src, dest);
console.log(`copy-single: ${src} → ${dest}`);
