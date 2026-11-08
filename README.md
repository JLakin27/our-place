# Our Website — Joe & Noémie

Responsive static website with a homepage and an interactive shared-travel map. No build step: `index.html`, `styles.css`, and `app.js` run on GitHub Pages. In preview mode, data stays in **this browser only**; with Firebase enabled, places sync across both accounts through Firestore.

## What's new

- **Homepage:** Our next stop 🌍, Our places to 😈 (coming soon), Our positions 🥵 (coming soon), Our moments (coming soon).
- **Map:** suggested → approved (or vetoed) → visited. Suggestion author is identified by the signed-in Firebase account, not a selectable dropdown. In demo mode you can switch between Joe and Noémie to simulate this.
- **Notifications:** a bell counts suggestions from the other person, visible when opening the site. Selecting a notification opens that suggestion, where you can approve or veto.
- **WhatsApp:** each place has a **Share on WhatsApp** button using the phone's share sheet where supported, otherwise copying a message containing a deep link to the place. The other person must sign in and press Approve or Veto **on the website**; WhatsApp itself does not handle approvals.
- **Visited:** mark an approved place done, add a memory note, optionally supply an HTTPS link to a public image. Actual private photo uploads and albums are future work.
- **Legacy data:** old `Agreed Trip`, `Wishlist - Her`, and `Wishlist - Him` records continue to display with the correct status/name. The Norway starter note displays as `fjords 😍😍😍` even if its existing Firestore record still has the previous text; newly seeded records store the new note. Existing data is not deleted or automatically migrated.
- **Map labels:** the free OpenStreetMap raster tiles can show local-language names. English search results are requested where available. Fully English map tiles will require a suitable tile provider and configuration later.

## Step 1: Replace site files

In your GitHub Pages repository, replace **all three** of `index.html`, `styles.css`, and `app.js` with the provided versions (same root folder). If you already use Firebase, copy your existing real `firebaseConfig` values into the top of the **new** `app.js` first; these new files have placeholders.

GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → main → / (root)**. If your site is already hosted this way, simply commit the replacement files; no new Pages setup is needed.

## Step 2: Individual logins and Firestore

1. Firebase console: https://console.firebase.google.com → **Project settings → General → Your apps → Web app**. Copy each Firebase config value into `app.js`.
2. Firebase **Authentication → Sign-in method**: enable Email/Password. Under **Users**, manually create Joe and Noémie's accounts (no public sign-up UI).
3. Copy each user's **UID**, which is different from their email address. Put Joe's UID and Noémie's UID into `USER_UIDS` near the top of `app.js`. This is essential: it allows the site to recognize who proposed and who may review a suggestion.
4. In `firestore.rules`, replace **every occurrence** of `REPLACE_WITH_JOE_UID` and `REPLACE_WITH_NOEMIE_UID` with those UIDs. In Firebase **Firestore Database → Rules**, paste the entire new rules file and **Publish**. The code file alone does not change deployed Firestore security.
5. Deploy the updated HTML, CSS and JS. Sign in as Joe on one device and Noémie on another and test proposing, approving, vetoing and marking visited.

**If you haven't set up Firebase yet**, you can try everything in local preview mode: the app uses `localStorage` and adds a **Preview as Joe / Noémie** switch on the map page. Local preview is not shared across devices, and preview data is not automatically uploaded to Firebase.

**Do not publish actual passwords, private keys or service account JSON files.** Firebase web config and UIDs are not secret; Firestore rules must enforce the restrictions. The rules enforce that the proposer cannot approve or veto their own suggestion, even if they manipulate the website's JavaScript. The shared users can delete records, so this remains a trust-based two-person project.

## Existing records and migration

Keep the same Firebase project and Firestore database, and don't delete the `places` collection. Older records do not have `status`; they are interpreted as approved for `Agreed Trip`, or suggested for `Wishlist - Her` / `Wishlist - Him`. Changes to old records use the new schema on first update; the rules are written to accept both. Previously proposed records can be approved by the *other person*.

For one-time seed records, the `meta/starter-seed` transaction lock prevents duplicate starters. Changing the source code does not overwrite a previously saved Norway note in Firestore; the display includes a compatibility override. Later you can edit that document manually in the Firebase console if you'd like the backend value to match.

## Technical notes

- Firebase libraries load from Google CDN; map uses Leaflet + OpenStreetMap; city search uses Open-Meteo's English-language geocoding API.
- `firestore.rules` controls data access; website repository visibility does not protect private data. Ensure you publish the restricted rules before sharing the website widely.
- The Share text uses a URL hash such as `#place-...`; after the recipient signs in, opening the link goes to the matching place.
- This version intentionally does **not** send push, email, or WhatsApp messages automatically. The in-app bell uses Firestore live sync when the page is open. Browser notifications when closed need additional infrastructure and permissions.
- The coming-soon pages are placeholders rather than working checklists or photo libraries.
- Any photo URL you add is a publicly accessible image URL. Don't paste private photos you do not want exposed at that image address; Firebase Storage uploads with scoped access can be built later.

## Run locally

Use `python -m http.server 8000` inside the folder, then open `http://localhost:8000`. Using `file://` for JavaScript modules is not recommended.
