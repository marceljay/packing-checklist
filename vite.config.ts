import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset paths so the build works copied into any web root or subfolder
  // (httpdocs/, httpdocs/packing/, GitHub Pages project path, …). Safe with the
  // hash router, which keeps all routing after the URL '#'.
  base: './',
  plugins: [react()],
});
