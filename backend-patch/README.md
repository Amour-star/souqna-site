# Optional backend additions

Changes to the shared Laravel API (`backend.souqna.net`). Everything here is
**additive** — new routes and optional parameters — so the shipped mobile app
keeps working untouched. The web app works without any of them; each one
unlocks something it currently hides or degrades.

Nothing in this folder has been deployed. None of it can be applied from the
development environment, which has no access to the production backend.

| # | Change | Web flag | Why it matters |
| --- | --- | --- | --- |
| 1 | [Firestore security](security/FIRESTORE_SECURITY.md) | `VITE_FEATURE_FIREBASE_AUTH` | **Critical.** Private messages are currently world-readable |
| 2 | Listing status (pause / mark sold) | `VITE_FEATURE_LISTING_STATUS` | Sellers cannot retire a listing without deleting it |
| 3 | Listing reports | `VITE_FEATURE_REPORTS_API` | Reporting has no server-side home |
| 4 | Price/condition filters and sorting | *(none — automatic)* | Filtering is refined in the browser instead of the database |

---

## 1. Firestore chat security — read this first

Private conversations and message bodies in the Firebase project are readable by
anyone on the internet, with no credentials. This is pre-existing and affects
the mobile app equally.

The finding, the evidence, the root cause, the fix and — importantly — the
**order** the pieces must ship in are all in
[`security/FIRESTORE_SECURITY.md`](security/FIRESTORE_SECURITY.md).

Deploying `security/firestore.rules` before both clients can authenticate will
break chat for every user. Read the rollout section before touching anything.

---

## 2. Seller-controlled listing status (pause / mark as sold)

`updateProduct` does not accept a `status` field, so no client can pause a
listing or mark it sold — only delete it. The web UI hides those actions rather
than offering buttons that would silently do nothing.

**Install**

1. Copy `ProductStatusController.php` to
   `app/Http/Controllers/Application/Product/ProductStatusController.php`.
2. Register the route in `routes/api.php`, inside the existing
   `Route::middleware(['jwt.auth:seller', 'auth.check.seller'])->group(...)`:

   ```php
   use App\Http\Controllers\Application\Product\ProductStatusController;

   Route::post('/updateProductStatus', [ProductStatusController::class, 'update']);
   ```

3. `php artisan route:clear` if you cache routes.

**Enable in the web app**

```
VITE_FEATURE_LISTING_STATUS=true npm run build
```

"Pause listing", "Mark as sold" and "Reactivate" then appear in *My listings*,
along with the matching tabs.

**Note on visibility:** the public listing endpoints do not filter on `status`,
so a paused or sold listing would still appear in search. To make pausing
actually hide a listing, add to `showProducts()` and `showProductsWithoutAuth()`:

```php
$query->whereIn('status', [0, 1]);
```

This is the one part that is **not** purely additive — it also hides such
listings from the mobile app. That is the intent, but it is a behaviour change.

---

## 3. Listing reports

There is no reporting anywhere in the platform today — not in the mobile app,
not in the API. The web client added the feature, and without a backend it can
only open the user's email client, which has no rate limiting, no audit trail,
and depends on the visitor having a mail app configured. It is a stopgap, not a
production moderation pipeline.

**Install**

1. Copy `ReportController.php` to
   `app/Http/Controllers/Application/ReportController.php`.
2. Copy `create_reports_table.php` into `database/migrations/` with a timestamped
   name, e.g. `2026_09_12_000000_create_reports_table.php`, and run
   `php artisan migrate`.
3. Register the route inside the `jwt.auth` group in `routes/api.php`:

   ```php
   use App\Http\Controllers\Application\ReportController;

   Route::post('/reports', [ReportController::class, 'store']);
   ```

4. Add the moderation destination to `config/mail.php` — **server-side, so it is
   never shipped to browsers**:

   ```php
   'moderation_address' => env('MODERATION_EMAIL'),
   ```

**Enable in the web app**

```
VITE_FEATURE_REPORTS_API=true npm run build
```

The dialog then submits to the API instead of opening a mail client, and the
"opens your email app" notice disappears.

The endpoint requires authentication, limits each reporter to 10 reports per
hour, and stores one report per user per listing.

---

## 4. Server-side price filter, condition filter and sorting

See `product-filters.patch`. The web client already sends `minPrice`,
`maxPrice`, `condition` and `sortBy` on every search; the current API ignores
them and the browser refines the returned page locally. That is correct for the
current catalogue but wrong across paginated results and slow at scale.

Applying the patch moves the work into the database. No web flag is needed —
the client already sends the parameters, and its local pass becomes a no-op.

The patch text also lists the indexes worth adding for these queries.
