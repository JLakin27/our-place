# Our Space — collapsible homepage KPIs

Small, isolated homepage update based on the **latest Our Space Profiles & Kisses** release.

## What changed
- Kept **Your inbox** directly below the two main navigation cards.
- Removed the old homepage text counts, recent-activity line, and rotating footer message.
- Added **At a glance**, collapsed by default with a Show/Hide control.
- On expansion, four live Firestore-backed totals: approved unvisited travel destinations, visited destinations, approved unfinished checklist ideas, and completed checklist ideas.
- Clicking travel metrics opens Our Next Stop; clicking checklist metrics opens Our Places To.
- Removed the extra sentence beneath **Send a kiss**.

## Deploy
1. Back up your currently working GitHub files.
2. Replace only `index.html`, `app.js`, and `styles.css` in the GitHub Pages repository root. Commit all three together.
3. Do **not** change Firestore rules, Firebase logins, or existing data.
4. Hard refresh (`Ctrl+Shift+R`) after GitHub Pages finishes deploying.
5. Verify Inbox still works, expand/hide the cards, and compare counts with both pages.

## Notes
- No Firebase writes added. The metrics count locally from existing real-time snapshots.
- The panel resets to collapsed on a full page reload.
- This version was syntax and DOM-reference checked but not connected to your live Firebase project for testing.
