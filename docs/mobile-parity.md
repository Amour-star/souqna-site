# Web ↔ mobile parity

Compared against `my-react-native-souqna-app` (screens, navigation, `api/apiServices.js`,
`api/authServices.js`) and the live API at `backend.souqna.net`.

**Legend** — *iOS*: the feature exists in the app · *Web*: ✅ implemented, ➖ deliberately not
implemented, ⛔ blocked · *API*: whether the live backend supports it.

## Screen → route → endpoint map

| iOS screen | Web route | Endpoints |
| --- | --- | --- |
| Login / Register / OTP | `/login` `/register` `/verify` | `auth/login`, `auth/register`, `verifyRegisterOtp`, `resendOtp` |
| ForgetPassword | `/forgot-password` `/reset-password` | `forgotPassword`, `verifyRegisterOtp`, `resetPassword` |
| Search (home) | `/` | `viewCategories`, `showProductsWithoutAuth` |
| AllCategories / SubCategory* | `/category/:id[/:sub]` | `categories`, `subCategoriesByCategory/:id`, `showProducts*` |
| SearchResults + filters | `/search` | `showProducts`, `showProductsWithoutAuth` |
| ProductDetail | `/listing/:slug` | `productDetails/:id`, `products/:id/view` |
| SellerProfile | `/seller/:id` | `getSellerDetails/:id`, `showProductsWithoutAuth` |
| CreateProduct / UpdateProduct | `/sell`, `/sell/:id` | `createProduct`, `updateProduct`, `deleteImage/:id` |
| Advertise (my listings) | `/profile/listings` | `showAllProducts`, `deleteProductSeller/:id` |
| Favourite | `/favorites` | `getFavorites`, `addToFavorite`, `removeFromFavorite` |
| Inbox / Chat | `/messages[/:id]` | `chat/start` + Firestore `conversations/*` |
| Notification / BuyerNotification | `/notifications` | `viewAllNotificaionsSeller/Buyer`, `delete/clearNotifications*` |
| Profile / MyAccount / ChangePassword | `/profile`, `/profile/settings` | `auth/user`, `updateProfile`, `changePassword`, `deleteUserAccount` |
| Verification | `/profile/verification` | `viewVerification`, `verification`, `updateVerfication` |
| About / Help / Data / Design | `/how-it-works.html`, `/faq.html`, `/privacy.html`, `/terms.html`, `/support.html` | — |

## Checklist

| Feature | iOS | Web | API | Notes |
| --- | :-: | :-: | :-: | --- |
| Login / register / logout / token refresh | ✔ | ✅ | ✔ | Same JWT and refresh flow |
| Email OTP verification | ✔ | ✅ | ✔ | |
| Password reset / change | ✔ | ✅ | ✔ | |
| Delete account | ✔ | ✅ | ✔ | Also has public `delete-account.html` |
| Google / Apple sign-in | ✔ | ⛔ | ✔ | `auth/google` / `auth/apple` take a native SDK ID token. The web needs a Google **web** OAuth client ID that the backend accepts as an audience — a Google Cloud + backend config decision |
| Home: categories + latest listings | ✔ | ✅ | ✔ | Categories are live from the API |
| Categories → subcategories | ✔ | ✅ | ✔ | Dynamic, Arabic names (`ar_name`) |
| Keyword search | ✔ | ✅ | ✔ | Server-side (`productName`), debounced |
| Filter: category / subcategory | ✔ | ✅ | ✔ | Server-side |
| Filter: location (text) | ✔ | ✅ | ✔ | Server-side substring match |
| Filter: nearby radius (GPS) | ✔ | ✅ | ✔ | Server-side |
| Filter: price range | ✔ | ✅ | ✖ | API ignores it → refined over a ≤500-record window, totals stay correct |
| Filter: currency | – | ✅ | ✖ | Added: price bounds are meaningless across USD/SYP/TRY |
| Filter: condition, sort | ✔ | ✅ | ✖ | As above |
| Filter: category attributes | ✔ | ✅ | ✖ | Generated from `category.fields`. **No category has fields configured today**, so none appear |
| Governorate / city / district picker | ✔ (map) | ✅ | ✖ | API has no location data. Gazetteer from OpenStreetMap + live Nominatim — see README |
| Map picker (drag pin) | ✔ | ➖ | – | Coordinates come from the place / GPS instead. Listing page does not embed a map |
| Listing detail (gallery, seller, specs) | ✔ | ✅ | ✔ | |
| Favourite / unfavourite | ✔ | ✅ | ✔ | Optimistic |
| Contact seller: chat | ✔ | ✅ | ✔ | Firestore, same `conversations/*` documents. Read `backend-patch/security/FIRESTORE_SECURITY.md` — chat data is currently world-readable |
| Contact seller: phone / share | ✔ | ✅ | ✔ | |
| Report listing | ✔ | ✅ | ◐ | Falls back to email unless `VITE_FEATURE_REPORTS_API` and the backend patch are live |
| Seller profile page | ✔ | ✅ | ✔ | |
| Create listing (category → … → publish) | ✔ | ✅ | ✔ | 6-step wizard, draft autosave |
| Edit / delete listing | ✔ | ✅ | ✔ | |
| Pause / mark sold | – | ➖ | ✖ | Needs backend patch (`VITE_FEATURE_LISTING_STATUS`) |
| Image upload (multi, reorder, remove) | ✔ | ✅ | ✔ | Drag & drop, camera on phones, client-side downscale |
| Notifications list / delete / clear | ✔ | ✅ | ✔ | |
| Push notifications (FCM) | ✔ | ➖ | ✔ | Web push not built |
| Profile / settings / language | ✔ | ✅ | ✔ | Arabic default, English preserved |
| Seller verification (KYC) | ✔ | ✅ | ✔ | Implemented from the app's contract; **not exercised against production** (would submit real ID documents) |
| Buyer ↔ seller role switch | ✔ | ✅ | ✔ | |
| Import ads from Doushesh | – | ➖ | ✔ | Web-only; disabled by default (`VITE_FEATURE_DOUSHESH_IMPORT`) |
| Plans / card subscription | ✔ | ➖ | ✔ | The app posts raw card details to `subscription`. Not replicated on the web — payments belong with a hosted payment provider |
| Cart / checkout (`placeOrder`) | ◐ | ➖ | ✔ | Not reachable in the app: no navigation leads to Cart, and the Checkout call is commented out. Not a classifieds flow |
| SEO: prerendered HTML, JSON-LD, sitemap, robots | – | ✅ | – | See README |

`◐` = partial · `✖` = the live API does not support it.

## Known divergences fixed on the way

- Category-attribute options were stored **translated** by the web and **canonical (English)** by
  the app. The web now stores the canonical value, so listings from both clients filter alike.
- The web sent an extra `ar_name` inside `custom_fields`; it now sends `{name, value}` like the app.
- Price/condition/sort refined a single page under a total for the whole set. Now the whole
  matching set (bounded) is refined and paginated locally.
