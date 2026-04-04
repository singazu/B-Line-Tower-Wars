# Bug Fix Reference

## Purpose
This document keeps a short record of important bug fixes and implementation learnings in `B-Line Tower Wars` so future work can reuse the context instead of rediscovering the same issues.

## How To Use
- Add one entry per bug or regression.
- Keep the format consistent.
- Focus on root cause, fix, and what to watch for next time.

## Entry Template
### Title
- Date:
- Area:
- Symptom:
- Root cause:
- Fix:
- Guardrail:
- Files:
- Notes:

## Logged Fixes

### End Banner Hidden Behind Towers
- Date: 2026-04-04
- Area: Match-end UI layering
- Symptom: The `you win` / `get fuxked` banner appeared underneath tower slot DOM elements.
- Root cause: The end banner was drawn on the canvas, but towers and slots are rendered as separate DOM elements above the canvas.
- Fix: Moved the match-end banner to a dedicated DOM overlay inside the arena container with a higher z-index.
- Guardrail: If a visual must appear above towers, it must be a DOM overlay, not a canvas-only draw pass.
- Files: `index.html`, `style.css`, `script.js`
- Notes: Round banners can still use canvas if they do not need to cover DOM elements.

### Replay Match Left Stale Battlefield Visuals
- Date: 2026-04-04
- Area: Replay/reset flow
- Symptom: Clicking `Replay Match` reset scores and state, but old projectile or range visuals could remain visible briefly on the battlefield.
- Root cause: Reset cleared state, but the canvas was not forced to redraw immediately, so the last rendered frame stayed visible until the next animation tick.
- Fix: Reset now refreshes the frame timer and forces an immediate `drawBoard()` after clearing state.
- Guardrail: Any hard reset that changes battlefield state should immediately redraw the canvas.
- Files: `script.js`
- Notes: This was easiest to reproduce when replay happened mid-battle.

### Projectile Kill Attribution Crash
- Date: 2026-04-04
- Area: Battle loop / stats tracking
- Symptom: The game could freeze or crash right when a projectile landed a killing blow.
- Root cause: Projectile kill-stat tracking expected `projectile.owner`, but the projectile object did not store the firing side.
- Fix: Added `owner` to projectile payloads when spawned and used that owner for tower kill attribution.
- Guardrail: If derived combat events need later attribution, store the attribution data on the event object at creation time.
- Files: `script.js`
- Notes: The visible symptom looked like battle getting stuck with a projectile still on screen.

### Tower Upgrades Applied To AI Towers
- Date: 2026-04-04
- Area: Upgrade system / shared constructors
- Symptom: Player tower upgrades also boosted AI towers of the same type.
- Root cause: `createTowerInstance()` always applied player tower upgrade multipliers, and AI drafting used the same constructor.
- Fix: Made tower creation owner-aware so only player tower instances receive player upgrade multipliers.
- Guardrail: Shared factory functions for player/AI units should always take explicit ownership context when behavior differs by side.
- Files: `script.js`
- Notes: Existing placed player towers are still upgraded intentionally when the player buys an upgrade.

### Skip-To-Battle Could Be Reused Unsafely
- Date: 2026-04-04
- Area: Prep flow / phase controls
- Symptom: A fast repeated click risked skipping more state than intended.
- Root cause: The skip button depended only on phase visibility and did not explicitly track whether the round had already consumed its skip.
- Fix: Added a once-per-round `battleSkipUsedThisRound` flag and reset it only when the next round banner begins.
- Guardrail: Any phase-skip control should have an explicit one-shot state flag, not just UI hiding.
- Files: `script.js`
- Notes: Prep time was also doubled to keep manual setup time reasonable now that skip exists.

### Persistent Stats Needed Stable Local Storage
- Date: 2026-04-04
- Area: Local telemetry / preview server
- Symptom: Aggregate stats needed to persist across runs and not pollute source control.
- Root cause: The game had no local persistence endpoint and no stable on-disk stats file.
- Fix: Added a `/stats` endpoint to the preview server, wrote aggregate stats to `match-stats.json`, and ignored that file in git.
- Guardrail: Local runtime telemetry should be written to an ignored project-local data file, not baked into source assets.
- Files: `preview.ps1`, `.gitignore`, `script.js`
- Notes: Stats also fall back to local storage if the endpoint is unavailable.

### Match Usage Stats Needed “Used At Least Once” Semantics
- Date: 2026-04-04
- Area: Persistent analytics
- Symptom: We needed to know whether a unit/tower was present in a winning match, not how many copies were played in that match.
- Root cause: Raw usage counts would overweight spammed choices and distort win-when-used analysis.
- Fix: Added per-match presence tracking for each tower and attacker type, then committed `used` and `winningTeamUsed` exactly once per type at match end.
- Guardrail: When the analysis goal is “win rate when used,” record presence-per-match, not quantity-per-match.
- Files: `script.js`, `preview.ps1`
- Notes: Draws count toward `used` but not `winningTeamUsed`.

## Future Notes
- If we add more analytics, prefer adding new fields to `match-stats.json` through normalization so old files still load safely.
- If we add more overlays, keep a clear rule for canvas-drawn visuals versus DOM overlays.
- If we add more shared player/AI factories, require explicit owner input up front.
