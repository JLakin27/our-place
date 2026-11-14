# Our Space — Our Music 🎧

Based on the latest *Travel description editing / neutral clusters / Status column* website release. It preserves the existing map, profiles, kisses, Dodo wheel, checklist and homepage KPIs.

## Install

1. Back up your currently working GitHub website first.
2. In the repository root, replace `index.html`, `app.js` and `styles.css` with the three files from this ZIP.
3. In **Firebase Console > Firestore Database > Rules**, add the new `match /musicTracks/{trackId}` block from `FIRESTORE_RULES_ADD_THIS.txt` *inside your existing* `match /databases/{database}/documents { ... }` and *before* the final catch-all. **Do not replace your existing rules!** In particular preserve the recent description-editing fix, profile and kiss permissions.
4. Click **Publish**. Copy the finished full rules into GitHub `firestore.rules` too, for version control.
5. Let GitHub Pages deploy and hard-refresh the website.

## How it works

- **Our Music 🎧** is accessible from the homepage and side menu.
- **Current jams:** each person's most recently shared track. New shares automatically move their old track into **Our collection**, which contains all previously shared tracks, including current ones.
- **Share a track:** paste a full `https://open.spotify.com/track/...` link, optionally add a short note. Spotify oEmbed supplies title and thumbnail; if unavailable, the link is still saved and Spotify's iframe player displays the details.
- **Listen:** opens Spotify's official track iframe within an on-page popup; the popup also has an **Open in Spotify** link. Playback restrictions depend on Spotify/browser/account.
- **Shuffle:** selects a random saved song and opens its player. Nothing automatically tracks either user's listening activity.
- **Privacy:** music entries are stored under the separate Firestore collection `musicTracks`. Only the two existing approved accounts can read or add songs, and each person can only add entries as themselves. No uploads, Spotify OAuth or extra billing configuration.

## Important

The music collection **requires the new Firestore rules** to load or accept saves. If you see `Missing or insufficient permissions`, confirm that you published the new music rule *as an additional block* inside your existing rules. Do not replace the ruleset with the snippet alone. Only full Spotify track URLs are accepted; Spotify's short `spotify.link` share URLs need to be opened first to get the full link.

## Basic checks

1. Open the new Music page on desktop/mobile; verify the map/checklist still load.
2. Share a Spotify track as Joe and verify the artwork, Spotify embed and title.
3. Share a second song; the first should remain in Our collection.
4. Open from Noémie's account and confirm Joe's song is visible and Noémie can share her own.
5. Test Shuffle and the embedded player; close the player and check it stops.

## Testing notes

JavaScript syntax and file references have been checked. Live Firestore authentication, permission rules, and Spotify iframe playback cannot be fully validated against your accounts here; test them after deploying.
