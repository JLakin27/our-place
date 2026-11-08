# Our Places To — update instructions

This update adds a private, independent checklist to the existing site. Your existing map collection (`places`) is unchanged.

## Deploy
1. Back up your existing live GitHub files.
2. Upload/replace **index.html**, **styles.css**, and **app.js** with these files. Firebase config and login mappings from the last working app.js are retained.
3. In Firebase Console → Firestore Database → Rules, replace the full rules text with **firestore.rules** supplied here and click Publish. Do this before testing new checklist writes. The rules include your two existing UID values; double-check these are still accurate.
4. Reload the GitHub Pages website and check that Our Places To opens from both Home and the sidebar.
5. Suggest a test idea from Joe, approve with Captain, allocate stars on each account, tick it off.

## Important
- The checklist lives in **placesTo** separately from travel map's **places** collection.
- Approval and stars are restricted to the two signed-in users. Each can only edit their own stars.
- The 10-star total is checked in the client and Firestore transaction, but the rules enforce only **0–10 per item**, not the aggregate 10-star total. A modified client could exceed the total. Strong server-side enforcement would require a revised allocation model.
- Completed items remain in the Done tab. Stars are returned to both budgets.
- No default checklist entries are created.
- The names/notes of this checklist are stored in Firebase, not in end-to-end encrypted storage; keep that in mind before adding intimate details.
- No GitHub repository changes alone can activate the Firestore collection permissions; publish Firestore rules separately.
