# Multiplayer Diagnosis — 2026-04-18

Scope: connection / lobby / matchmaking path for Line Tower Wars. Read-only investigation — no code changes proposed or applied.

## 1. Summary

The game uses Firebase Realtime Database (compat SDK v10.12.0) with Anonymous Auth, driving peer-to-peer matchmaking via a shared `/rooms` tree (no custom server). The deployed RTDB rules (confirmed by user) correctly authorize the matchmaking scan, so the most obvious environmental cause is ruled out. The remaining code-level candidates are narrower — none individually explains failure uniformly across all three tested configurations (Edge+Chrome, two Chrome tabs, Chrome incognito). The matchmaking pipeline also routes most failure signal to `console.info` / `console.debug` and swallows exceptions in broad `try/catch` blocks, so the root cause is currently invisible without DevTools Console capture at Verbose level. Confidence on any single code-level candidate as THE root cause is Medium-Low without logs; confidence that a 30-second log capture will identify it is High.

## 2. Expected connection flow

1. Page loads. `lobby.js:494-498` binds `_boot` to `DOMContentLoaded` (or runs immediately if already loaded).
2. `MP.init()` at `multiplayer.js:51-84`:
   a. `firebase.initializeApp(FIREBASE_CONFIG)` (guarded by `firebase.apps.length`).
   b. Generate fresh `myTabId` via `_generateId("tab")` (`multiplayer.js:62-63`).
   c. If `auth.currentUser` exists, `signOut()` first, then `signInAnonymously()` (`multiplayer.js:69-73`). Capture `myUid`. Set `multiplayerAvailable=true`.
3. `lobby.js` injects `#matchmaking-overlay` + wires `#find-match-btn` (`lobby.js:24-55, 101-131`).
4. User clicks Find Match → `lobby.js:startMatchmaking()` shows overlay, calls `MP.startMatchmaking("Commander", onFound, onError)`.
5. Initial scan: `_attemptJoin(null)` → `_tryJoinWaitingRoom(null)` queries `rooms` where `status=="waiting"`, limit 20 (`multiplayer.js:354-358`). Filters: own room, stale (>90s via `STALE_QUEUE_MS` at `multiplayer.js:28`), same-tab. Sorts oldest first. Attempts RTDB transaction to claim (`multiplayer.js:477-492`).
6. If no commit: `_enterHostingMode` writes a new `rooms/<id>` with `status:"waiting"`, registers `onDisconnect().remove()`, attaches `.on("value")` listener that `_finish`es when `room.guest && room.status==="active"` (`multiplayer.js:224-262, 538-560`).
7. Immediate retry scan with own room as skipRoomId (`multiplayer.js:307-313`).
8. 2.5s poll loop re-runs `_attemptJoin` and may flip `hosting↔joining` based on `_isRoomOlder` comparison (`multiplayer.js:109-131, 315-344`).
9. Match found (either path) → `_finish({roomId, role, opponentName})` → `lobby.js:_onMatchFound` after 800ms delay: sets globals, calls `setupPresence` (`multiplayer.js:599-607`), `watchOpponentPresence`, `startNewMatch()` (`lobby.js:161-199`).
10. Per-wave sync via `submitPrepData` / `listenForBothReady` (45s timeout, `READY_TIMEOUT_MS` at `multiplayer.js:30`) / `getOpponentPrepData` / `completeBattle`.

## 3. Observed failure point

User-observable: both clients stuck on "Searching for opponent" overlay, never transitioning into a match. No console logs captured. All three repro configurations (Edge+Chrome, two Chrome tabs, Chrome incognito) fail.

For the overlay to stay visible, none of these paths fires: `_onMatchFound` (`lobby.js:161`), `cancelMatchmaking` (`lobby.js:156`), or the `onError` callback (`lobby.js:147-152`). That means `_finish` is never called inside `MP.startMatchmaking` (`multiplayer.js:184`), and neither `_enterHostingMode` nor later polling throws an uncaught error.

Most of the code path's diagnostic signal is `console.debug` or `console.info`, e.g. `"Skipping candidate room"`, `"Candidate transaction not committed"`, `"Staying host; candidate room is newer"`, `"[MP] Transaction error on room X"` (`multiplayer.js:378-527`). None of these are `console.warn` or `console.error`. With default DevTools filter settings those are hidden — the system is effectively silent on failure, so we cannot distinguish "two clients hosting, never finding each other" from "all transactions aborting" from "scan returns empty despite populated data" without opening DevTools with Verbose enabled.

## 4. Ranked root-cause candidates

### Candidate 1: Shared IndexedDB Firebase Auth persistence disrupts concurrent same-browser tabs — Confidence: Medium (narrow scope)

- **Evidence:**
  - `multiplayer.js:65-73`:
    ```js
    const auth = firebase.auth();
    if (auth.currentUser) {
      try { await auth.signOut(); } catch (_) {}
    }
    const cred = await auth.signInAnonymously();
    ```
  - The comment at `multiplayer.js:66-68` says "inherited from a duplicated tab's **sessionStorage**" — but Firebase Auth compat SDK defaults to `browserLocalPersistence` (IndexedDB + localStorage, per the Firebase Web SDK reference), not sessionStorage. IndexedDB is shared across same-origin tabs in the same browser profile.
  - Effect when two Chrome tabs load near-simultaneously: Tab A signs in → `UID_A` in shared IndexedDB. Tab B sees `auth.currentUser = UID_A`, calls `signOut()` (clears shared IndexedDB → Tab A's `onAuthStateChanged` fires → Tab A's `auth.currentUser` becomes null). Tab B signs in → `UID_B`. Both tabs' subsequent writes authenticate as `UID_B`, while Tab A's cached `myUid` (line 73) remains `UID_A`. During the auth-flap window, Tab A's in-flight writes may fail against rules requiring `auth != null`; the errors get swallowed by outer try/catch at `multiplayer.js:295-297, 311-313, 340-342`.
- **Why this explains the symptom:** In "two Chrome tabs non-incognito" — one of the user's tested configurations — Tab A's matchmaking operations can fail silently during the auth-flap window, stranding Tab A on "Searching".
- **Does NOT explain:** Edge+Chrome (separate browsers → separate persistence) or Chrome incognito (separate storage sandbox from main profile). User reports all three fail, so this is at most a co-factor — not the single root cause.
- **How to verify:** In DevTools → Application → IndexedDB → `firebaseLocalStorageDb` in both tabs, watch row changes during both tabs' loads. In Console, run `firebase.auth().currentUser?.uid` in both tabs a few seconds after both have loaded; if they're both the SAME UID but `window.MP.getMyUid()` differs between tabs, this candidate is active.
- **Fix sketch (do not implement):** Call `firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE)` BEFORE `signInAnonymously()` so each tab has isolated in-memory auth. Remove the signOut-then-signIn pattern (its sessionStorage premise is incorrect).

### Candidate 2: `onDisconnect().remove()` registration race leaves orphan "waiting" rooms — Confidence: Medium

- **Evidence:**
  - `multiplayer.js:232-234` in `_enterHostingMode`:
    ```js
    const roomId = await _createWaitingRoom();                         // room written, no cleanup armed
    myWaitingRoomId = roomId;
    await db.ref(`rooms/${roomId}`).onDisconnect().remove();           // cleanup armed
    ```
    The room exists in RTDB BEFORE `onDisconnect` is registered. A tab refresh, crash, navigation away, or network blip in that window leaves the room in `status:"waiting"` until the 90s `STALE_QUEUE_MS` cutoff (`multiplayer.js:28, 390-398`).
  - Same structural gap existed in the prior committed version (`git show 450f824:multiplayer.js` lines 165-167) — pre-existing, not a new regression.
  - The `sameTab` filter at `multiplayer.js:412` uses `hostTabId`. Because `myTabId` is regenerated every page load (`multiplayer.js:62-63`), **a prior-session orphan from your OWN browser profile has a stale `hostTabId` and does not match the current `myTabId`.** The fallback to `room.host === myUid` only triggers when `hostTabId` is missing — it isn't. So the filter does NOT prevent joining an orphan your previous session left behind.
- **Failure mode this explains:** During testing with repeated refreshes / tab closes, orphan `status:"waiting"` rooms accumulate. A new client sees an orphan, transact-commits it (no live host is listening, so no conflict), becomes its guest. `_finish` fires as guest → `_onMatchFound` → overlay hides → game begins vs an opponent that doesn't exist. `listenForBothReady` times out after 45s → `_handleOpponentForfeit("prep")` fires → user gets a victory UI for a match with no second player.
- **Why this doesn't fully explain "stuck on Searching":** The described symptom is stuck on the search overlay, not bogus "you win" screens 45+ seconds into a match. Either (a) the user has also been seeing downstream bogus-win behavior they haven't described, or (b) orphans aren't the primary issue.
- **How to verify:** Open Firebase Console → Realtime Database → Data → `/rooms` during and after a failed test session. Count entries, check `status`, check whether they clear over time. If `status:"waiting"` entries outlive the tabs that created them, Candidate 2 is active.
- **Fix sketch (do not implement):** Register `onDisconnect().remove()` BEFORE writing room data, or verify the `onDisconnect` registration round-trip before logging "Created waiting room". Additionally, include a per-session nonce in `host` so prior-session orphans are filterable.

### Candidate 3: Uncommitted hosting↔joining flip logic cascades into thrash / stranding — Confidence: Low-Medium

- **Evidence:**
  - The uncommitted 552-insertion rewrite (`git diff --stat HEAD` → `multiplayer.js | 552 insertions, 214 deletions`) adds a `matchmakingMode` state machine (`multiplayer.js:143-145, 206-262`) that flips between "joining" and "hosting". The prior committed version at `450f824` had no such flip — a simpler linear "try-join-then-host-then-poll" flow.
  - `multiplayer.js:280-287` — `_attemptJoin` enters joining mode whenever `sawOlderRoom` is true AND we have our own room. This fires even if the transaction on the older room aborted (e.g., someone else won the race). We still throw away our own room and switch to joining. The next poll cycle has no own room, and `_enterHostingMode` at `multiplayer.js:337-339` fires after `joiningIdlePolls >= 1` — we re-create a room with a DIFFERENT ID. In pathological multi-client cases this creates extra orphan rooms per poll cycle, compounding Candidate 2.
  - `_isRoomOlder` at `multiplayer.js:109-121` falls back to lexicographic `roomId` compare when `createdAt` is unresolved/non-finite. Since `_generateId("room")` builds IDs from `Date.now().toString(36)` + `Math.random().toString(36).slice(2, 8)` (`multiplayer.js:47-49`), two rooms created within the same millisecond compare on the random suffix — effectively arbitrary. Not a stuck-forever issue but a correctness smell.
- **Why this explains the symptom (partially):** If multiple test cycles leave orphans and clients cascade through flip-mode logic, clients can thrash "hosting...joining...hosting..." without converging on a successful join.
- **How to verify:** In DevTools Console (level: Verbose) filter on `[MP]` during a repro. The sequence of `"Switching to hosting mode"` / `"Switching to joining mode"` messages plus room IDs will show thrash if present.
- **Fix sketch (do not implement):** Revert to the linear prior-committed flow (`git show 450f824:multiplayer.js`): host once, listen, poll to join others, never flip back to joining after creating own room. Complexity of the flip logic exceeds its value over the simpler strategy.

### Candidate 4: Observability gap — errors are swallowed and info-logged — Confidence: High (as a confounder, not a root cause)

- **Evidence:**
  - All `_attemptJoin` call sites in `startMatchmaking` wrap the call in try/catch that `console.warn`s and proceeds (`multiplayer.js:290-297, 299-304, 306-313, 340-342`).
  - `_tryJoinWaitingRoom` swallows per-candidate failures with `console.info("[MP] Candidate transaction not committed", ...)` (`multiplayer.js:521-526`).
  - The scan query (`multiplayer.js:354-358`) has no local `.catch()`; if the promise rejects it propagates to `_attemptJoin`'s caller and is logged at `.warn`.
  - `cancelMatchmaking`'s cleanup errors are silently discarded (`multiplayer.js:587-589` `catch (_) {}`).
  - `MP.init` catches failures and only `console.warn`s (`multiplayer.js:79-83`); the Find Match button's `!MP.isAvailable()` branch alerts only if init returned false — not on later transient failures.
  - Downstream calls (`setupPresence`, `watchOpponentPresence`, `submitPrepData`) also swallow transient issues (`multiplayer.js:634-637, 721-727, 735-738`).
- **Why this matters:** Distinguishing Candidate 1 from Candidate 2 from Candidate 3 is impossible without DevTools Console at Verbose level, because most signal is `console.info` / `console.debug` and hidden at default filter levels.
- **Fix sketch (do not implement) — for future debuggability:** Upgrade critical failure paths from `.info`/`.debug` to `.warn`; wire transient errors to a user-visible status via `_updateMatchmakingStatus`; surface Firebase auth/database errors in the overlay instead of swallowing them.

## 5. Ruled out

- **RTDB security rules reject the list query.** User-confirmed deployed rules:
  ```json
  { "rules": { "rooms": {
      ".indexOn": ["status", "host"],
      ".read": "auth != null",
      "$roomId": { ".write": "auth != null" }
    } } }
  ```
  `.read: "auth != null"` at `rooms/` level correctly authorizes `db.ref("rooms").orderByChild("status").equalTo("waiting").once("value")`; `.indexOn` includes `status`. Permission-denied on the scan is not the cause.
- **Script load order.** `index.html:248-257` loads `script.js` → firebase-compat SDKs → `multiplayer.js` → `lobby.js`. `script.js` does not call `MP`/`Lobby` at top level; references are inside functions (e.g., `launchWave` at `script.js:1336-1341`). Ordering is functionally correct.
- **`Firebase SDK.ts` at repo root.** Not referenced by `index.html` (grep returned zero hits); modular-SDK template, not executed at runtime.
- **Firebase config mismatch.** `multiplayer.js:18-26` and `Firebase SDK.ts:9-17` share identical `apiKey`, `authDomain`, `projectId`, `appId`.
- **Capacitor/mobile interference.** User's repros are desktop-browser only; `multiplayer.js:102-107` uses Capacitor only for a display label, not networking.
- **WebSocket/firewall blocking.** `MP.init` succeeds — user reaches the "Searching for opponent" overlay, which only renders after `available=true` (`lobby.js:480-498`). Network reachability is fine.
- **Ready-state 45s timeout causes stuck-at-searching.** That timeout applies only after matchmaking succeeds; irrelevant to the pre-match symptom.
- **Clock skew between browsers.** Would require >90s drift to flip the `STALE_QUEUE_MS` filter; unusual on a single machine.
- **Firebase Anonymous Auth disabled in console.** Would make `MP.init` return false and disable the Find Match button with title "Online multiplayer unavailable" (`lobby.js:487-490`); user would not reach the "Searching" overlay at all.

## 6. Recommended next step

**Capture DevTools Console + Network output during a fresh repro. Without logs, root cause cannot be definitively identified.**

Procedure:

1. In both test clients, press **F12** → Console → set **Log Level** to **All levels** (check **Verbose**). Filter Console to `[MP]`.
2. Network tab → filter **WS**. Clear console and network panels.
3. Close all other game tabs and wait 2 minutes (lets `STALE_QUEUE_MS` clear any orphan rooms), or manually delete all `/rooms/*` entries in the Firebase Console Data tab for a clean baseline.
4. Click **Find Match** in both clients roughly simultaneously. Let them sit on "Searching" for ~30 seconds.
5. Capture and share, per client:
   - Full Console output (screenshot or text copy)
   - `/rooms` entries in Firebase Console after the test (screenshot of the Data tab)
   - Any red errors in Network → WS → `…firebaseio.com` connection → Messages
6. Also run `firebase.auth().currentUser?.uid` and `window.MP.getMyUid()` in each client's console after step 4 and share the four resulting UIDs.

Log patterns distinguish candidates:
- **Candidate 1 active:** both clients show `[MP] Ready. uid = X` initially, but later auth errors or UID mismatches between `auth.currentUser?.uid` and `window.MP.getMyUid()`.
- **Candidate 2 active:** `/rooms/` has `status:"waiting"` entries that persist after clients close; scans return them.
- **Candidate 3 active:** Console shows oscillating `"Switching to hosting mode"` / `"Switching to joining mode"` messages; multiple room-IDs created per client.
- **Candidate 4 active (most likely the shape):** one or more of the above patterns, plus the user hasn't been seeing the info-level messages that reveal them.

## 7. Open questions for the user

1. **Downstream symptom check:** once the overlay hides and a "match" begins, do you ever see a "Victory! Opponent left the match" screen ~45s into what should have been a real match? If yes, Candidate 2 is live (orphan-room bogus matches). If no, Candidate 2 is probably not active.
2. **Firebase Console access:** confirm you can view `/rooms` in the Realtime Database Data tab and see entries appear/disappear as you test. (Needed for Candidate 2 verification.)
3. **Clean-slate test:** have you tried a test where you manually deleted all `/rooms/*` entries immediately before both clients click Find Match? If the failure persists with a provably-empty starting `/rooms` and just two concurrent clients, Candidate 2 is ruled out too, and the problem is in-flight logic (Candidate 1 or 3).
4. **Uncommitted rewrite ownership:** the 552-insertion uncommitted diff in `multiplayer.js` was authored by a prior session that did not resolve the bug. Are you open to a diagnostic `git stash` + test of the simpler `450f824` version? If the simpler version also fails identically, the rewrite is not the cause; if it works, the cause is inside the rewrite.
