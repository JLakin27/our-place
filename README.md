# Our Space — Profiles + Send a Kiss 😘

This is an incremental release based on the last working **Dodo wheel sync fix**. Existing map and checklist logic, Firebase IDs, logins and saved records are retained.

## Deployment (IMPORTANT: two locations)

1. Make a backup of your current GitHub files (Code → Download ZIP).
2. In **Firebase Console → Firestore Database → Rules**, replace the entire rules editor text with the contents of `firestore.rules` from this package and click **Publish**. This retains the rules for your existing `places` and `placesTo` collections, and adds two new private collections: `profiles` and `kisses`. Publish **before testing the new UI**.
3. In your GitHub repository root, upload/replace **only** `index.html`, `app.js`, and `styles.css` from this ZIP. Commit to your GitHub Pages branch. Do not upload the ZIP itself as your website.
4. Refresh your existing site using Ctrl+Shift+R. Both accounts and existing records remain unchanged. No new Firebase Auth users are required.
5. Test with both logins, ideally in different browsers: Joe edits his profile; Captain sees Joe's avatar/status; Joe sends a kiss; Captain opens the bell to see it and taps it to dismiss. Test a travel map pin and a checklist vote as regression checks.

## How the new features work

- Both avatars appear at the top. The other person's avatar is first, yours second. Emoji status overlaps the avatar at bottom-right. On narrow phones, the names disappear but the avatars remain; each button has an accessible label.
- Your account controls your own avatar, colour and status only. The status remains until changed or cleared.
- Eight quick status emojis in this order: 🦤 ❤️ 🥰 🥺 😂 😴 😈 😡. A custom emoji field is available for avatar and status. Avatar presets and eight palette colours are included.
- The UI always displays the name **Noémie**; **Captain** is only her login alias, as before.
- Send a kiss saves a small notification to Firestore. Only the recipient can see and dismiss it. Tapping a received kiss deletes the notification and removes it from the count. The sender gets a “Kiss sent” confirmation, but no read receipt or online-status information.
- No photos, Firebase Storage, push notifications, message histories or new paid services are added.

## Security and limitations

- The new Firestore rules only allow the two existing account UIDs. Each account may edit only its own profile. Kisses can only be sent to the other account, read by the recipient and dismissed by that recipient.
- The existing `places` and `placesTo` rules remain unchanged. **Do not use open Firestore rules** (`allow read, write: if true`).
- The new features will give a permissions error if the new Firestore rules have not been published.
- Kisses are in-app only: the other person sees them next time the app is opened and online. No Android or WhatsApp push alert is sent.
- This is an online-first feature. A successful Firestore write is required before confirming the save.
- For now the custom emoji text fields accept short text; please enter an emoji rather than a word.
- JavaScript syntax and element references were checked. A live connection to your private Firebase project was not available for testing; please check both accounts after deploying.
