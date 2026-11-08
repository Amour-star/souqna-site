# Souqna SEO, sitemap, indexing and GEO

Production host: **https://www.souqna.net** (Vercel; Vite + React SPA; data from the Laravel API at backend.souqna.net).
This repo has no database of its own, so every "database" rule below is applied to the API the mobile app also uses.

## 1. Audit (measured 2026-11-08 against production)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | **Sitemap was a stale static file** | `public/sitemap.xml`, 199 URLs, regenerated only by hand (`npm run sitemap`). 5,144 listings are eligible; ≈180 were listed. No `lastmod` on core pages; `/search` listed. No sitemap index. | Dynamic sitemaps (`api/sitemap.ts`), static file deleted. |
| 2 | `/sitemap-pages.xml`, `-categories`, `-cities`, `-listings-N`, `/sitemap_index.xml`, `/llms.txt` → 404 | curl | Implemented; `/sitemap_index.xml` 301 → `/sitemap.xml`. |
| 3 | **Home and category pages were empty shells** | raw HTML = SPA shell: generic title, no canonical, no H1, no content, no JSON-LD. `scripts/prerender.mjs` output was never served on Vercel (it relied on `.htaccess`, which Vercel ignores). | `api/page.ts` renders real HTML for `/`, `/category/*`, `/city/*`, `/listing/*`, `/guides/*`. |
| 4 | Listing HTML had title/OG/canonical but **no body, no JSON-LD, no H1, no breadcrumb** | 20/20 sampled listings | Full server-rendered body + Product/Offer + BreadcrumbList. |
| 5 | **Soft 404s**: unknown URLs and deleted listings returned 200 | `/nonexistent-xyz`, `/listing/foo-0000…` → 200 | 404 for unknown paths/deleted/paused, 410 for expired, 503 when the API is down. |
| 6 | Duplicate URL per listing (any slug worked) | `/listing/<uuid>` and stale slugs → 200 | 301 to the canonical slug (slug rule unchanged, so no indexed URL changes). |
| 7 | Expired listings still public (17 of 5,161) | `expDate` in the past | Excluded from sitemap, served 410. |
| 8 | Client JS rewrote title/canonical/robots after load (title differed between raw and rendered HTML) | `useSeo.ts` | Server owns the head on the first load (`data-ssr-path`); `useSeo` only takes over after client-side navigation. |
| 9 | `robots.txt`: `Disallow: /sell` also blocked `/seller/*` | prefix match | `/sell$` + `/sell/`. |
| 10 | Internal search `/search` was in the sitemap | | Removed; `noindex, follow`. |
| 11 | Titles/description generic; homepage copy differed from the brief | | Spec copy, per-page unique metadata. |
| 12 | **DNS: apex `souqna.net` resolves to two hosts** — 216.198.79.1 (Vercel, no certificate for the apex → TLS error) and 92.113.19.194 (Hostinger LiteSpeed, answers `301 → http://www.souqna.net`, an http downgrade) | `getent hosts`, curl | **Manual — see §8.** |
| 13 | Render-blocking Google Fonts stylesheet | `index.html` | Non-blocking load with `<noscript>` fallback. |
| 14 | 4 listings without images, 81 without city, 17 expired, 5,161 with no condition data | scan of the full feed | Monitoring (§6); no itemCondition is emitted when unknown. |

Not found: accidental `noindex` on public pages; `robots.txt` blocking CSS/JS/images; duplicate `<title>`s.

## 2. Architecture

```
Browser/crawler ─► Vercel
   /sitemap*.xml, /llms.txt, /<key>.txt ─► api/sitemap.ts, api/ops.ts
   any extension-less path incl. "/"    ─► api/page.ts ─► server/seo/pages.ts (route → status, metadata, body, JSON-LD)
                                                       └► app-shell.html (built SPA) + content injected into #root
   real files (assets, *.html, robots.txt, images) are served directly
```
* `npm run build` renames `dist/index.html` → `dist/app-shell.html` so `/` cannot be served as a static empty shell.
* Browsers still boot the SPA on top of the server HTML (React replaces `#root`). Guides are standalone (no SPA bundle).
* All policy lives in `server/seo/` as pure functions and is unit-tested with an in-memory fake of the API.

### Indexing policy
| State | Status | Robots | Sitemap |
|---|---|---|---|
| published (status 0/1), in date, has content | 200 | index | yes |
| sold (status 3) | 200 | noindex,follow, `SoldOut` | no |
| paused (2) / unknown / deleted | 404 | noindex | no |
| expired (`expDate` passed) | 410 | noindex | no |
| no name or no description/image ("thin") | 200 | noindex | no |
| category | 200 | index if ≥ 1 listing | yes |
| subcategory | 200 | index if ≥ 3 | yes |
| city `/city/<slug>` | 200 | index if ≥ 10 | yes |
| city × category `/city/<slug>/<categoryId>` | 200 | index if ≥ 10 | yes |
| `?page=N` | self-canonical, indexable | | no (reached by links) |
| filters / sort / search | canonical → base path; `/search` is noindex | | no |
| account, messages, sell, favorites, profile, auth routes | 200 shell | `X-Robots-Tag: noindex, nofollow` (+ robots.txt crawl saving) | no |

Thresholds are env-tunable: `SEO_MIN_CITY_LISTINGS`, `SEO_MIN_COMBO_LISTINGS`, `SEO_MIN_SUBCATEGORY_LISTINGS`, `SEO_LISTINGS_PER_SITEMAP` (default 5000, max 45000).

### Sitemaps
`/sitemap.xml` → `sitemap-pages.xml`, `sitemap-categories.xml`, `sitemap-cities.xml`, `sitemap-listings-<n>.xml`.
Listing files stream the newest-first feed 500 records at a time (never the whole table in memory). `lastmod` is the listing's real
`updated_at`; guide pages use the date the text was reviewed; legal pages have no `lastmod` (none we can vouch for).
Edge cache: `s-maxage=900, stale-while-revalidate=86400`. **Freshness model:** the web app cannot see database writes, so a new, edited
or deleted listing appears in sitemaps within ~15 min and on its page within ~5 min. For instant notification install the
optional backend hook in `backend-patch/SEO_PING.md`. Because the feed is newest-first, a record can shift between listing files
between two cache refreshes; Google tolerates this.

## 3. Structured data
Home: `Organization` (name, logo, support e-mail, app-store `sameAs`, no address) + `WebSite` with `SearchAction` (`/search?q=` is a working page).
Category/city: `BreadcrumbList` + `CollectionPage` with `ItemList`. Listing: `Product` + `Offer` (price/currency/availability, seller name that the page also shows)
+ `BreadcrumbList`. `Offer` is omitted when the price is missing or ≤ 1 (sellers use 0/1 as "call for price"). `itemCondition` only when the listing states it.
No ratings, reviews, addresses or invented availability. Guides: `Article` + `FAQPage` + `BreadcrumbList`.
Phone numbers inside descriptions are stripped from meta descriptions and JSON-LD.

## 4. GEO / AI search
`/llms.txt` (dynamic), allow-all `robots.txt` (no AI crawler is blocked), clear Arabic entity description, five hand-written Arabic guides
(`server/seo/guides.ts`) answering the target questions, FAQ markup, descriptive category/city pages. No bulk-generated content.

## 5. IndexNow (Bing, Yandex, Seznam, Naver — not Google)
* Key file: `/<INDEXNOW_KEY>.txt` (default key in `server/seo/config.ts`; the key is public by design; override with `INDEXNOW_KEY`, 32 hex chars).
* Daily Vercel cron `/api/ops?op=cron` submits listings created/updated in the last 26 h. Set `CRON_SECRET` in Vercel (cron sends it as a Bearer token).
* `POST /api/ops?op=ping` (header `x-seo-secret: $SEO_PING_SECRET`, body `{"urls":["/listing/…"]}`) for publish/update/delete/sold events from the backend.
Submitting never guarantees indexing.

## 6. Monitoring and validation
* `public/seo-admin.html` (noindex) + `GET /api/ops?op=health[&deep=1]` (Bearer `SEO_ADMIN_TOKEN`): listing totals by state, sitemap URL counts, missing
  titles/descriptions/images/city/category, duplicate titles/descriptions, age of the cached sitemap, and (deep) live HTML checks of a sample. Aggregates only, no personal data.
  **There is no admin panel in this repo** (the admin lives in the Laravel backend), so this is a standalone page.
* `npm run seo:validate` — robots, sitemap XML/limits/duplicates, raw-HTML checks of sampled URLs, status codes. `npm run seo:consistency` — every eligible API listing vs. the served sitemap.
  Both run daily in `.github/workflows/seo-validate.yml`; a red run is the alert. (The API has no change feed, so "last successful validation" is the last green run of that workflow.)
* `npm test` — 264 unit tests incl. sitemap pagination/eligibility consistency against a fake API.

## 7. Search Console / Bing procedure (owner access required)
1. Search Console → add property **URL prefix `https://www.souqna.net/`** (or a Domain property via the DNS TXT record) and verify.
2. Sitemaps → "Add a new sitemap" → `sitemap.xml` → Submit. Status should read *Success* with 5 discovered sitemaps (pages, categories, cities, listings-1, listings-2).
3. URL Inspection → test `https://www.souqna.net/`, one category, one city page and one listing → *Test live URL* → check "Crawl allowed", "Indexing allowed", user-declared canonical = Google-selected canonical → *Request indexing* for the home page only.
4. Enhancements → check Breadcrumbs / Products (merchant listings) after the first crawl. Test with Rich Results Test and validator.schema.org (I could not run those tools from this environment).
5. Pages → watch "Duplicate, Google chose different canonical", "Soft 404", "Crawled – currently not indexed". Indexing is Google's decision; expect weeks.
6. Bing Webmaster Tools → add site (import from Search Console) → Sitemaps → submit `https://www.souqna.net/sitemap.xml`; IndexNow is automatic once the key file is live.

## 8. Manual actions for the site owner
1. **DNS for the apex `souqna.net`:** delete the A record 92.113.19.194 (Hostinger), keep only Vercel's; add `souqna.net` to the Vercel project with a redirect to `www.souqna.net` (the `vercel.json` host redirect only works once the domain is attached). Until then half of apex requests hit Hostinger and downgrade to http.
2. Two Vercel projects build this repo (`souqna-site`, `souqna-site-app`). Confirm which one owns `www.souqna.net`; the other's builds can be disabled.
3. Set env vars on that project: `SEO_ADMIN_TOKEN`, `CRON_SECRET`, optional `SEO_PING_SECRET`, `INDEXNOW_KEY`.
4. Merge the branch to `main` to deploy, then run `npm run seo:validate && npm run seo:consistency`.
5. Search Console / Bing steps above.

## 9. Known limits / recommendations
* No change feed from the backend → freshness is TTL-based unless the ping hook is installed; deleted-vs-never-existed cannot be told apart (both 404).
* Images are served from backend.souqna.net as uploaded (no WebP/AVIF, no responsive sizes). Best fix is server-side resizing/WebP in Laravel or an image CDN; Vercel image optimization was deliberately not enabled (plan quotas could break images). Server HTML sets lazy-loading, reserved 4:3 boxes and a `preload` + `fetchpriority=high` for the main listing image.
* Core Web Vitals were not measured (no Lighthouse/CrUX access here). The SPA still replaces the server HTML on boot, which can cause a content swap; true hydration would remove it.
* Many ads are near-duplicates posted by the same sellers; the health report counts duplicate descriptions — consider backend moderation.
* Condition data is almost always empty (3 of 5,161) — asking sellers for it would enable richer `itemCondition`.
* Social preview falls back to the 512×512 logo; a 1200×630 brand image would be better (needs a designed asset).
* Previews of this branch are behind Vercel auth, so full-page checks were done by unit tests and by rendering real API data locally (see PR/branch notes), not on production.
