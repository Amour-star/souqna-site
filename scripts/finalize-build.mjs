#!/usr/bin/env node
/**
 * Post-build step. The built SPA entry (dist/index.html) is renamed to
 * dist/app-shell.html: with a real index.html in the output, Vercel would serve
 * "/" statically and bypass api/page.ts, so the homepage would reach crawlers as
 * an empty shell. api/page.ts fetches app-shell.html and fills it with the
 * page's real content for every route.
 */
import {access, rename} from 'node:fs/promises';

await access('dist/index.html').catch(() => {
  throw new Error('dist/index.html not found — run `vite build` first');
});
await rename('dist/index.html', 'dist/app-shell.html');
console.log('finalize-build: dist/index.html → dist/app-shell.html');
