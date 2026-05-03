# Firebase PvP Round Sync

## Summary
PvP readiness must be scoped to a specific round. Shared room-level ready flags can be reset by one client finishing an earlier round after the other client has already submitted the next round, causing desyncs, timeouts, or bogus forfeits.

## Details
- Runtime files: `multiplayer.js` owns Firebase room/round data, and `lobby.js` coordinates prep/battle phases.
- Use `rooms/<roomId>/rounds/<waveNumber>/<role>Ready` for readiness, alongside the submitted prep payload for the same wave.
- Avoid resetting shared `rooms/<roomId>/hostReady` or `guestReady` after battle completion; those flags are not safe for multi-round state.
- Waiting-room claims should be transactional so a stale or already-claimed room cannot be overwritten by a later join attempt.

## Resolution
- `submitPrepData` now writes per-round ready flags.
- `listenForBothReady` listens to the current round node.
- `completeBattle` no longer clears shared room-level ready flags.
- Joining a waiting room now uses a Firebase transaction conditioned on `status === "waiting"` and no existing guest.
