OUR SPACE — KISS MOMENT & INBOX WORDING

WHAT CHANGED
- Homepage inbox text: "1 list idea" / "2 list ideas".
- Notification copy: "suggested a new list idea", "suggested this trip".
- A short kiss-opening animation: 😘, floating hearts, 🥰, "Mwah!"; no reply button.
- Only ONE visible kiss notification in a recipient's inbox, even if they had multiple older kisses.
- Every new send writes to one fixed recipient-keyed Firestore document instead of creating extra records.
- Senders can send any number of kisses but CANNOT read or query the recipient's kiss document. No read receipts, counters, or delivery status.
- Opening clears the visible kiss plus legacy older kiss notifications.

INSTALL (IMPORTANT: FIREBASE RULES FIRST)
1. Back up the current Firebase rules and website.
2. In Firebase Console → Firestore Database → Rules, replace all existing rules
   with the complete contents of firestore.rules.txt, then Publish.
   This file is based on the Music-polish rules provided earlier, preserves
   description editing, both profiles, the checklist, and owner-only music deletion.
   If you've manually changed Firebase rules since that version, compare them first.
3. Copy the same rules into GitHub's firestore.rules file.
4. Replace app.js, index.html and styles.css in GitHub Pages with these files.
5. Commit and hard refresh the website.

TEST
- An incoming trip notification says "suggested this trip".
- An incoming checklist suggestion says "new list idea" and the home inbox counts "1 list idea".
- Send 3 kisses from Joe: only one notification appears for Noémie.
- Open the kiss: animation plays; inbox clears. No "send one back" button.
- Send another kiss afterwards: one fresh notification appears.
- Sender never sees open status or the recipient's kiss queue.

CAUTION
- The Firestore rules must be published before testing send, since the new
  fixed-document writes require update permission on an existing kiss.
- Old random-ID kisses are not automatically deleted until their recipient opens one.
- If sends and opens happen at precisely the same moment, a new kiss may be
  cleared with the opened one; ordinary use is unaffected.
- No live Firebase access was available to exercise the rules in production.
