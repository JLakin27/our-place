Our Space — friendlier shared-list wording

Replace ONLY these two files in the ROOT of your existing GitHub Pages repository:
- index.html
- app.js

KEEP styles.css and firestore.rules unchanged.

Changes: 
- Maps: “Approved” becomes “Both up for it”; “Approve” becomes “I’m up for it ✓”; “Vetoed/Veto” becomes “Not for me”; pending text becomes “Waiting for a response”.
- Our Places To: “Approved” tab becomes “On our list”, positive action “I’m up for it ✓”, negative action “Not for me”, and Dodo copy updated.
- Home KPI sub-labels updated; headline KPI labels remain unchanged.
- Notifications, WhatsApp share prompt, and helper copy use less formal language.

IMPORTANT: Database status values such as approved, suggested, visited, vetoed are intentionally UNCHANGED. The change is only to the language displayed to people. Your existing records and Firestore security rules remain compatible.

After uploading, hard refresh both devices. Check a suggested map place, a Places To suggestion, map filters, and the homepage At a glance panel. No Firebase changes required.
