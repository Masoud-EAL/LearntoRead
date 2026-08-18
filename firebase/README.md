# Firebase security rules

`database.rules.json` locks down the Realtime Database used by `game.html`:

- **`customBanks/$teacherId`** — a teacher's question banks are only readable
  and writable by that same `auth.uid`. `game.html` signs every visitor in
  anonymously and namespaces banks under their own UID (see `banksRef()` /
  `authUid` in `game.html`), so each teacher/device gets a private pool
  instead of sharing one global `customBanks` node.
- **`rooms/$code`** — only the room's creator (`hostUid`, set once at
  creation and immutable) can update or delete it. Anyone signed in can still
  garbage-collect a room, but only a room that is *actually* stale by the
  **server clock** (`now`, not a client-supplied timestamp) — 24h old, or 2h
  old and over (`status` of `finished`, i.e. the leaderboard was shown, or
  `ended`, i.e. the teacher left) — so a device with a wrong clock can't be tricked (or
  used) into deleting someone else's live game. `createdAt` is validated to
  equal `now`, i.e. it must be written with `firebase.database.ServerValue.TIMESTAMP`.
  `players/$playerId` and `answers/$playerId` stay writable by any signed-in
  client, since students (who aren't the host) need to write their own
  roster entry and answers.
- **`customQuestions`** — the old, pre-migration flat data model. Left
  readable/writable by any signed-in user only so the one-time migration in
  `loadCustomBanks()` can finish reading/deleting it; it holds no
  teacher-specific data once migrated.

## Deploying

This repo has no Firebase CLI project config (it's a static site deployed via
GitHub Pages — see `.github/workflows/deploy.yml`), so these rules aren't
deployed automatically. Apply them by either:

1. **Firebase CLI** (one-time, from this directory):
   ```
   npm install -g firebase-tools
   firebase login
   firebase deploy --only database --project wordlink-game-d1f97
   ```
2. **Console**: open the project's Realtime Database → Rules tab and paste
   the contents of `database.rules.json`.

Either way the deploy **replaces the whole rule set** — it is not a merge. So
before applying, read what is live (Console → Realtime Database → Rules) and
check it against this file: anything edited straight into the console since the
last deploy is reverted otherwise. `--only database` is what keeps the deploy
off Hosting and everything else; never run a bare `firebase deploy` here.
The Rules tab keeps a version history, so a bad deploy can be rolled back.

Also enable **Anonymous** sign-in under Authentication → Sign-in method —
`game.html` now calls `firebase.auth().signInAnonymously()` on load and
every read/write depends on it.
