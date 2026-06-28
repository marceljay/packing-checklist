/// <reference types="vite/client" />

/** App version (from package.json), injected at build time by vite.config.ts. */
declare const __APP_VERSION__: string;
/** Latest commit ("hash · date · subject"), injected at build time. */
declare const __GIT_COMMIT__: string;
