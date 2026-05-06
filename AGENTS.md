# Agent Guide: Brian Line Tower Wars

## Mission
Build a mobile-first lane-defense Production ready game where:
- The player drags towers into 5 player slots during Prep phase.
- The player queues attackers into the battlefield.
- The AI controls mirrored enemy slots and sends attackers.
- Rounds resolve in Battle phase with clear win/loss scoring.

## Current Reality
- `index.html` and `style.css` define a tower-wars UI shell.
- `script.js` still contains old clicker-game logic and must be replaced.
- Priority is to align game logic with the current DOM structure.

## Core Gameplay Loop (Target)
1. Prep phase starts with mana and timer.
2. Player drags towers to player slots.
3. Player queues attackers into battlefield lane(s).
4. AI places enemy towers and queues enemy attackers.
5. Battle phase runs simulation for a fixed duration.
6. Surviving/arriving units score for player or AI.
7. Wave ends, scores update, next wave begins.

## Data Model (Single Source of Truth)
Use one `gameState` object with:
- `wave`, `phase`, `phaseTimeLeft`
- `player`: `score`, `mana`, `towers[]`, `attackQueue[]`
- `ai`: `score`, `mana`, `towers[]`, `attackQueue[]`
- `battlefield`: active units/projectiles/effects
- `rules`: timers, mana gain, damage, move speed, win condition

Avoid scattered globals. UI should render from `gameState`.

## DOM Contract
Expected IDs in `index.html`:
- `player-score`, `ai-score`, `wave-number`
- `enemy-slots`, `player-slots`
- `tower-panel`, `attacker-panel`
- `arena-canvas`, `arena-drop-zone`
- `player-mana`, `phase-label`, `phase-timer`
- `wave-progress-fill`, `status-text`, `replay-btn`

All JS changes must use this contract unless HTML is intentionally updated.

## Implementation Plan
1. Replace old `script.js` with a small vertical slice:
   - initialize `gameState`
   - render scores, wave, mana, timers
   - render placeholder tower/attacker cards
   - basic drag-and-drop into valid slots
2. Add Prep/Battle phase timer state machine.
3. Add simple AI behavior (random valid placements).
4. Simulate one lane on canvas, then expand to full battlefield.
5. Add balancing constants and wave scaling.

## Engineering Rules
- Keep code plain JavaScript (no framework).
- Prefer pure helper functions for simulation math.
- Separate layers in `script.js` (state, rules, render, input, loop).
- Use constants for tuning values.
- Avoid magic numbers in update/render logic.

## Definition of Done for Each Change
- No console errors on load.
- Replay button resets to clean initial state.
- UI values stay in sync with `gameState`.
- Drag/drop interactions fail gracefully for invalid moves.
- Manual preview works with `preview.ps1`.

## Short-Term Backlog
- [ ] Rewrite `script.js` to match tower-wars UI.
- [ ] Implement phase machine (`prep` -> `battle` -> `prep`).
- [ ] Implement basic card generation for towers/attackers.
- [ ] Implement AI auto-placement and queueing.
- [ ] Draw active units on `arena-canvas`.
- [ ] Add wave progression and match-end condition.
