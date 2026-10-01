# Vercel routing (BUG-02)

`vercel.json` adds one SPA fallback rewrite: every path that is not a real file and not under `/assets/` and has no file extension
is served `index.html`, so `/listing/<slug>-<uuid>`, `/category/<uuid>`, `/sell`, `/search?q=…` work on refresh, bookmarks and shared links.
Vercel serves real files first (`public/` → `dist/`), so `/safety.html`, `/sitemap.xml`, `/robots.txt`, `/assets/*` are untouched;
a missing `/assets/x.js` stays a real 404 (never HTML). Unknown app paths render the in-app `NotFoundPage` (HTTP 200 from the shell).

## Link previews / SEO (not solved by the rewrite)
`useSeo` sets `<title>` and meta tags in the browser, and `scripts/prerender.mjs` writes real HTML for listings/categories at build time,
but the mapping from `/listing/<slug>-<uuid>` to `dist/listing/<uuid>.html` lives in `public/.htaccess` (Apache) – **Vercel ignores `.htaccess`**.
So WhatsApp/Telegram/Google's first pass currently see the neutral shell on Vercel. Options:
1. Routing Middleware that fetches `/listing/<uuid>.html` and falls back to the shell (needs a Vercel preview deployment to verify).
2. Generate per-listing `rewrites` entries at build time from the prerendered files (works because every entry has a file).
3. Move to SSR/ISR for `/listing/*`.

Verify after deploy: `curl -sI https://www.souqna.net/sell` → 200 and `curl -s https://www.souqna.net/listing/x-<uuid> | grep -i '<title>'`.
