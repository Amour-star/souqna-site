# Souqna Web

The Souqna marketplace as a web application — the second client of the same
Souqna platform the mobile app runs on.

Web and mobile share one backend, one identity system, one database and one set
of business rules. An account created in the app signs in here, favourites and
conversations follow the user between the two, and a listing posted from a
browser appears in the app.

## Language

Souqna is Arabic-first. A visitor who has never chosen a language gets **Arabic
with RTL layout**, matching the mobile app, which hardcodes `lng: 'ar'`. The
browser/OS locale is deliberately ignored — following it would push Arabic
speakers abroad into English. A language the user picks is stored in
`localStorage` and always wins.

There is no per-account language column in the backend, so `localStorage` is the
only preference store; the mobile app keeps its own under AsyncStorage.

Layout is direction-agnostic: the stylesheets use logical properties
(`inset-inline-start`, `margin-inline`, `text-align: start`) throughout, so
switching language flips the interface without a second set of rules.

## Architecture

| Concern | Where it lives |
| --- | --- |
| API | `https://backend.souqna.net/api` (Laravel, JWT) — shared with mobile |
| Auth | Same JWT issued by `POST /auth/login`, refreshed via `/auth/refresh` |
| Catalog, listings, favourites, notifications | Laravel API |
| Messaging | Firebase Firestore, `conversations/{chatId}` — shared with mobile |
| Conversation ids | Minted by the backend (`POST /chat/start`), which is what keeps both clients on the same thread |
| Translations | The mobile app's own `ar.json` / `en.json`, extended with web-only keys |

This app has **no backend of its own** and no second user store.

## Stack

Vite · React 18 · TypeScript (strict) · React Router · TanStack Query ·
i18next · Firebase JS SDK. No CSS framework — the design system lives in
`src/styles/tokens.css` and `src/components/ui/ui.css`.

## Commands

```bash
npm install
npm run dev        # dev server on :5173, talks to the live backend
npm run build      # typecheck + production build into dist/
npm run typecheck
npm run lint
npm run test
npm run sitemap    # regenerate public/sitemap.xml from live data
npm run places     # regenerate src/data/syria-places.json from OpenStreetMap
npm run prerender  # (also part of `build`) write crawlable HTML for home, categories, listings
```

## Deployment (Hostinger)

The build is a set of static files, which matches how souqna.net is hosted
today.

1. `npm run sitemap` (optional but recommended — it picks up new listings)
2. `npm run build` — typechecks, bundles, then prerenders (see *SEO* below). The
   prerender step needs the live API; if it is unreachable it logs a warning and
   the plain SPA build is still produced.
3. Upload the **contents** of `dist/` to `public_html/`, including the
   `.htaccess` file, which provides the SPA fallback, HTTPS redirect and cache
   headers.

Deep links such as `/listing/<slug>` only survive a refresh if `.htaccess` is
uploaded. The Google Play compliance pages (`privacy.html`, `terms.html`,
`support.html`, `data-deletion.html`, `delete-account.html`) are real files and
keep their existing URLs.

### Environment variables (all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `https://backend.souqna.net/api` | Point the app at another backend |
| `VITE_SITE_URL` | `https://www.souqna.net` | Canonical URLs, share links, sitemap |
| `VITE_FEATURE_LISTING_STATUS` | `false` | Enable pause / mark-as-sold — needs the backend change in `backend-patch/` |
| `VITE_FEATURE_REPORTS_API` | `false` | Submit listing reports to the API instead of the user's email client |
| `VITE_FEATURE_FIREBASE_AUTH` | `false` | Sign in to Firebase so Firestore rules can identify the user |
| `VITE_FEATURE_DOUSHESH_IMPORT` | `false` | Enable importing ads from Doushesh (`/import`). Off: the route redirects to `/sell` and all links are hidden |

## Routes

```
/                        home
/search                  search + filters (state lives in the URL)
/category/:id[/:subId]   category landing (crawlable)
/listing/:slug           listing detail — slug ends with the listing id
/seller/:id              public seller profile
/sell, /sell/:id         create / edit listing        (auth)
/favorites               saved listings               (auth)
/messages[/:id]          conversations                (auth)
/notifications           notifications                (auth)
/profile                 account hub                  (auth)
/profile/listings        seller dashboard             (auth)
/profile/settings        account settings             (auth)
/profile/verification    seller identity verification (auth, sellers)
/login /register /verify /forgot-password /reset-password /logout
```

Route guards are a UX affordance only — the API authorises every protected
action server-side.

## Locations

**The backend has no location data.** Every `/locations`, `/cities`,
`/governorates` route 404s; a listing stores a free-text `location` string plus
optional `lat`/`long`, and the mobile app resolves places live against
OpenStreetMap Nominatim. The web keeps that contract and builds structure on top:

- `src/data/syria-places.json` — governorates, cities/towns, and Damascus/Aleppo
  districts **generated from OpenStreetMap** by `scripts/build-places.mjs` (not
  typed by hand). Gives instant Arabic prefix autocomplete ("حل" → حلب), which
  Nominatim cannot do because it only matches whole words.
- For anything the index lacks — villages, streets — the user can choose the
  "search the map" row, which queries OpenStreetMap Nominatim (restricted to
  Syria, the same source the app uses). It is deliberately **not** run as you
  type: Nominatim's public usage policy forbids client-side autocomplete.
- The picker writes `governorate – area – landmark` (the format existing listings
  already use) plus lat/long, so listings stay interchangeable with the app.
  Existing free-text values are parsed on edit and never lost.

The 14 governorate names come from OSM too. If the backend ever gains a locations
API, replace `src/lib/places/places.ts`; the components only depend on it.

## SEO

The app is client-rendered on static hosting. `scripts/prerender.mjs` (run by
`npm run build`) writes a real HTML file for `/`, every category, every
subcategory that holds listings, and the newest listings (`PRERENDER_LISTINGS`,
default 300), each with title, description, canonical, Open Graph, JSON-LD
(`WebSite`, `Organization`, `BreadcrumbList`, `ItemList`, `Product`+`Offer`) and
a semantic body with real links. It is not SSR: React replaces the static body
when it boots.

Files are flat and named by ASCII id (`home.html`, `category/<id>.html`,
`category/<cat>__<sub>.html`, `listing/<id>.html`), and `public/.htaccess`
rewrites the public URLs onto them — each rule fires only if its file exists, so
anything not prerendered falls through to the SPA. Flat files (not
`<slug>/index.html`) matter: Apache 301-redirects a directory URL to add a
trailing slash, which would contradict the canonical. `index.html` stays the
neutral SPA fallback for `/login`, `/profile` and so on, so `/` is served from
`home.html` through `DirectoryIndex`. Any slug works for a listing URL — only the
trailing id is used. Prerendered listings are a snapshot: rebuild to refresh
them; the SPA always shows live data.

## Notes

- **Server-side filtering is limited by the live API.** It honours keyword,
  category, subcategory, location (substring), radius and date range. It ignores
  price range, condition, currency and sort order. When one of those (or a
  category attribute) is used, the web fetches up to 500 matching records,
  refines and sorts them itself, and paginates locally so totals stay correct.
  Beyond 500 matches the result is flagged `truncated`. The optional patch in
  `backend-patch/` moves this server-side.
- Category attributes are stored as `{name, value}` with the **English** option as
  the value (`fieldOptions.ts` mirrors the app's parsing). No category has any
  attribute configured in the admin panel today, so no attribute UI appears yet.

- **`backend-patch/security/FIRESTORE_SECURITY.md` documents a critical,
  pre-existing security finding: chat conversations and message bodies are
  readable by anyone, with no credentials.** It affects the mobile app equally
  and needs a coordinated backend + client rollout. Read it before touching the
  Firestore rules.
- `backend-patch/` holds optional, backwards-compatible backend additions
  (listing status, reports, server-side filtering and sorting). The web app
  works without them; each is behind a build flag so no dead button ships.
- Pagination is sent through the `pageNo` / `recordsPerPage` **request headers**
  — an unusual contract, but the one both clients share.
- Category taxonomy, category-specific attributes and locations all come from
  the backend. Nothing about the catalog is hardcoded here.
- Prices render as `<symbol> <amount>` with Latin digits (`$ 1,250`, `£ 200,000`,
  `₺ 150`), matching the mobile app's `getCurrencySymbol`. SYP uses £ because
  that is what the platform already shows. Supported currencies are USD, SYP and
  TRY — the same three the mobile price input offers.
- Arabic needs six plural forms where English needs two. Any new pluralized key
  must supply `_zero`, `_one`, `_two`, `_few`, `_many` and `_other` in Arabic, or
  it renders as a raw key; `src/__tests__/plurals.test.ts` enforces this.
