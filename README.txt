OUR SPACE — MUSIC POLISH & OWNER-ONLY DELETION

CHANGES
- Removed the music page footnote.
- Increased heading letter spacing for On repeat right now and Our collection; slightly eased the main music title spacing too.
- In the song player popup, the person who shared the song gets Delete my share. Confirming deletes that song from the shared collection. If it was their newest share, their next-newest remaining share automatically becomes current. Noémie cannot delete Joe’s songs and Joe cannot delete Noémie’s.

INSTALL
1. Back up current working website. Replace GitHub root index.html, app.js and styles.css with the supplied files.
2. IMPORTANT: Publish the full contents of firestore.rules.txt at Firebase Console > Firestore Database > Rules. This is the complete rules file based on the exact rules you pasted in this conversation, plus the previous Music permissions and new owner-only delete. It retains map description edits, checklist, profiles and kisses.
3. Copy the same published rules to your GitHub firestore.rules file for backup/version control.
4. Verify as Joe: delete a song Joe shared; verify it disappears from both views and that Noémie’s songs have no Delete my share button. Verify the reverse on Noémie’s account.

Deleting is permanent (confirmation prompt, no undo). No existing songs are changed during deployment.
The JavaScript syntax and archive were checked locally. Live Firebase deployment has not been tested.
