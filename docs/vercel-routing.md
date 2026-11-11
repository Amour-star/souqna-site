# Vercel routing

See **docs/seo.md** (architecture + indexing policy). In short: real files are served first; sitemaps and `llms.txt` are rewritten to
`api/sitemap.ts` / `api/ops.ts`; every other extension-less path — including `/` — is rewritten to `api/page.ts`, which returns the
page's real HTML with the correct status code (200/301/404/410/503). The build renames `index.html` to `app-shell.html` so `/` is
never served statically. `.htaccess`/Hostinger-era prerendering was removed because Vercel ignores it.

Verify after deploy: `curl -sI https://www.souqna.net/definitely-missing` → 404; `curl -s https://www.souqna.net/ | grep -c '<h1>'` → 1; `npm run seo:validate`.
