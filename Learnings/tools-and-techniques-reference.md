# Tools And Techniques Reference

## Purpose
This document records the main tools, supporting scripts, and implementation techniques currently used in `B-Line Tower Wars`.

It covers both:
- technical tools: scripts, local server behavior, runtime assets, browser workflows, persistence paths
- conceptual tools: coding patterns, debugging habits, UI layering rules, and gameplay-state techniques

## How To Use
- Update this when we add a new meaningful workflow or pattern.
- Prefer short, practical notes over exhaustive documentation.
- Treat this as a working reference for future implementation and debugging.

## Technical Tools

### Browser Runtime Stack
- HTML shell: `index.html`
- Styling: `style.css`
- Gameplay/runtime logic: `script.js`
- Rendering model:
  - Canvas is used for battlefield rendering, projectiles, effects, lane visuals, and round banners.
  - DOM is used for towers, slots, overlays, controls, and shop UI.
- Why it matters:
  - This project is not framework-driven.
  - UI and battle logic are tightly coupled to the current DOM IDs and canvas draw order.

### Local Preview Server
- File: `preview.ps1`
- Role:
  - Serves the game locally over HTTP.
  - Resolves static assets.
  - Exposes `/stats` for persistent local telemetry.
  - Writes `match-stats.json` in the project root.
- Why it matters:
  - The game should be run through the preview server, not directly from the filesystem.
  - Local persistence depends on this server path.

### Shared Game Launcher
- Files:
  - `open-game.ps1`
  - `run-game.bat`
- Role:
  - `open-game.ps1` is the canonical launcher.
  - It finds an open port, starts the preview server, waits for readiness, and opens the game in the default browser.
  - `run-game.bat` is just the executable-style wrapper around that same launcher.
- Why it matters:
  - There are two entry points, but they share one actual pipeline.
  - Future launch behavior changes should go into `open-game.ps1`, not duplicated elsewhere.

### Persistent Local Stats
- Files:
  - `match-stats.json`
  - `.gitignore`
- Role:
  - Stores aggregate gameplay telemetry across runs.
  - Tracks unit scores, tower kills, and per-match “used” / “used on winning team” counters.
- Why it matters:
  - Analytics survive across sessions.
  - The file is ignored in git because it is runtime data, not source.

### Asset Pipeline
- Runtime assets:
  - `assets/towers/`
  - `assets/creeps/`
  - `assets/ui/`
- Working/source art:
  - `bri assets/`
- Role:
  - `assets/` contains the actual runtime images used by the game.
  - `bri assets/` appears to hold source or working art files and references.
- Why it matters:
  - Runtime code should reference `assets/`.
  - `bri assets/` is useful for future art swaps, but should not be assumed to be live runtime content.

### Deployment Workflow
- File: `.github/workflows/deploy-pages.yml`
- Role:
  - Deploys the static site to GitHub Pages on pushes to `main`.
- Why it matters:
  - Local changes on feature/personal branches are not automatically live.
  - Deployment behavior is static-site oriented with no build step.

### Validation Tooling
- Headless Chrome
- Local browser smoke tests
- `node --check script.js`
- Role:
  - Used to validate load behavior, phase transitions, shop interactions, and crash fixes.
  - `node --check` is used as a fast syntax guard for `script.js`.
- Why it matters:
  - This project benefits from repeatable interaction checks, not just visual inspection.

## Conceptual Tools And Techniques

### Phase-State Machine
- Main idea:
  - The game is structured around explicit phases:
    - `banner`
    - `prep`
    - `battle`
    - `shop`
    - `gameover`
- Why it matters:
  - Most UI visibility, button behavior, and update-loop decisions should be phase-gated.
  - When adding features, phase ownership should be clarified first.

### Shared State As The Source Of Truth
- Main idea:
  - `state` in `script.js` is the central source of truth for gameplay, UI flow, and match progression.
- Why it matters:
  - UI should be refreshed from state rather than carrying hidden parallel state in DOM only.
  - Bugs are easier to fix when every feature has a clear state representation.

### Owner-Aware Factories
- Main idea:
  - Shared creation paths for towers, attackers, and projectiles must include explicit ownership context.
- Why it matters:
  - Player-only upgrades should never leak into AI content.
  - Kill attribution and analytics should not rely on reconstructing ownership later.

### DOM Overlay vs Canvas Rule
- Main idea:
  - Use canvas for battlefield visuals.
  - Use DOM overlays for anything that must appear above towers, slots, or controls.
- Why it matters:
  - Towers and slots are DOM elements layered above the canvas.
  - If something must fully cover towers, it cannot be canvas-only.

### Immediate Reset Redraw
- Main idea:
  - A hard reset should force an immediate redraw after clearing state.
- Why it matters:
  - Canvas can otherwise show stale visuals from the previous frame.
  - Replay/reset bugs tend to look like “state is reset but battlefield still looks wrong.”

### One-Shot Control Guardrails
- Main idea:
  - Controls that skip time or phases should use explicit one-use flags, not only visibility or button disabling.
- Example:
  - `battleSkipUsedThisRound`
- Why it matters:
  - Prevents accidental double-triggering.
  - Makes the rules of the control easier to reason about.

### Per-Match Presence Tracking
- Main idea:
  - Some analytics should track whether a type was used at all in a match, not how many copies were used.
- Why it matters:
  - This is the right technique for “win rate when used.”
  - It avoids overstating spammed units or towers.

### Progressive Telemetry Design
- Main idea:
  - Stats are normalized when loaded so new fields can be added without breaking old files.
- Why it matters:
  - We can evolve `match-stats.json` over time.
  - Older local stats files remain usable.

### Shared Launcher Path
- Main idea:
  - Different user entry points should converge into one canonical launch script.
- Why it matters:
  - Keeps behavior consistent.
  - Reduces drift between “open here” and executable-style launching.

### Targeted Smoke Testing
- Main idea:
  - Reproduce issues in the smallest realistic scenario possible, then verify the fixed state directly.
- Examples:
  - forcing a projectile kill moment
  - forcing replay mid-battle
  - forcing a shop state and buying upgrades
- Why it matters:
  - Faster than full manual playthroughs for every bug.
  - Especially useful in a browser game with a single large runtime file.

## Current Gameplay-Specific Systems In Use

### Match Structure
- Three-round match
- Round banners before each round
- Between-round shop
- Winner determined by score after round 3

### Upgrade System
- Unit upgrades:
  - Cost `3`
  - Increase HP and speed by 10%
  - Player-only
- Tower upgrades:
  - Cost `5`
  - Increase damage and range by 20%
  - Improve fire rate by 20%
  - Can be bought twice, up to level 3
  - Player-only

### Analytics Currently Captured
- Unit score totals
- Tower kill totals
- Match usage presence
- Winning-team usage presence

## File Map For These Tools
- Runtime entry: `index.html`
- Main logic: `script.js`
- Styling: `style.css`
- Preview server: `preview.ps1`
- Shared launcher: `open-game.ps1`
- Executable-style launcher: `run-game.bat`
- Persistent stats file: `match-stats.json`
- Learnings docs: `Learnings/`

## Future Additions Worth Tracking Here
- If we add real audio assets instead of generated audio
- If we add a proper balance import pipeline from CSV into runtime
- If we add more persistent telemetry or summaries
- If we split `script.js` into smaller modules
