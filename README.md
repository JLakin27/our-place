# Our Space — Our Next Stop map update

## Install safely

1. Back up the currently working GitHub repository (Code → Download ZIP).
2. At the repository root, replace **only** `index.html`, `styles.css` and `app.js` with the three files in this ZIP. Keep their exact names.
3. Commit with a descriptive message such as `Improve travel map and places list`.
4. Refresh your GitHub Pages website using Ctrl + Shift + R after deployment.
5. **Do not change Firebase accounts or Firestore security rules.** The `firestore.rules` copy is included only as a backup/reference; it does not need publishing for this update.

## What changed

- The map now uses Leaflet.markercluster to combine nearby pins into numbered clusters. Zoom in or click a cluster to separate them. At maximum zoom, exactly overlapping markers spread apart (spiderfy).
- A compact "Our places" section above the map shows three newest places by default. Use **View all** for filters (All, Approved, Suggested, Done, Vetoed) and sort (Newest, A–Z, Oldest). Filters also apply to the map. Closing the list resets the map filter to All.
- Tap a place to focus it and open its existing details. The places/cards below the map and the duplicate sidebar list have been removed.
- The Done legend has a visible green dot, including on mobile.
- **Expand map** makes the map fill the viewport; click **Close map** or press Escape to exit.
- Done entries display their recorded visited date. Old entries without `createdAt` show "Date not recorded"; no data is changed.

## Notes and tests

This change uses the public Leaflet.markercluster CDN. If the plugin is unreachable, the map falls back to ordinary individual pins. The website still needs network access for Leaflet, Firebase and map tiles.

Test both accounts: map loads, clustering works, View all filters/sorting work, tap a place shows details, approve a suggestion, mark a place visited, and check the homepage KPIs/profile/kisses/checklist still work.

The added client-side code was checked for JavaScript syntax and element IDs, but has not been live-tested against your Firebase database. Existing Firebase configuration, UIDs, and data have been preserved.
