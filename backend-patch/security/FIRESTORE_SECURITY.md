# Firestore chat security — audit finding and fix plan

**Severity: critical. Pre-existing; it affects the mobile app exactly as much as
the web app. Nothing in the web client caused or worsened it.**

## Finding

Every private conversation and every message body in the Souqna Firestore
project is readable by anyone on the internet, with no credentials at all.

Verified on 2026-09-12 against project `souqnaapp-2c1da` using only the public
web API key, with no user session of any kind:

```
GET /v1/projects/souqnaapp-2c1da/databases/(default)/documents/conversations
  → HTTP 200, conversation documents returned
    members = ["d00f7305-…", "2b8dbc43-…"]   (real user UUIDs)
    lastMessage.text = "test"

GET /v1/projects/souqnaapp-2c1da/databases/(default)/documents/conversations/<id>/messages
  → HTTP 200, message bodies returned
    "ايوه" · "hey" · "هلا"  with sender names
```

So an unauthenticated party can enumerate every conversation, read the full
message history of any of them, and harvest the user-id graph of who is talking
to whom.

**Write access was not tested**, because testing it means writing to production
data. Rules permissive enough to allow unauthenticated reads are almost always
`allow read, write: if true`, so assume message injection and impersonation are
also possible until checked. This can be confirmed in the Firebase console under
Firestore → Rules without touching data.

## Root cause

Both clients authenticate against the Laravel API with a JWT and **never sign in
to Firebase Auth**. The mobile app imports `getAuth` in `src/config/firebase.ts`
but no `signInWith*` call exists anywhere in the codebase; the web client
inherited the same model.

With no Firebase identity, `request.auth` is always `null` inside security
rules, so the only rule set under which chat can function today is one that
allows anonymous access. Access control is currently enforced *only* by the
client choosing which conversation to open — which is not enforcement.

## Why this cannot be fixed by editing the rules alone

Tightening the rules to `request.auth != null` would break chat in the shipped
mobile app immediately, because no client has a Firebase identity to present.

Restricting `list` while allowing `get` does not work either: the inbox is built
from `where('members', 'array-contains', uid)`, which is a `list` operation, so
blocking it would empty every user's conversation list.

Firestore rules cannot validate a Laravel-issued JWT. The identity has to be
translated into something Firebase understands, which means **Firebase custom
tokens**.

## The fix

Laravel mints a Firebase custom token for the already-authenticated user, reusing
the user's existing UUID as the Firebase `uid`. Both clients exchange it for a
Firebase session. Rules then check membership against `request.auth.uid`.

Nothing about the data model changes — `members` already holds those same UUIDs,
so the rules in `firestore.rules` match the documents as they exist today.

Required pieces, all included in this folder:

| File | Purpose |
| --- | --- |
| `FirebaseTokenController.php` | Laravel endpoint minting the custom token |
| `firestore.rules` | The target rules |

The backend already has everything needed: `firebase/php-jwt` is a dependency,
and `ApplicationController::sendFcmNotification` establishes the
service-account-file pattern. No new composer package is required.

## Rollout order — this matters

Deploying the rules before the clients can authenticate **will break chat for
every user**.

1. **Deploy the backend endpoint** (`POST /api/firebase-token`). Harmless on its
   own; nothing calls it yet.
2. **Ship the web client** with Firebase sign-in enabled
   (`VITE_FEATURE_FIREBASE_AUTH=true`). The web already contains the sign-in
   code, written so that a missing endpoint is a silent no-op.
3. **Ship a mobile release** that calls the same endpoint and signs in. Wait for
   adoption — check your analytics for the share of users still on older builds.
   Anyone left behind loses chat the moment step 4 lands.
4. **Deploy `firestore.rules`.** Verify with the Firebase console Rules
   Playground before publishing.
5. **Re-run the probe above.** It must come back `403 PERMISSION_DENIED`.

## Interim mitigation

There is no rule change that is both safe for the current mobile app and
meaningfully protective — that is precisely the trap this architecture creates.
Until step 4 ships, the practical options are:

- Treat all existing chat content as compromised. Anything sensitive users
  exchanged (phone numbers, addresses, prices) should be assumed public.
- Prioritise steps 1–3. They are small and can land quickly.
- If the exposure is judged unacceptable in the interim, disabling chat in both
  clients is the only complete stopgap — a product decision, not a technical one.

## Service account setup

The token minting needs a service account key for `souqnaapp-2c1da`:

1. Firebase console → Project settings → Service accounts → Generate new private
   key.
2. Save it outside the web root, e.g. `storage/app/firebase/souqna-admin.json`,
   and make sure it is **not** committed to git and not served publicly.
3. Point `FIREBASE_CREDENTIALS` at it in `.env`.

Note: `sendFcmNotification` currently reads `storage/app/json/file.json` and
targets project `shujat-eecf2` with a hardcoded device token — that looks like
leftover template code and is worth reviewing separately.
