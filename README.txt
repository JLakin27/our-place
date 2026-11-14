OUR SPACE — LOGIN/CONNECTION HOTFIX

Replace ONLY app.js in GitHub with the included app.js.
Keep your existing index.html, styles.css, firestore.rules and Firebase Console rules unchanged.

This fixes the pendingKisses variable/function name collision in refreshHome() that caused a JavaScript ReferenceError.

Commit, wait for GitHub Pages deployment, then hard-refresh the site. If it is still stuck, open the browser DevTools Console and share the FIRST red error.
