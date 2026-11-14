# Our Space — Travel description editing, neutral clusters, and Status column

Based on the latest **Most Tempting** release, preserving the existing English-labelled map, profile wording, and other features.

## Install
Replace these three files in the GitHub Pages repository root:
- `index.html`
- `app.js`
- `styles.css`

Leave Firebase Auth settings, `firestore.rules`, and existing Firestore data unchanged. No migration is needed.

## Updates
- On **Our Next Stop**, open any saved destination, then click **Edit description**. Either of the two signed-in users can edit it whether suggested, both up for it, visited or not for me. Save or cancel at any time. Uses the existing `notes` field.
- Cluster badges have a neutral slate-blue background instead of the orange of the Both up for it status. The number counts clustered places regardless of status.
- On **Our Places To > Suggestions**, the `Decision` column header now reads `Status`. Actions are unchanged.

## Check
After publishing, edit an existing description, reload and confirm it persisted on both accounts; zoom map in/out to test neutral clusters; check Suggestions > Status on mobile.

Technical: JavaScript syntax has been checked, but live Firebase interactions have not been tested.
