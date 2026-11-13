# Our Space — Our Places To simplified (upvotes + Dodo picker)

## Deployment

1. **Back up your current working GitHub files.**
2. Replace only `index.html`, `app.js`, and `styles.css` in the existing GitHub Pages repository. Upload them as individual files to the repository root (not the ZIP itself).
3. Commit. Refresh with Ctrl+Shift+R.
4. **Do not change Firebase Authentication, Firestore data, or Firestore rules.** This release deliberately reuses `joeStars` and `noemieStars` fields so existing documents remain readable. The existing rules permit the new on/off updates.

## Behaviour

- The approval/veto workflow remains unchanged. After approval, Joe and Noémie can each independently toggle a heart (upvote) on or off. Votes mean *I really want this*, not consent.
- An existing allocation of any number above zero is treated as **one upvote** for that person. No Firestore migration is needed. Next time someone toggles their vote it is saved as 0 or 1.
- Approved ideas are ordered by total upvotes (0–2), then by newest submission. The submitted date comes from the existing Firestore `createdAt` field. Very old items without a date show a dash.
- The Dodo Decides picker spins and cycles through approved, incomplete ideas before displaying a result. Selection is uniform regardless of upvotes and does not write to Firebase. A reduced-motion setting skips the spin.
- Done, suggest, approve, veto, delete, Undo, login, map, syncing and PWA-free hosting are unchanged.

## Testing checklist

- Joe signs in and sees checklist. Captain signs in separately.
- Existing ideas appear, with old allocations above 0 treated as hearts.
- Toggle Joe's heart, then confirm that Captain sees it. Toggle Captain's separately.
- Verify date column and ranking update.
- Run the picker and confirm it displays an approved idea.
- Confirm a new suggestion still requires the other account's approval.

Note: This is a frontend update built from the last supplied Our Space files and the latest small-edits release, not a live integration test. In particular, the live site's manually edited wording may differ slightly.
