// Tower Wars headless AI-vs-AI batch runner.
// Drives www/ unmodified: serves it locally, opens it in headless Chromium,
// disables the natural rAF loop, and ticks updateGame() manually for both sides.
// Per-match data is captured by wrapping window.applyProjectileDamage and
// window.recordTowerKill (both are top-level function declarations in script.js
// so reassignment redirects internal callers).
//
// Usage:
//   cd harness
//   npm install
//   npx playwright install chromium
//   node run.js --games 100
//
// Flags:
//   --games N     number of matches to run (default 100)
//   --headed 1    show the browser window (default headless)
//   --out DIR     output directory (default ./out)

import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WWW_DIR = path.resolve(__dirname, "..", "www");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i++; }
    else out[key] = "1";
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const N_GAMES = parseInt(args.games || "100", 10);
const HEADLESS = args.headed !== "1";
const OUT_DIR = path.resolve(__dirname, args.out || "out");

// Strategies: comma-separated list of strategy IDs. Each pair (A controls
// player, B controls AI) plays gamesPerMatchup matches.
//   --strategies default,rush,turtle  (3 strategies → 9 ordered pairs)
//   --strategies all                  (every registered strategy)
//   --games-per-matchup N             (default: 50 if multiple strategies,
//                                      else N_GAMES for single-strategy compat)
const STRATEGIES_ARG = args.strategies || "";
const GAMES_PER_MATCHUP = parseInt(args["games-per-matchup"] || "0", 10);
const LIST_STRATEGIES = args["list-strategies"] === "1";
// --matchup-only: skip per-match JSONL/CSV emission. Only writes
// matchup-matrix.csv and strategy-summary.csv. Required for big-N runs to
// avoid OOM (full per-match payload is ~130KB; multiplied by N matches).
const MATCHUP_ONLY = args["matchup-only"] === "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ico": "image/x-icon",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
        const safe = path.normalize(reqPath).replace(/^[\\/]+/, "");
        const fp = safe === "" ? path.join(WWW_DIR, "index.html") : path.join(WWW_DIR, safe);
        if (!fp.startsWith(WWW_DIR)) { res.writeHead(403); res.end(); return; }
        const data = await fs.readFile(fp);
        const ext = path.extname(fp).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      } catch (e) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end(String(e && e.message ? e.message : e));
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

// Runs in page context BEFORE any of the page's own scripts execute.
// Kills the natural game loop and any persisted match state.
const PAGE_PRELUDE = `(() => {
  window.requestAnimationFrame = function () { return 0; };
  window.cancelAnimationFrame = function () { return undefined; };
  try { localStorage.clear(); } catch (e) {}
  window.__rngSeq = 0;
})();`;

// Runs in page context AFTER script.js (and lobby.js) have defined globals.
// Installs damage/kill wrappers and a single runOneMatch() driver.
function INSTALL_HARNESS() {
  // towerDefs/attackerDefs are top-level `const`, only reachable as bare
  // identifiers (lexical scope), not via `window.*`.
  const TOWER_IDS = towerDefs.map(t => t.id);
  const ATTACKER_IDS = attackerDefs.map(a => a.id);
  const zero = (ids) => Object.fromEntries(ids.map(id => [id, 0]));

  const zeroMatrix = () => Object.fromEntries(TOWER_IDS.map(t => [t, zero(ATTACKER_IDS)]));

  const counters = {
    // Per (side, towerId)
    damage: { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    hits:   { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    kills:  { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    shots:  { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },

    // Per (side, attackerId)
    queued:   { player: zero(ATTACKER_IDS), ai: zero(ATTACKER_IDS) },
    spawned:  { player: zero(ATTACKER_IDS), ai: zero(ATTACKER_IDS) },
    // killed_AS — number of attackers OF THIS TYPE that died (per attacker's owner)
    killedAS: { player: zero(ATTACKER_IDS), ai: zero(ATTACKER_IDS) },
    // damageTakenAS — total damage absorbed by attackers OF THIS TYPE (per attacker's owner)
    damageTakenAS: { player: zero(ATTACKER_IDS), ai: zero(ATTACKER_IDS) },

    // Tower × Attacker matrix per attacking-tower's-owner. matrix[side][towerId][attackerId]
    matrixDamage: { player: zeroMatrix(), ai: zeroMatrix() },
    matrixHits:   { player: zeroMatrix(), ai: zeroMatrix() },
    matrixKills:  { player: zeroMatrix(), ai: zeroMatrix() },

    // Mana economy per side
    manaSpentTowers:    { player: 0, ai: 0 },
    manaSpentAttackers: { player: 0, ai: 0 },
    manaSpentShopT:     { player: 0, ai: 0 },
    manaSpentShopA:     { player: 0, ai: 0 },
    manaFromKills:      { player: 0, ai: 0 },
    manaWastedToCap:    { player: 0, ai: 0 },

    // Status-effect utility totals.
    // - slowSecondsApplied: total `appliedSlow` seconds across all yellow hits
    //   (overlapping slows are double-counted; a proxy for slow utility).
    // - poisonTicks: number of poison-tick events from green attributed to this owner.
    // - poisonDamage: total DOT damage applied via poison ticks (separate from
    //   green's initial-hit damage, which is already in counters.damage.green).
    slowSecondsApplied: { player: 0, ai: 0 },
    poisonTicks:        { player: 0, ai: 0 },
    poisonDamage:       { player: 0, ai: 0 },

    // Shop activity
    shopTowerUpgrades:    { player: zero(TOWER_IDS),    ai: zero(TOWER_IDS) },
    shopAttackerUpgrades: { player: zero(ATTACKER_IDS), ai: zero(ATTACKER_IDS) },

    // Tower placement counts (every createTowerInstance call counts as one
    // placement; placements at level > 1 are also counted as upgradesInPrep).
    towersPlaced:         { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    towersUpgradedInPrep: { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },

    // Per-round breakdown (filled out at end of each battle)
    rounds: [],
  };

  // Round-scoped counters (reset at the start of each prep, snapshotted at end
  // of each battle into counters.rounds). Mirrors a subset of the per-match
  // counters above.
  const round = {
    number: 0,
    battleStartTick: 0,
    battleEndTick: 0,
    // by side
    damage: { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    hits:   { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    kills:  { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    shots:  { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    queued: { player: zero(ATTACKER_IDS), ai: zero(ATTACKER_IDS) },
    killedAS: { player: zero(ATTACKER_IDS), ai: zero(ATTACKER_IDS) },
    spawned:  { player: zero(ATTACKER_IDS), ai: zero(ATTACKER_IDS) },
    manaPreDraft:      { player: 0, ai: 0 },
    manaPostDraft:     { player: 0, ai: 0 },
    manaPostShop:      { player: 0, ai: 0 },
    manaSpentTowers:   { player: 0, ai: 0 },
    manaSpentAttackers:{ player: 0, ai: 0 },
    manaSpentShopT:    { player: 0, ai: 0 },
    manaSpentShopA:    { player: 0, ai: 0 },
    manaFromKills:     { player: 0, ai: 0 },
    manaWastedToCap:   { player: 0, ai: 0 },
    towersPlaced:      { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    shopTowerUpgrades: { player: zero(TOWER_IDS), ai: zero(TOWER_IDS) },
    shopAttackerUpgrades: { player: zero(ATTACKER_IDS), ai: zero(ATTACKER_IDS) },
    scoreAtStart:  { player: 0, ai: 0 },
    scoreAtEnd:    { player: 0, ai: 0 },
  };

  function resetRound(roundNumber, currentTick) {
    round.number = roundNumber;
    round.battleStartTick = 0;
    round.battleEndTick = 0;
    for (const id of TOWER_IDS) {
      round.damage.player[id] = 0; round.damage.ai[id] = 0;
      round.hits.player[id]   = 0; round.hits.ai[id]   = 0;
      round.kills.player[id]  = 0; round.kills.ai[id]  = 0;
      round.shots.player[id]  = 0; round.shots.ai[id]  = 0;
      round.towersPlaced.player[id] = 0; round.towersPlaced.ai[id] = 0;
      round.shopTowerUpgrades.player[id] = 0; round.shopTowerUpgrades.ai[id] = 0;
    }
    for (const id of ATTACKER_IDS) {
      round.queued.player[id]   = 0; round.queued.ai[id]   = 0;
      round.killedAS.player[id] = 0; round.killedAS.ai[id] = 0;
      round.spawned.player[id]  = 0; round.spawned.ai[id]  = 0;
      round.shopAttackerUpgrades.player[id] = 0;
      round.shopAttackerUpgrades.ai[id]     = 0;
    }
    round.manaPreDraft.player = state.playerMana;
    round.manaPreDraft.ai     = state.aiMana;
    round.manaPostDraft.player = 0; round.manaPostDraft.ai = 0;
    round.manaPostShop.player  = 0; round.manaPostShop.ai  = 0;
    round.manaSpentTowers.player = 0; round.manaSpentTowers.ai = 0;
    round.manaSpentAttackers.player = 0; round.manaSpentAttackers.ai = 0;
    round.manaSpentShopT.player = 0; round.manaSpentShopT.ai = 0;
    round.manaSpentShopA.player = 0; round.manaSpentShopA.ai = 0;
    round.manaFromKills.player = 0; round.manaFromKills.ai = 0;
    round.manaWastedToCap.player = 0; round.manaWastedToCap.ai = 0;
    round.scoreAtStart.player = state.playerScore;
    round.scoreAtStart.ai     = state.aiScore;
    round.scoreAtEnd.player = 0; round.scoreAtEnd.ai = 0;
  }

  function snapshotRound() {
    round.scoreAtEnd.player = state.playerScore;
    round.scoreAtEnd.ai     = state.aiScore;
    counters.rounds.push({
      round: round.number,
      battleTicks: Math.max(0, round.battleEndTick - round.battleStartTick),
      player: {
        manaPreDraft:  round.manaPreDraft.player,
        manaPostDraft: round.manaPostDraft.player,
        manaPostShop:  round.manaPostShop.player,
        manaSpentTowers:    round.manaSpentTowers.player,
        manaSpentAttackers: round.manaSpentAttackers.player,
        manaSpentShopT:     round.manaSpentShopT.player,
        manaSpentShopA:     round.manaSpentShopA.player,
        manaFromKills:      round.manaFromKills.player,
        manaWastedToCap:    round.manaWastedToCap.player,
        damage: { ...round.damage.player },
        hits:   { ...round.hits.player },
        kills:  { ...round.kills.player },
        shots:  { ...round.shots.player },
        queued:   { ...round.queued.player },
        spawned:  { ...round.spawned.player },
        killedAS: { ...round.killedAS.player },
        towersPlaced:         { ...round.towersPlaced.player },
        shopTowerUpgrades:    { ...round.shopTowerUpgrades.player },
        shopAttackerUpgrades: { ...round.shopAttackerUpgrades.player },
        scoreDelta: round.scoreAtEnd.player - round.scoreAtStart.player,
      },
      ai: {
        manaPreDraft:  round.manaPreDraft.ai,
        manaPostDraft: round.manaPostDraft.ai,
        manaPostShop:  round.manaPostShop.ai,
        manaSpentTowers:    round.manaSpentTowers.ai,
        manaSpentAttackers: round.manaSpentAttackers.ai,
        manaSpentShopT:     round.manaSpentShopT.ai,
        manaSpentShopA:     round.manaSpentShopA.ai,
        manaFromKills:      round.manaFromKills.ai,
        manaWastedToCap:    round.manaWastedToCap.ai,
        damage: { ...round.damage.ai },
        hits:   { ...round.hits.ai },
        kills:  { ...round.kills.ai },
        shots:  { ...round.shots.ai },
        queued:   { ...round.queued.ai },
        spawned:  { ...round.spawned.ai },
        killedAS: { ...round.killedAS.ai },
        towersPlaced:         { ...round.towersPlaced.ai },
        shopTowerUpgrades:    { ...round.shopTowerUpgrades.ai },
        shopAttackerUpgrades: { ...round.shopAttackerUpgrades.ai },
        scoreDelta: round.scoreAtEnd.ai - round.scoreAtStart.ai,
      },
    });
  }

  // Per-match shop-upgrade counters for the AI side. The game's `state` only
  // tracks player-side shop upgrades (state.playerTowerUpgrades /
  // state.playerAttackerUpgrades) — the harness keeps a parallel pair for AI.
  const aiUpgrades = {
    towers:    zero(TOWER_IDS),
    attackers: zero(ATTACKER_IDS),
  };

  function resetCounters() {
    for (const id of TOWER_IDS) {
      counters.damage.player[id] = 0; counters.damage.ai[id] = 0;
      counters.hits.player[id]   = 0; counters.hits.ai[id]   = 0;
      counters.kills.player[id]  = 0; counters.kills.ai[id]  = 0;
      counters.shots.player[id]  = 0; counters.shots.ai[id]  = 0;
      counters.shopTowerUpgrades.player[id] = 0;
      counters.shopTowerUpgrades.ai[id]     = 0;
      counters.towersPlaced.player[id]         = 0; counters.towersPlaced.ai[id]         = 0;
      counters.towersUpgradedInPrep.player[id] = 0; counters.towersUpgradedInPrep.ai[id] = 0;
      aiUpgrades.towers[id] = 0;
      for (const aid of ATTACKER_IDS) {
        counters.matrixDamage.player[id][aid] = 0;
        counters.matrixDamage.ai[id][aid]     = 0;
        counters.matrixHits.player[id][aid]   = 0;
        counters.matrixHits.ai[id][aid]       = 0;
        counters.matrixKills.player[id][aid]  = 0;
        counters.matrixKills.ai[id][aid]      = 0;
      }
    }
    for (const id of ATTACKER_IDS) {
      counters.queued.player[id]   = 0; counters.queued.ai[id]   = 0;
      counters.spawned.player[id]  = 0; counters.spawned.ai[id]  = 0;
      counters.killedAS.player[id] = 0; counters.killedAS.ai[id] = 0;
      counters.damageTakenAS.player[id] = 0; counters.damageTakenAS.ai[id] = 0;
      counters.shopAttackerUpgrades.player[id] = 0;
      counters.shopAttackerUpgrades.ai[id]     = 0;
      aiUpgrades.attackers[id] = 0;
    }
    for (const side of ["player", "ai"]) {
      counters.manaSpentTowers[side]    = 0;
      counters.manaSpentAttackers[side] = 0;
      counters.manaSpentShopT[side]     = 0;
      counters.manaSpentShopA[side]     = 0;
      counters.manaFromKills[side]      = 0;
      counters.manaWastedToCap[side]    = 0;
      counters.slowSecondsApplied[side] = 0;
      counters.poisonTicks[side]        = 0;
      counters.poisonDamage[side]       = 0;
    }
    counters.rounds.length = 0;
  }

  const _origDamage = window.applyProjectileDamage;
  window.applyProjectileDamage = function (target, damage, towerId, owner, allowAoe, slowDurationForHit) {
    if (target && !target.isDefeated && damage > 0
        && counters.damage[owner] && (towerId in counters.damage[owner])) {
      const useful = Math.min(target.hp, damage);
      const aid = target.defId;
      const targetOwner = target.owner;
      counters.damage[owner][towerId] += useful;
      counters.hits[owner][towerId]   += 1;
      round.damage[owner][towerId]    += useful;
      round.hits[owner][towerId]      += 1;
      if (aid && (aid in counters.matrixDamage[owner][towerId])) {
        counters.matrixDamage[owner][towerId][aid] += useful;
        counters.matrixHits[owner][towerId][aid]   += 1;
      }
      if (aid && targetOwner && counters.damageTakenAS[targetOwner] && (aid in counters.damageTakenAS[targetOwner])) {
        counters.damageTakenAS[targetOwner][aid] += useful;
      }
      // Yellow's slow utility: capture the slow seconds applied by this hit.
      // Note: in-game uses Math.max(target.slowTimer, appliedSlow), so
      // overlapping slows on the same target double-count here. This is a
      // utility proxy, not a precise "effective slow time."
      if (towerId === "yellow") {
        const appliedSlow = Number.isFinite(slowDurationForHit) ? slowDurationForHit : 1.2;
        counters.slowSecondsApplied[owner] += appliedSlow;
      }
      // Death attribution: if this hit kills the target, log who the
      // attacker was (defId + owner) and which tower type killed it.
      if (target.hp - damage <= 0) {
        if (aid && targetOwner && counters.killedAS[targetOwner] && (aid in counters.killedAS[targetOwner])) {
          counters.killedAS[targetOwner][aid] += 1;
          round.killedAS[targetOwner][aid]    += 1;
        }
        if (aid && (aid in counters.matrixKills[owner][towerId])) {
          counters.matrixKills[owner][towerId][aid] += 1;
        }
      }
    }
    return _origDamage.apply(this, arguments);
  };

  // Poison-tick callback. Invoked from updateAttackers after each DOT tick.
  // Attributes the tick damage to the green tower's owner (poisonSourceOwner)
  // so green's damage counter reflects the full poison contribution, not just
  // the initial impact hit.
  window.__harnessOnPoisonTick = function (unit, dotDamage) {
    if (!unit || !(dotDamage > 0)) return;
    const owner = unit.poisonSourceOwner;
    const targetOwner = unit.owner;
    const aid = unit.defId;
    if (!owner || !counters.damage[owner]) return;
    counters.damage[owner].green += dotDamage;
    round.damage[owner].green    += dotDamage;
    counters.poisonTicks[owner]  += 1;
    counters.poisonDamage[owner] += dotDamage;
    if (aid && counters.matrixDamage[owner].green && (aid in counters.matrixDamage[owner].green)) {
      counters.matrixDamage[owner].green[aid] += dotDamage;
    }
    if (aid && targetOwner && counters.damageTakenAS[targetOwner] && (aid in counters.damageTakenAS[targetOwner])) {
      counters.damageTakenAS[targetOwner][aid] += dotDamage;
    }
  };

  const _origKill = window.recordTowerKill;
  window.recordTowerKill = function (towerId, owner) {
    if (counters.kills[owner] && (towerId in counters.kills[owner])) {
      counters.kills[owner][towerId] += 1;
      round.kills[owner][towerId]    += 1;
    }
    return _origKill.apply(this, arguments);
  };

  // Track shots fired per (side, towerId).
  const _origSpawnProjectile = window.spawnProjectile;
  window.spawnProjectile = function (fromPos, target, damage, color, towerId, owner) {
    if (counters.shots[owner] && (towerId in counters.shots[owner])) {
      counters.shots[owner][towerId] += 1;
      round.shots[owner][towerId]    += 1;
    }
    return _origSpawnProjectile.apply(this, arguments);
  };

  // Track mana from kill bonuses (and waste when clamped at MANA_CAP).
  const _origGrant = window.grantRoundManaBonus;
  window.grantRoundManaBonus = function (owner, amount) {
    const want = (typeof amount === "number") ? amount : 1;
    const before = owner === "player" ? state.playerMana : state.aiMana;
    const result = _origGrant.apply(this, arguments);
    const after = owner === "player" ? state.playerMana : state.aiMana;
    const granted = after - before;
    if (counters.manaFromKills[owner] !== undefined) {
      counters.manaFromKills[owner] += granted;
      round.manaFromKills[owner]    += granted;
      const waste = Math.max(0, want - granted);
      counters.manaWastedToCap[owner] += waste;
      round.manaWastedToCap[owner]    += waste;
    }
    return result;
  };

  // Tracks whether we're currently inside mirrorPlayerDraft. While true, any
  // call into prepareAIMoves passes owner="ai" (hardcoded by the game), but
  // the placement actually goes onto the PLAYER's side via the swapped state
  // arrays. We need to (a) attribute counters under "player", (b) read
  // player-side shop upgrades inside the original createTowerInstance.
  let inMirrorDraft = false;

  // Tracks whether we're inside pickBestAITowerPlacement. That function calls
  // createTowerInstance ~25 times per evaluation just to read towerPowerScore
  // off candidate towers — the results are discarded, not placed. Without this
  // flag, every candidate inflates the placement counter ~25x per real
  // placement.
  let inSpeculativeEval = false;
  const _origPickBest = window.pickBestAITowerPlacement;
  window.pickBestAITowerPlacement = function () {
    inSpeculativeEval = true;
    try {
      return _origPickBest.apply(this, arguments);
    } finally {
      inSpeculativeEval = false;
    }
  };

  // Wrap createTowerInstance to (a) apply AI-side shop upgrades on creation
  // (the game's native code only does this for owner="player") and (b) re-tag
  // mirror-draft placements as "player" so counters and player-side upgrades
  // stay accurate.
  const _origCreateTowerInstance = window.createTowerInstance;
  window.createTowerInstance = function (def, owner, level) {
    const effectiveOwner = (inMirrorDraft && owner === "ai") ? "player" : owner;
    // Pass effectiveOwner to the original so it reads the right shop multiplier
    // (state.playerTowerUpgrades for "player", multiplier-of-1 for "ai").
    const tower = _origCreateTowerInstance.call(this, def, effectiveOwner, level);
    // Skip counter bookkeeping during pickBestAITowerPlacement — those calls
    // are speculative scoring, not real placements.
    if (!inSpeculativeEval && def && def.id && counters.towersPlaced[effectiveOwner] && (def.id in counters.towersPlaced[effectiveOwner])) {
      counters.towersPlaced[effectiveOwner][def.id] += 1;
      round.towersPlaced[effectiveOwner][def.id]    += 1;
      counters.manaSpentTowers[effectiveOwner] += def.cost || 0;
      round.manaSpentTowers[effectiveOwner]    += def.cost || 0;
      if (typeof level === "number" && level > 1) {
        counters.towersUpgradedInPrep[effectiveOwner][def.id] += 1;
      }
    }
    if (effectiveOwner === "ai" && tower) {
      const ups = aiUpgrades.towers[def && def.id] || 0;
      if (ups > 0) {
        const mult = Math.pow(TOWER_UPGRADE_MULTIPLIER, ups);
        tower.damage   *= mult;
        tower.range    *= mult;
        tower.fireRate /= mult;
      }
    }
    return tower;
  };

  // Wrap makeAttacker so that AI-side attackers receive their shop-attacker
  // upgrade multiplier on spawn. Player side does this natively via
  // state.playerAttackerUpgrades.
  const _origMakeAttacker = window.makeAttacker;
  window.makeAttacker = function (owner, attackerId) {
    const unit = _origMakeAttacker.apply(this, arguments);
    if (counters.spawned[owner] && (attackerId in counters.spawned[owner])) {
      counters.spawned[owner][attackerId] += 1;
      round.spawned[owner][attackerId]    += 1;
    }
    if (owner === "ai" && unit) {
      const ups = aiUpgrades.attackers[attackerId] || 0;
      if (ups > 0) {
        const mult = Math.pow(ATTACKER_UPGRADE_MULTIPLIER, ups);
        unit.hp        *= mult;
        unit.maxHp     *= mult;
        unit.speed     *= mult;
        unit.baseSpeed *= mult;
      }
    }
    return unit;
  };

  // Snapshot opponent towers BEFORE either side drafts, so the player's
  // mirrored draft sees the AI's PRE-round towers (not the just-placed ones).
  // Without this, the player's heuristic reads inflated opponent defense and
  // over-invests in towers, while the AI sees stale (lower) opponent defense
  // and over-invests in cheap rush attackers — gives AI a systematic edge.
  // beginPrepPhase calls prepareAIMoves for the AI side internally, so we
  // snapshot just before that call.
  const preDraftSnapshot = { ai: null, player: null };
  const _origBeginPrep = window.beginPrepPhase;
  window.beginPrepPhase = function () {
    preDraftSnapshot.ai     = state.aiTowers.slice();
    preDraftSnapshot.player = state.playerTowers.slice();
    return _origBeginPrep.apply(this, arguments);
  };

  // Parity fix: the original openRoundShop adds AI_MANA_BONUS_PER_ROUND (=3)
  // to state.aiMana on top of the shared `gain`. For AI-vs-AI balance runs
  // we need both sides on equal mana. Wrap the function: snapshot aiMana
  // before, let it run, then re-set aiMana to what it would have been
  // without the bonus (using the same clamp and gain formula). `clamp` and
  // `MANA_CAP` are bare-identifier-reachable via lexical scope.
  const _origOpenRoundShop = window.openRoundShop;
  window.openRoundShop = function () {
    const playerBefore = state.playerMana;
    const aiBefore     = state.aiMana;
    const result = _origOpenRoundShop.apply(this, arguments);
    const gain = 9 + (state.waveNumber - 1);
    // Re-set aiMana to remove the AI bonus.
    state.aiMana = clamp(aiBefore + gain, 0, MANA_CAP);
    // Round-end gain → mana waste = wanted - actually-applied.
    const playerWaste = Math.max(0, gain - (state.playerMana - playerBefore));
    const aiWaste     = Math.max(0, gain - (state.aiMana - aiBefore));
    counters.manaWastedToCap.player += playerWaste;
    counters.manaWastedToCap.ai     += aiWaste;
    return result;
  };

  function snapshotTowers(arr) {
    return arr.map(t => t ? { id: t.id, level: t.level } : null);
  }

  // Attacker cost lookup — used to attribute mana-spent-on-attackers when
  // tallying drafted queues. (Mana was deducted earlier inside prepareAIMoves;
  // we just reproduce the bookkeeping for analysis.)
  const ATTACKER_COST = Object.fromEntries(attackerDefs.map(a => [a.id, a.cost || 0]));

  function tallyQueue(queue, ownerKey) {
    for (const id of queue) {
      if (id in counters.queued[ownerKey]) {
        counters.queued[ownerKey][id] += 1;
        round.queued[ownerKey][id]    += 1;
        const cost = ATTACKER_COST[id] || 0;
        counters.manaSpentAttackers[ownerKey] += cost;
        round.manaSpentAttackers[ownerKey]    += cost;
      }
    }
  }

  // Reserve mana the side wants to keep for next round's draft, by upgrade type.
  const TOWER_UPGRADE_RESERVE    = 7; // leave at least one cheap tower's worth of mana
  const ATTACKER_UPGRADE_RESERVE = 5;

  // Per-side shop decision, run once per prep phase after both drafts are done.
  // Same rule for both sides for parity. Picks at most one tower upgrade and
  // one attacker upgrade per round.
  function harnessShopRound(side) {
    const isPlayer = side === "player";
    const towers      = isPlayer ? state.playerTowers           : state.aiTowers;
    const upTowers    = isPlayer ? state.playerTowerUpgrades    : aiUpgrades.towers;
    const upAttackers = isPlayer ? state.playerAttackerUpgrades : aiUpgrades.attackers;

    // ---- one tower upgrade per round ----
    let mana = isPlayer ? state.playerMana : state.aiMana;
    if (mana >= TOWER_UPGRADE_COST + TOWER_UPGRADE_RESERVE) {
      const placedCounts = {};
      for (const t of towers) if (t) placedCounts[t.id] = (placedCounts[t.id] || 0) + 1;
      const eligible = Object.keys(placedCounts).filter(id => (upTowers[id] || 0) < MAX_TOWER_UPGRADES);
      if (eligible.length > 0) {
        const dmg = counters.damage[side];
        eligible.sort((a, b) => {
          const dd = (dmg[b] || 0) - (dmg[a] || 0);
          if (dd !== 0) return dd;
          return (placedCounts[b] || 0) - (placedCounts[a] || 0);
        });
        const chosen = eligible[0];
        mana -= TOWER_UPGRADE_COST;
        if (isPlayer) {
          state.playerMana = mana;
          state.playerTowerUpgrades[chosen] = (state.playerTowerUpgrades[chosen] || 0) + 1;
          applyTowerUpgradeToPlacedTowers(chosen);
        } else {
          state.aiMana = mana;
          aiUpgrades.towers[chosen] = (aiUpgrades.towers[chosen] || 0) + 1;
          for (const t of state.aiTowers) {
            if (t && t.id === chosen) {
              t.damage   *= TOWER_UPGRADE_MULTIPLIER;
              t.range    *= TOWER_UPGRADE_MULTIPLIER;
              t.fireRate /= TOWER_UPGRADE_MULTIPLIER;
            }
          }
        }
        counters.shopTowerUpgrades[side][chosen] += 1;
        round.shopTowerUpgrades[side][chosen]    += 1;
        counters.manaSpentShopT[side] += TOWER_UPGRADE_COST;
        round.manaSpentShopT[side]    += TOWER_UPGRADE_COST;
      }
    }

    // ---- one attacker upgrade per round (binary cap per attacker type) ----
    mana = isPlayer ? state.playerMana : state.aiMana;
    if (mana >= SHOP_UPGRADE_COST + ATTACKER_UPGRADE_RESERVE) {
      const queued = counters.queued[side];
      const eligible = ATTACKER_IDS
        .filter(aid => !(upAttackers[aid] > 0) && (queued[aid] || 0) > 0)
        .sort((a, b) => (queued[b] || 0) - (queued[a] || 0));
      if (eligible.length > 0) {
        const chosen = eligible[0];
        mana -= SHOP_UPGRADE_COST;
        if (isPlayer) {
          state.playerMana = mana;
          state.playerAttackerUpgrades[chosen] = 1;
        } else {
          state.aiMana = mana;
          aiUpgrades.attackers[chosen] = 1;
        }
        counters.shopAttackerUpgrades[side][chosen] += 1;
        round.shopAttackerUpgrades[side][chosen]    += 1;
        counters.manaSpentShopA[side] += SHOP_UPGRADE_COST;
        round.manaSpentShopA[side]    += SHOP_UPGRADE_COST;
      }
    }
  }

  // ----------------------------------------------------------------------
  // Strategy infrastructure
  // ----------------------------------------------------------------------
  // strategyMode: when true, the natural prepareAIMoves bails out so each
  // strategy fully owns drafting. Strategies that want default behavior call
  // helpers.defaultDraft(side), which uses _origPrepareAIMoves directly.
  let strategyMode = false;
  const _origPrepareAIMoves = window.prepareAIMoves;
  window.prepareAIMoves = function () {
    if (strategyMode) {
      state.aiDraftDone = true;
      return;
    }
    return _origPrepareAIMoves.apply(this, arguments);
  };

  // Helper bag passed to every strategy. Keeps strategies side-aware without
  // requiring them to know about state.{ai,player}X naming or the swap dance.
  const helpers = {
    towerDefs,
    attackerDefs,

    getMana(side) { return side === "ai" ? state.aiMana : state.playerMana; },
    getTowers(side) { return side === "ai" ? state.aiTowers : state.playerTowers; },
    getQueue(side) { return side === "ai" ? state.aiQueue : state.playerQueue; },
    getMaxLevel(towerId) { return getTowerMaxLevel(towerId); },
    getOpponentTowers(side) {
      const opp = side === "ai" ? "player" : "ai";
      return preDraftSnapshot[opp] || (opp === "ai" ? state.aiTowers : state.playerTowers);
    },
    getOpponentDefenseScore(side) {
      const opp = this.getOpponentTowers(side);
      return totalDefenseScore(opp || []);
    },

    placeTower(side, slot, towerId) {
      const def = towerDefs.find(t => t.id === towerId);
      if (!def) return false;
      const towers = side === "ai" ? state.aiTowers : state.playerTowers;
      if (slot < 0 || slot >= towers.length) return false;
      const existing = towers[slot];
      const mana = side === "ai" ? state.aiMana : state.playerMana;
      if (mana < def.cost) return false;
      let nextLevel = 1;
      if (existing) {
        if (existing.id !== towerId) return false;
        if (existing.level >= getTowerMaxLevel(towerId)) return false;
        nextLevel = existing.level + 1;
      }
      if (side === "ai") state.aiMana -= def.cost;
      else                state.playerMana -= def.cost;
      towers[slot] = createTowerInstance(def, side, nextLevel);
      return true;
    },

    queueAttacker(side, attackerId) {
      const def = attackerDefs.find(a => a.id === attackerId);
      if (!def) return false;
      const mana = side === "ai" ? state.aiMana : state.playerMana;
      if (mana < def.cost) return false;
      if (side === "ai") {
        state.aiMana -= def.cost;
        state.aiQueue.push(attackerId);
      } else {
        state.playerMana -= def.cost;
        state.playerQueue.push(attackerId);
      }
      return true;
    },

    shopTowerUpgrade(side, towerId) {
      const isPlayer = side === "player";
      const upTowers = isPlayer ? state.playerTowerUpgrades : aiUpgrades.towers;
      const mana = isPlayer ? state.playerMana : state.aiMana;
      if (mana < TOWER_UPGRADE_COST) return false;
      if ((upTowers[towerId] || 0) >= MAX_TOWER_UPGRADES) return false;
      const towers = isPlayer ? state.playerTowers : state.aiTowers;
      if (!towers.some(t => t && t.id === towerId)) return false;
      if (isPlayer) {
        state.playerMana -= TOWER_UPGRADE_COST;
        state.playerTowerUpgrades[towerId] = (state.playerTowerUpgrades[towerId] || 0) + 1;
        applyTowerUpgradeToPlacedTowers(towerId);
      } else {
        state.aiMana -= TOWER_UPGRADE_COST;
        aiUpgrades.towers[towerId] = (aiUpgrades.towers[towerId] || 0) + 1;
        for (const t of state.aiTowers) {
          if (t && t.id === towerId) {
            t.damage   *= TOWER_UPGRADE_MULTIPLIER;
            t.range    *= TOWER_UPGRADE_MULTIPLIER;
            t.fireRate /= TOWER_UPGRADE_MULTIPLIER;
          }
        }
      }
      counters.shopTowerUpgrades[side][towerId] += 1;
      round.shopTowerUpgrades[side][towerId]    += 1;
      counters.manaSpentShopT[side] += TOWER_UPGRADE_COST;
      round.manaSpentShopT[side]    += TOWER_UPGRADE_COST;
      return true;
    },

    shopAttackerUpgrade(side, attackerId) {
      const isPlayer = side === "player";
      const upAttackers = isPlayer ? state.playerAttackerUpgrades : aiUpgrades.attackers;
      if ((upAttackers[attackerId] || 0) > 0) return false;
      const mana = isPlayer ? state.playerMana : state.aiMana;
      if (mana < SHOP_UPGRADE_COST) return false;
      if (isPlayer) {
        state.playerMana -= SHOP_UPGRADE_COST;
        state.playerAttackerUpgrades[attackerId] = 1;
      } else {
        state.aiMana -= SHOP_UPGRADE_COST;
        aiUpgrades.attackers[attackerId] = 1;
      }
      counters.shopAttackerUpgrades[side][attackerId] += 1;
      round.shopAttackerUpgrades[side][attackerId]    += 1;
      counters.manaSpentShopA[side] += SHOP_UPGRADE_COST;
      round.manaSpentShopA[side]    += SHOP_UPGRADE_COST;
      return true;
    },

    refundQueue(side) {
      const queue = side === "ai" ? state.aiQueue : state.playerQueue;
      let refunded = 0;
      for (const aid of queue) {
        const def = attackerDefs.find(a => a.id === aid);
        if (def) refunded += def.cost;
      }
      if (side === "ai") {
        state.aiMana = clamp(state.aiMana + refunded, 0, MANA_CAP);
        state.aiQueue.length = 0;
      } else {
        state.playerMana = clamp(state.playerMana + refunded, 0, MANA_CAP);
        state.playerQueue.length = 0;
      }
    },

    // Delegate to the original AI heuristic for this side, with snapshot
    // overlay for symmetric opponent info.
    defaultDraft(side) {
      const snapOpp = side === "ai" ? preDraftSnapshot.player : preDraftSnapshot.ai;
      if (side === "ai") {
        const realOpp = state.playerTowers;
        if (snapOpp) state.playerTowers = snapOpp;
        state.aiDraftDone = false;
        try { _origPrepareAIMoves(); }
        finally { state.playerTowers = realOpp; state.aiDraftDone = true; }
      } else {
        // Mirror swap with snapshot overlay (the same dance the old
        // mirrorPlayerDraft did).
        const tT = state.aiTowers; state.aiTowers = state.playerTowers; state.playerTowers = tT;
        const tM = state.aiMana;   state.aiMana   = state.playerMana;   state.playerMana   = tM;
        const tQ = state.aiQueue;  state.aiQueue  = state.playerQueue;  state.playerQueue  = tQ;
        state.aiDraftDone = false;
        const realOpp = state.playerTowers;
        if (snapOpp) state.playerTowers = snapOpp;
        inMirrorDraft = true;
        try { _origPrepareAIMoves(); }
        finally {
          inMirrorDraft = false;
          state.playerTowers = realOpp;
          const sT = state.aiTowers; state.aiTowers = state.playerTowers; state.playerTowers = sT;
          const sM = state.aiMana;   state.aiMana   = state.playerMana;   state.playerMana   = sM;
          const sQ = state.aiQueue;  state.aiQueue  = state.playerQueue;  state.playerQueue  = sQ;
          state.aiDraftDone = true;
        }
      }
    },

    defaultShop(side) { harnessShopRound(side); },
  };

  // -------- Strategy library --------

  function makeMonoTowerStrategy(towerId) {
    return {
      name: `Mono ${towerId}`,
      act(side, h) {
        const def = h.towerDefs.find(t => t.id === towerId);
        if (!def) return;
        const towers = h.getTowers(side);
        // Pass 1: fill empty slots
        for (let slot = 0; slot < towers.length; slot++) {
          if (h.getMana(side) < def.cost) break;
          if (towers[slot] === null) h.placeTower(side, slot, towerId);
        }
        // Pass 2: upgrade existing same-type slots
        for (let slot = 0; slot < towers.length; slot++) {
          if (h.getMana(side) < def.cost) break;
          const t = h.getTowers(side)[slot];
          if (t && t.id === towerId && t.level < h.getMaxLevel(towerId)) {
            h.placeTower(side, slot, towerId);
          }
        }
        // Cheap rush attackers (fastest path to scoring)
        const cheap = h.attackerDefs.slice().sort((a, b) => a.cost - b.cost);
        while (true) {
          const aff = cheap.find(d => h.getMana(side) >= d.cost);
          if (!aff) break;
          h.queueAttacker(side, aff.id);
        }
        // Shop upgrades for the chosen color
        while (h.shopTowerUpgrade(side, towerId)) { /* loop */ }
      },
    };
  }

  function makeMonoMinionStrategy(attackerId) {
    return {
      name: `Mono ${attackerId}`,
      act(side, h) {
        // Default tower picks (using the AI heuristic), then strip its
        // attacker queue and replace with mono-only.
        h.defaultDraft(side);
        h.refundQueue(side);
        const def = h.attackerDefs.find(a => a.id === attackerId);
        if (def) {
          while (h.getMana(side) >= def.cost) h.queueAttacker(side, attackerId);
        }
        h.shopAttackerUpgrade(side, attackerId);
      },
    };
  }

  const STRATEGIES = {
    default: {
      name: "Default",
      act(side, h) { h.defaultDraft(side); h.defaultShop(side); },
    },
    rush: {
      name: "Minion Rush",
      act(side, h) {
        // Skip towers entirely. Spend everything on cheapest attackers.
        const cheap = h.attackerDefs.slice().sort((a, b) => a.cost - b.cost);
        while (true) {
          const aff = cheap.find(d => h.getMana(side) >= d.cost);
          if (!aff) break;
          h.queueAttacker(side, aff.id);
        }
      },
    },
    turtle: {
      name: "Tower Defense",
      act(side, h) {
        const sortedDefs = h.towerDefs.slice().sort((a, b) =>
          (b.damage * b.range / b.fireRate) - (a.damage * a.range / a.fireRate));
        const towers = h.getTowers(side);
        // Fill empty slots with strongest affordable tower.
        for (let slot = 0; slot < towers.length; slot++) {
          if (towers[slot] !== null) continue;
          for (const def of sortedDefs) {
            if (h.getMana(side) >= def.cost && h.placeTower(side, slot, def.id)) break;
          }
        }
        // Upgrade existing slots if affordable.
        for (let slot = 0; slot < towers.length; slot++) {
          const t = h.getTowers(side)[slot];
          if (!t || t.level >= h.getMaxLevel(t.id)) continue;
          const def = h.towerDefs.find(d => d.id === t.id);
          if (def && h.getMana(side) >= def.cost) h.placeTower(side, slot, t.id);
        }
        // Aggressive shop upgrades (cycle until nothing more to buy).
        let bought = true;
        while (bought) {
          bought = false;
          for (const def of sortedDefs) {
            if (h.shopTowerUpgrade(side, def.id)) { bought = true; break; }
          }
        }
        // One cheap attacker so battle can resolve (otherwise opponent's
        // attackers all score uncontested; not actually a problem since
        // empty queue still triggers battle end, but lets turtle put
        // opponent under SOME pressure).
        const cheap = h.attackerDefs[0];
        if (h.getMana(side) >= cheap.cost) h.queueAttacker(side, cheap.id);
      },
    },
    monoViolet: makeMonoTowerStrategy("violet"),
    monoYellow: makeMonoTowerStrategy("yellow"),
    monoRed:    makeMonoTowerStrategy("red"),
    monoGreen:  makeMonoTowerStrategy("green"),
    monoOrange: makeMonoTowerStrategy("orange"),
    monoImp:    makeMonoMinionStrategy("imp"),
    monoRunner: makeMonoMinionStrategy("runner"),
    monoBrute:  makeMonoMinionStrategy("brute"),
    monoWisp:   makeMonoMinionStrategy("wisp"),
    monoTank:   makeMonoMinionStrategy("tank"),
  };

  // Variants of "wait N rounds, then attack". attackR1 = no delay (attacks
  // starting round 1, equivalent to default). attackR10 = wait 9 rounds, only
  // attack on the final round. Lets us pinpoint the optimal commit round.
  function makeAttackFromStrategy(startRound) {
    return {
      name: `Attack from R${startRound}`,
      act(side, h, ctx) {
        h.defaultDraft(side);
        // Before the attack-start round, refund queued attackers so mana
        // banks for next round. Towers placed by defaultDraft stay.
        if (ctx.waveNumber < startRound) h.refundQueue(side);
        h.defaultShop(side);
      },
    };
  }
  for (let r = 1; r <= 10; r++) {
    STRATEGIES[`attackR${r}`] = makeAttackFromStrategy(r);
  }

  // Pulse strategies: attack ONLY on specific rounds, tower-up otherwise.
  // Same draft mechanics as attackFromR* but the "attack window" is a set of
  // discrete rounds instead of an open-ended range.
  function makePulseAttackStrategy(rounds) {
    const set = new Set(rounds);
    return {
      name: `Pulse R${rounds.join("+")}`,
      act(side, h, ctx) {
        h.defaultDraft(side);
        if (!set.has(ctx.waveNumber)) h.refundQueue(side);
        h.defaultShop(side);
      },
    };
  }
  // The naming uses the rounds joined with `_` so the CSV is grep-friendly.
  STRATEGIES.pulseR4_R10        = makePulseAttackStrategy([4, 10]);
  STRATEGIES.pulseR3_R10        = makePulseAttackStrategy([3, 10]);
  STRATEGIES.pulseR5_R10        = makePulseAttackStrategy([5, 10]);
  STRATEGIES.pulseR4_R7_R10     = makePulseAttackStrategy([4, 7, 10]);
  STRATEGIES.pulseR3_R6_R10     = makePulseAttackStrategy([3, 6, 10]);
  STRATEGIES.pulseR3_R5_R7_R10  = makePulseAttackStrategy([3, 5, 7, 10]);
  STRATEGIES.pulseR10           = makePulseAttackStrategy([10]);
  STRATEGIES.pulseR4            = makePulseAttackStrategy([4]);

  // Drive one full match. Returns a stats blob.
  // strategyAName controls the player slot; strategyBName controls the AI slot.
  async function runOneMatch(strategyAName, strategyBName, maxTicks) {
    if (typeof strategyAName !== "string") strategyAName = "default";
    if (typeof strategyBName !== "string") strategyBName = "default";
    if (typeof maxTicks !== "number")      maxTicks = 200000;
    const stratA = STRATEGIES[strategyAName] || STRATEGIES.default;
    const stratB = STRATEGIES[strategyBName] || STRATEGIES.default;

    resetCounters();
    const placements = [];
    const roundScores = [];
    let prevWave = 1;

    startNewMatch();
    state.paused = false;
    resetRound(state.waveNumber, 0);
    strategyMode = true;

    let tick = 0;
    let prevPhase = state.phase;
    try {
    while (!state.gameOver && tick < maxTicks) {
      tick += 1;
      const phase = state.phase;

      // Detect entry into a fresh prep (after a banner finishes) so we can
      // reset round counters with the correct waveNumber. The natural flow is
      // banner → prep, so when phase transitions banner → prep we're in a new
      // round if waveNumber has advanced.
      if (prevPhase !== "prep" && phase === "prep" && round.number !== state.waveNumber) {
        resetRound(state.waveNumber, tick);
      }
      prevPhase = phase;

      if (phase === "banner") {
        updateGame(0.25);
        continue;
      }

      if (phase === "prep") {
        // Strategy mode: prepareAIMoves is no-op; both sides drive through
        // their assigned strategies. preDraftSnapshot was set by our
        // beginPrepPhase wrapper earlier.
        const ctx = { waveNumber: state.waveNumber };
        stratA.act("player", helpers, ctx);
        stratB.act("ai",     helpers, ctx);

        round.manaPostDraft.player = state.playerMana;
        round.manaPostDraft.ai     = state.aiMana;

        // Tally queued attackers (already counted by helpers.queueAttacker
        // for some strategies; tallyQueue handles whatever's in the queue
        // at this moment for spend/queue tracking).
        tallyQueue(state.playerQueue, "player");
        tallyQueue(state.aiQueue, "ai");

        round.manaPostShop.player = state.playerMana;
        round.manaPostShop.ai     = state.aiMana;

        placements.push({
          round: state.waveNumber,
          player: snapshotTowers(state.playerTowers),
          ai:     snapshotTowers(state.aiTowers),
          playerMana: state.playerMana,
          aiMana:     state.aiMana,
          playerTowerUpgrades:    { ...state.playerTowerUpgrades },
          playerAttackerUpgrades: { ...state.playerAttackerUpgrades },
          aiTowerUpgrades:        { ...aiUpgrades.towers },
          aiAttackerUpgrades:     { ...aiUpgrades.attackers },
        });

        round.battleStartTick = tick;
        launchWave();
        continue;
      }

      if (phase === "battle") {
        updateGame(0.05);
        // When battle resolves, snapshot the round's data and record per-round
        // score deltas.
        if (state.phase !== "battle") {
          round.battleEndTick = tick;
          snapshotRound();
          if (state.waveNumber !== prevWave) {
            roundScores.push({
              round: prevWave,
              playerScore: state.playerScore,
              aiScore: state.aiScore,
            });
            prevWave = state.waveNumber;
          }
        }
        continue;
      }

      if (phase === "shop") {
        // Shop never opens automatically in the singleplayer flow we drive
        // (openRoundShop transitions straight to banner). If we ever land
        // here, advance.
        beginRoundBanner();
        continue;
      }

      if (phase === "gameover") break;
      if (phase === "waiting") break;
    }

    // Capture the final round's score if the loop exited mid-state.
    if (roundScores.length === 0 || roundScores[roundScores.length - 1].round !== state.waveNumber) {
      roundScores.push({
        round: state.waveNumber,
        playerScore: state.playerScore,
        aiScore: state.aiScore,
      });
    }
    } finally {
      strategyMode = false;
    }

    const winnerSide = state.matchWinner
      || (state.playerScore > state.aiScore ? "player"
        : state.playerScore < state.aiScore ? "ai" : "draw");
    const winnerStrategy = winnerSide === "player" ? strategyAName
      : winnerSide === "ai" ? strategyBName
      : null;

    return {
      strategyA: strategyAName,   // controls player slot
      strategyB: strategyBName,   // controls ai slot
      winnerStrategy,
      winner: winnerSide,
      playerScore: state.playerScore,
      aiScore: state.aiScore,
      waves: state.waveNumber,
      ticks: tick,
      placements,
      roundScores,
      damage: { player: { ...counters.damage.player }, ai: { ...counters.damage.ai } },
      hits:   { player: { ...counters.hits.player },   ai: { ...counters.hits.ai }   },
      kills:  { player: { ...counters.kills.player },  ai: { ...counters.kills.ai }  },
      shots:  { player: { ...counters.shots.player },  ai: { ...counters.shots.ai }  },
      queued:   { player: { ...counters.queued.player },   ai: { ...counters.queued.ai }   },
      spawned:  { player: { ...counters.spawned.player },  ai: { ...counters.spawned.ai }  },
      killedAS: { player: { ...counters.killedAS.player }, ai: { ...counters.killedAS.ai } },
      damageTakenAS: {
        player: { ...counters.damageTakenAS.player },
        ai:     { ...counters.damageTakenAS.ai },
      },
      towersPlaced: {
        player: { ...counters.towersPlaced.player },
        ai:     { ...counters.towersPlaced.ai },
      },
      towersUpgradedInPrep: {
        player: { ...counters.towersUpgradedInPrep.player },
        ai:     { ...counters.towersUpgradedInPrep.ai },
      },
      shopTowerUpgrades: {
        player: { ...counters.shopTowerUpgrades.player },
        ai:     { ...counters.shopTowerUpgrades.ai },
      },
      shopAttackerUpgrades: {
        player: { ...counters.shopAttackerUpgrades.player },
        ai:     { ...counters.shopAttackerUpgrades.ai },
      },
      // Tower × Attacker matrix. matrix[side][towerId][attackerId]
      matrixDamage: {
        player: deepCopy(counters.matrixDamage.player),
        ai:     deepCopy(counters.matrixDamage.ai),
      },
      matrixHits: {
        player: deepCopy(counters.matrixHits.player),
        ai:     deepCopy(counters.matrixHits.ai),
      },
      matrixKills: {
        player: deepCopy(counters.matrixKills.player),
        ai:     deepCopy(counters.matrixKills.ai),
      },
      economy: {
        player: {
          manaSpentTowers:    counters.manaSpentTowers.player,
          manaSpentAttackers: counters.manaSpentAttackers.player,
          manaSpentShopT:     counters.manaSpentShopT.player,
          manaSpentShopA:     counters.manaSpentShopA.player,
          manaFromKills:      counters.manaFromKills.player,
          manaWastedToCap:    counters.manaWastedToCap.player,
        },
        ai: {
          manaSpentTowers:    counters.manaSpentTowers.ai,
          manaSpentAttackers: counters.manaSpentAttackers.ai,
          manaSpentShopT:     counters.manaSpentShopT.ai,
          manaSpentShopA:     counters.manaSpentShopA.ai,
          manaFromKills:      counters.manaFromKills.ai,
          manaWastedToCap:    counters.manaWastedToCap.ai,
        },
      },
      statusEffects: {
        player: {
          slowSecondsApplied: counters.slowSecondsApplied.player,
          poisonTicks:        counters.poisonTicks.player,
          poisonDamage:       counters.poisonDamage.player,
        },
        ai: {
          slowSecondsApplied: counters.slowSecondsApplied.ai,
          poisonTicks:        counters.poisonTicks.ai,
          poisonDamage:       counters.poisonDamage.ai,
        },
      },
      finalUpgrades: {
        player: {
          towers:    { ...state.playerTowerUpgrades },
          attackers: { ...state.playerAttackerUpgrades },
        },
        ai: {
          towers:    { ...aiUpgrades.towers },
          attackers: { ...aiUpgrades.attackers },
        },
      },
      finalTowers: {
        player: snapshotTowers(state.playerTowers),
        ai:     snapshotTowers(state.aiTowers),
      },
      rounds: counters.rounds.slice(),
    };
  }

  // Shallow → deep copy of the {towerId: {attackerId: number}} matrix so the
  // result blob doesn't share references with the live counters. Function
  // declaration is hoisted, so runOneMatch above can reference it.
  function deepCopy(m) {
    const out = {};
    for (const k of Object.keys(m)) out[k] = { ...m[k] };
    return out;
  }

  window.__harness = {
    runOneMatch,
    counters,
    TOWER_IDS,
    ATTACKER_IDS,
    listStrategies() {
      return Object.keys(STRATEGIES).map(id => ({ id, name: STRATEGIES[id].name }));
    },
  };
}

// ----------------------------------------------------------------------------
// CSV writers
// ----------------------------------------------------------------------------

function csvField(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(arr) { return arr.map(csvField).join(","); }

async function writeCsvs(results, outDir) {
  if (results.length === 0) return;
  const towerIds = Object.keys(results[0].damage.player);
  const attackerIds = Object.keys(results[0].queued.player);

  // matches.csv — one row per match
  {
    const rows = [csvRow([
      "matchIndex", "strategyA", "strategyB", "winner", "winnerStrategy",
      "playerScore", "aiScore", "waves", "ticks",
    ])];
    for (const r of results) {
      rows.push(csvRow([
        r.matchIndex, r.strategyA || "", r.strategyB || "",
        r.winner, r.winnerStrategy || "",
        r.playerScore, r.aiScore, r.waves, r.ticks,
      ]));
    }
    await fs.writeFile(path.join(outDir, "matches.csv"), rows.join("\n") + "\n");
  }

  // towers.csv — per match × owner × tower-type
  {
    const rows = [csvRow(["matchIndex", "owner", "towerId", "damage", "hits", "kills", "shopUpgrades", "won"])];
    for (const r of results) {
      for (const owner of ["player", "ai"]) {
        const won = r.winner === owner ? 1 : 0;
        for (const id of towerIds) {
          rows.push(csvRow([
            r.matchIndex, owner, id,
            Math.round(r.damage[owner][id] * 1000) / 1000,
            r.hits[owner][id],
            r.kills[owner][id],
            (r.shopTowerUpgrades && r.shopTowerUpgrades[owner] && r.shopTowerUpgrades[owner][id]) || 0,
            won,
          ]));
        }
      }
    }
    await fs.writeFile(path.join(outDir, "towers.csv"), rows.join("\n") + "\n");
  }

  // shop.csv — per match × owner × kind × id
  {
    const rows = [csvRow(["matchIndex", "owner", "kind", "id", "upgradesBought", "won"])];
    for (const r of results) {
      for (const owner of ["player", "ai"]) {
        const won = r.winner === owner ? 1 : 0;
        for (const id of towerIds) {
          const n = (r.shopTowerUpgrades && r.shopTowerUpgrades[owner] && r.shopTowerUpgrades[owner][id]) || 0;
          rows.push(csvRow([r.matchIndex, owner, "tower", id, n, won]));
        }
        for (const id of attackerIds) {
          const n = (r.shopAttackerUpgrades && r.shopAttackerUpgrades[owner] && r.shopAttackerUpgrades[owner][id]) || 0;
          rows.push(csvRow([r.matchIndex, owner, "attacker", id, n, won]));
        }
      }
    }
    await fs.writeFile(path.join(outDir, "shop.csv"), rows.join("\n") + "\n");
  }

  // placements.csv — per match × round × owner × slot
  {
    const rows = [csvRow(["matchIndex", "round", "owner", "slot", "towerId", "level", "manaPostDraft"])];
    for (const r of results) {
      for (const p of r.placements) {
        for (const owner of ["player", "ai"]) {
          const slots = p[owner];
          for (let s = 0; s < slots.length; s++) {
            const t = slots[s];
            rows.push(csvRow([
              r.matchIndex, p.round, owner, s,
              t ? t.id : "",
              t ? t.level : "",
              owner === "player" ? p.playerMana : p.aiMana,
            ]));
          }
        }
      }
    }
    await fs.writeFile(path.join(outDir, "placements.csv"), rows.join("\n") + "\n");
  }

  // attackers.csv — per match × owner × attacker-type
  {
    const rows = [csvRow(["matchIndex", "owner", "attackerId", "queued", "won"])];
    for (const r of results) {
      for (const owner of ["player", "ai"]) {
        const won = r.winner === owner ? 1 : 0;
        for (const id of attackerIds) {
          rows.push(csvRow([r.matchIndex, owner, id, r.queued[owner][id], won]));
        }
      }
    }
    await fs.writeFile(path.join(outDir, "attackers.csv"), rows.join("\n") + "\n");
  }

  // tower-vs-attacker.csv — damage/hits/kills matrix
  {
    const rows = [csvRow(["matchIndex", "ownerOfTower", "towerId", "attackerId", "damage", "hits", "kills"])];
    for (const r of results) {
      if (!r.matrixDamage) continue;
      for (const owner of ["player", "ai"]) {
        for (const tid of towerIds) {
          for (const aid of attackerIds) {
            const d = r.matrixDamage[owner][tid][aid] || 0;
            const h = r.matrixHits[owner][tid][aid] || 0;
            const k = r.matrixKills[owner][tid][aid] || 0;
            if (d === 0 && h === 0 && k === 0) continue;
            rows.push(csvRow([
              r.matchIndex, owner, tid, aid,
              Math.round(d * 1000) / 1000, h, k,
            ]));
          }
        }
      }
    }
    await fs.writeFile(path.join(outDir, "tower-vs-attacker.csv"), rows.join("\n") + "\n");
  }

  // attacker-fate.csv — queued / spawned / killed / scored / damageTaken per attacker per side
  {
    const rows = [csvRow([
      "matchIndex", "owner", "attackerId",
      "queued", "spawned", "killed", "scored", "damageTaken",
      "scoreShare", "won",
    ])];
    for (const r of results) {
      for (const owner of ["player", "ai"]) {
        const won = r.winner === owner ? 1 : 0;
        const totalScored = (owner === "player" ? r.playerScore : r.aiScore);
        for (const aid of attackerIds) {
          const queued  = r.queued[owner][aid] || 0;
          const spawned = (r.spawned && r.spawned[owner] && r.spawned[owner][aid]) || queued;
          const killed  = (r.killedAS && r.killedAS[owner] && r.killedAS[owner][aid]) || 0;
          const dmgIn   = (r.damageTakenAS && r.damageTakenAS[owner] && r.damageTakenAS[owner][aid]) || 0;
          const scored  = Math.max(0, spawned - killed);
          const share = totalScored > 0 ? Math.round((scored / totalScored) * 10000) / 10000 : 0;
          rows.push(csvRow([
            r.matchIndex, owner, aid,
            queued, spawned, killed, scored,
            Math.round(dmgIn * 1000) / 1000,
            share, won,
          ]));
        }
      }
    }
    await fs.writeFile(path.join(outDir, "attacker-fate.csv"), rows.join("\n") + "\n");
  }

  // rounds.csv — per match × round × side
  {
    const headerKeys = [
      "manaPreDraft", "manaPostDraft", "manaPostShop",
      "manaSpentTowers", "manaSpentAttackers", "manaSpentShopT", "manaSpentShopA",
      "manaFromKills", "manaWastedToCap",
      "scoreDelta",
    ];
    const sumKeys = (obj) => Object.values(obj || {}).reduce((s, v) => s + (v || 0), 0);
    const rows = [csvRow([
      "matchIndex", "round", "owner", "battleTicks",
      ...headerKeys,
      "towersPlacedTotal", "shotsTotal", "damageTotal", "killsTotal",
      "queuedTotal", "spawnedTotal", "killedAsAttackerTotal",
      "shopTowerUpgrades", "shopAttackerUpgrades",
    ])];
    for (const r of results) {
      if (!r.rounds) continue;
      for (const rd of r.rounds) {
        for (const owner of ["player", "ai"]) {
          const s = rd[owner];
          rows.push(csvRow([
            r.matchIndex, rd.round, owner, rd.battleTicks,
            ...headerKeys.map(k => s[k]),
            sumKeys(s.towersPlaced), sumKeys(s.shots),
            Math.round(sumKeys(s.damage) * 1000) / 1000,
            sumKeys(s.kills),
            sumKeys(s.queued), sumKeys(s.spawned), sumKeys(s.killedAS),
            sumKeys(s.shopTowerUpgrades), sumKeys(s.shopAttackerUpgrades),
          ]));
        }
      }
    }
    await fs.writeFile(path.join(outDir, "rounds.csv"), rows.join("\n") + "\n");
  }

  // status-effects.csv — per match × side: slow seconds applied, poison ticks/damage
  {
    const rows = [csvRow([
      "matchIndex", "owner", "won",
      "slowSecondsApplied", "poisonTicks", "poisonDamage",
    ])];
    for (const r of results) for (const owner of ["player", "ai"]) {
      const won = r.winner === owner ? 1 : 0;
      const s = (r.statusEffects && r.statusEffects[owner]) || {};
      rows.push(csvRow([
        r.matchIndex, owner, won,
        Math.round((s.slowSecondsApplied || 0) * 100) / 100,
        s.poisonTicks || 0,
        Math.round((s.poisonDamage || 0) * 100) / 100,
      ]));
    }
    await fs.writeFile(path.join(outDir, "status-effects.csv"), rows.join("\n") + "\n");
  }

  // economy.csv — per match × side mana flow summary
  {
    const rows = [csvRow([
      "matchIndex", "owner", "won",
      "manaSpentTowers", "manaSpentAttackers", "manaSpentShopT", "manaSpentShopA",
      "manaFromKills", "manaWastedToCap",
      "totalSpent", "totalSpentNetOfWaste",
    ])];
    for (const r of results) {
      for (const owner of ["player", "ai"]) {
        const won = r.winner === owner ? 1 : 0;
        const e = (r.economy && r.economy[owner]) || {};
        const spent = (e.manaSpentTowers || 0) + (e.manaSpentAttackers || 0)
                    + (e.manaSpentShopT || 0) + (e.manaSpentShopA || 0);
        rows.push(csvRow([
          r.matchIndex, owner, won,
          e.manaSpentTowers || 0, e.manaSpentAttackers || 0,
          e.manaSpentShopT || 0,  e.manaSpentShopA || 0,
          e.manaFromKills || 0,   e.manaWastedToCap || 0,
          spent, spent + (e.manaWastedToCap || 0),
        ]));
      }
    }
    await fs.writeFile(path.join(outDir, "economy.csv"), rows.join("\n") + "\n");
  }

  // summary.csv — aggregate across all matches per (owner, towerId)
  {
    const rows = [csvRow([
      "owner", "towerId",
      "matches", "matchesWon",
      "totalDamage", "totalShots", "totalHits", "totalKills",
      "totalPlacements", "totalShopUpgrades",
      "avgDamagePerMatch", "avgKillsPerMatch", "avgPlacementsPerMatch",
      "damagePerShot", "damagePerHit", "killsPerShot",
      "winRateWhenPresent",
    ])];
    for (const owner of ["player", "ai"]) {
      for (const tid of towerIds) {
        let matches = 0, matchesPresent = 0, wins = 0, winsPresent = 0;
        let damage = 0, shots = 0, hits = 0, kills = 0, placements = 0, shopUps = 0;
        for (const r of results) {
          matches += 1;
          if (r.winner === owner) wins += 1;
          const placedThis = (r.towersPlaced && r.towersPlaced[owner] && r.towersPlaced[owner][tid]) || 0;
          const isPresent = placedThis > 0;
          if (isPresent) matchesPresent += 1;
          if (isPresent && r.winner === owner) winsPresent += 1;
          damage += r.damage[owner][tid] || 0;
          shots  += (r.shots && r.shots[owner] && r.shots[owner][tid]) || 0;
          hits   += r.hits[owner][tid]   || 0;
          kills  += r.kills[owner][tid]  || 0;
          placements += placedThis;
          shopUps    += (r.shopTowerUpgrades && r.shopTowerUpgrades[owner] && r.shopTowerUpgrades[owner][tid]) || 0;
        }
        const avg = (n) => matches === 0 ? 0 : Math.round((n / matches) * 1000) / 1000;
        const ratio = (n, d) => d === 0 ? 0 : Math.round((n / d) * 1000) / 1000;
        const winRatePresent = matchesPresent === 0 ? 0 : Math.round((winsPresent / matchesPresent) * 10000) / 10000;
        rows.push(csvRow([
          owner, tid,
          matches, wins,
          Math.round(damage * 100) / 100, shots, hits, kills,
          placements, shopUps,
          avg(damage), avg(kills), avg(placements),
          ratio(damage, shots), ratio(damage, hits), ratio(kills, shots),
          winRatePresent,
        ]));
      }
    }
    await fs.writeFile(path.join(outDir, "summary-towers.csv"), rows.join("\n") + "\n");
  }

  // summary-attackers.csv — aggregate per (owner, attackerId)
  {
    const rows = [csvRow([
      "owner", "attackerId",
      "matches", "matchesWon",
      "totalQueued", "totalSpawned", "totalKilled", "totalScored", "totalDamageTaken",
      "avgQueuedPerMatch", "scoringRate", "killRate",
      "winRateWhenQueued",
    ])];
    for (const owner of ["player", "ai"]) {
      for (const aid of attackerIds) {
        let matches = 0, wins = 0, matchesQueued = 0, winsQueued = 0;
        let queued = 0, spawned = 0, killed = 0, scored = 0, damageTaken = 0;
        for (const r of results) {
          matches += 1;
          if (r.winner === owner) wins += 1;
          const q = r.queued[owner][aid] || 0;
          const sp = (r.spawned && r.spawned[owner] && r.spawned[owner][aid]) || q;
          const k = (r.killedAS && r.killedAS[owner] && r.killedAS[owner][aid]) || 0;
          const sc = Math.max(0, sp - k);
          queued += q; spawned += sp; killed += k; scored += sc;
          damageTaken += (r.damageTakenAS && r.damageTakenAS[owner] && r.damageTakenAS[owner][aid]) || 0;
          if (q > 0) {
            matchesQueued += 1;
            if (r.winner === owner) winsQueued += 1;
          }
        }
        const avgQueued = matches === 0 ? 0 : Math.round((queued / matches) * 1000) / 1000;
        const scoringRate = spawned === 0 ? 0 : Math.round((scored / spawned) * 10000) / 10000;
        const killRate    = spawned === 0 ? 0 : Math.round((killed / spawned) * 10000) / 10000;
        const winRateQueued = matchesQueued === 0 ? 0 : Math.round((winsQueued / matchesQueued) * 10000) / 10000;
        rows.push(csvRow([
          owner, aid,
          matches, wins,
          queued, spawned, killed, scored,
          Math.round(damageTaken * 100) / 100,
          avgQueued, scoringRate, killRate,
          winRateQueued,
        ]));
      }
    }
    await fs.writeFile(path.join(outDir, "summary-attackers.csv"), rows.join("\n") + "\n");
  }

  // summary-matrix.csv — aggregate tower × attacker damage and kills
  {
    const rows = [csvRow([
      "ownerOfTower", "towerId", "attackerId",
      "matches", "totalDamage", "totalHits", "totalKills",
      "avgDamagePerMatch", "killsPerMatch",
    ])];
    for (const owner of ["player", "ai"]) {
      for (const tid of towerIds) {
        for (const aid of attackerIds) {
          let matches = 0, damage = 0, hits = 0, kills = 0;
          for (const r of results) {
            matches += 1;
            if (r.matrixDamage) {
              damage += r.matrixDamage[owner][tid][aid] || 0;
              hits   += r.matrixHits[owner][tid][aid]   || 0;
              kills  += r.matrixKills[owner][tid][aid]  || 0;
            }
          }
          rows.push(csvRow([
            owner, tid, aid,
            matches, Math.round(damage * 100) / 100, hits, kills,
            matches === 0 ? 0 : Math.round((damage / matches) * 1000) / 1000,
            matches === 0 ? 0 : Math.round((kills / matches) * 1000) / 1000,
          ]));
        }
      }
    }
    await fs.writeFile(path.join(outDir, "summary-matrix.csv"), rows.join("\n") + "\n");
  }

  // win-by-tower-count.csv — for each (owner, towerId, finalCount), rows/wins/rate
  // Counts towers of each type in finalTowers per match. "finalCount" only
  // captures the build at match end; for a stricter measure, see placements.csv.
  {
    const buckets = {}; // key = `${owner}|${towerId}|${count}` -> {matches, wins}
    for (const r of results) {
      for (const owner of ["player", "ai"]) {
        const counts = Object.fromEntries(towerIds.map(id => [id, 0]));
        for (const t of r.finalTowers[owner]) {
          if (t && (t.id in counts)) counts[t.id] += 1;
        }
        const won = r.winner === owner ? 1 : 0;
        for (const id of towerIds) {
          const k = `${owner}|${id}|${counts[id]}`;
          if (!buckets[k]) buckets[k] = { matches: 0, wins: 0 };
          buckets[k].matches += 1;
          buckets[k].wins += won;
        }
      }
    }
    const rows = [csvRow(["owner", "towerId", "finalCount", "matches", "wins", "winRate"])];
    const keys = Object.keys(buckets).sort();
    for (const k of keys) {
      const [owner, id, count] = k.split("|");
      const b = buckets[k];
      const rate = b.matches === 0 ? 0 : Math.round((b.wins / b.matches) * 10000) / 10000;
      rows.push(csvRow([owner, id, count, b.matches, b.wins, rate]));
    }
    await fs.writeFile(path.join(outDir, "win-by-tower-count.csv"), rows.join("\n") + "\n");
  }
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const { server, port } = await startServer();
  const url = `http://127.0.0.1:${port}/index.html`;
  console.log(`[harness] serving ${WWW_DIR} on ${url}`);
  console.log(`[harness] target games: ${N_GAMES}, headless: ${HEADLESS}, out: ${OUT_DIR}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();

  // Block everything outside our local server (Firebase / gstatic CDN etc).
  await context.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(`http://127.0.0.1:${port}/`)) return route.continue();
    return route.abort();
  });

  const page = await context.newPage();
  await page.addInitScript(PAGE_PRELUDE);
  page.on("pageerror", (e) => console.warn("[page error]", e.message));
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") {
      // The game's own log lines are noisy; only surface real errors.
      const text = msg.text();
      if (!text.includes("[Game]")) console.log(`[page ${t}]`, text);
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  // NOTE: towerDefs/attackerDefs are top-level `const` in script.js, which means
  // they do NOT attach to `window` in a classic script — only top-level `var` and
  // `function` declarations do. Probe with bare identifiers via `eval` so the
  // lexical-scope binding is resolvable.
  await page.waitForFunction(
    () => {
      try {
        return typeof state === "object" && state !== null
          && typeof updateGame === "function"
          && typeof prepareAIMoves === "function"
          && typeof startNewMatch === "function"
          && typeof launchWave === "function"
          && typeof beginRoundBanner === "function"
          && typeof applyProjectileDamage === "function"
          && typeof recordTowerKill === "function"
          && typeof towerDefs !== "undefined" && Array.isArray(towerDefs)
          && typeof attackerDefs !== "undefined" && Array.isArray(attackerDefs);
      } catch (e) { return false; }
    },
    { timeout: 15000 }
  );
  console.log("[harness] page ready, installing harness…");
  await page.evaluate(INSTALL_HARNESS);
  console.log("[harness] harness installed");

  const availableStrategies = await page.evaluate(() => window.__harness.listStrategies());

  if (LIST_STRATEGIES) {
    console.log("[harness] registered strategies:");
    for (const s of availableStrategies) console.log(`  ${s.id.padEnd(20)} ${s.name}`);
    await browser.close();
    server.close();
    return;
  }

  // Resolve strategy list and matchups.
  let strategyList;
  if (STRATEGIES_ARG === "all") {
    strategyList = availableStrategies.map(s => s.id);
  } else if (STRATEGIES_ARG) {
    strategyList = STRATEGIES_ARG.split(",").map(s => s.trim()).filter(Boolean);
    const known = new Set(availableStrategies.map(s => s.id));
    const unknown = strategyList.filter(s => !known.has(s));
    if (unknown.length > 0) {
      console.error(`[harness] unknown strategies: ${unknown.join(", ")}`);
      console.error(`[harness] available: ${availableStrategies.map(s => s.id).join(", ")}`);
      process.exit(1);
    }
  } else {
    strategyList = ["default"]; // backward-compat: single strategy self-vs-self
  }

  const matchups = [];
  for (const a of strategyList) for (const b of strategyList) matchups.push([a, b]);
  const gamesPerMatchup = GAMES_PER_MATCHUP > 0
    ? GAMES_PER_MATCHUP
    : (matchups.length === 1 ? N_GAMES : 50);
  const totalMatches = matchups.length * gamesPerMatchup;
  console.log(`[harness] strategies: ${strategyList.join(", ")}`);
  console.log(`[harness] matchups: ${matchups.length} × ${gamesPerMatchup} games = ${totalMatches} matches`);

  const jsonlPath = path.join(OUT_DIR, "matches.jsonl");
  if (!MATCHUP_ONLY) await fs.writeFile(jsonlPath, "");

  const results = [];
  const matchupResults = [];
  const t0 = Date.now();
  let matchIndex = 0;
  for (const [stratA, stratB] of matchups) {
    let aWins = 0, bWins = 0, draws = 0;
    const matchupT0 = Date.now();
    for (let i = 0; i < gamesPerMatchup; i++) {
      let r;
      try {
        // In matchup-only mode, ask the page to return ONLY the slim winner
        // record so the result blob doesn't balloon memory. Otherwise return
        // the full stats blob.
        r = await Promise.race([
          MATCHUP_ONLY
            ? page.evaluate(async ([sa, sb]) => {
                const full = await window.__harness.runOneMatch(sa, sb);
                return {
                  strategyA: full.strategyA,
                  strategyB: full.strategyB,
                  winner: full.winner,
                  winnerStrategy: full.winnerStrategy,
                  playerScore: full.playerScore,
                  aiScore: full.aiScore,
                };
              }, [stratA, stratB])
            : page.evaluate(([sa, sb]) => window.__harness.runOneMatch(sa, sb), [stratA, stratB]),
          new Promise((_, rej) => setTimeout(() => rej(new Error("match timeout (60s)")), 60000)),
        ]);
      } catch (e) {
        console.error(`[harness] match ${matchIndex + 1} (${stratA} vs ${stratB}) failed: ${e.message}`);
        break;
      }
      r.matchIndex = matchIndex;
      // Only retain in-memory results when not in matchup-only mode (the
      // detailed CSVs need them; matchup CSVs are aggregated below).
      if (!MATCHUP_ONLY) {
        results.push(r);
        await fs.appendFile(jsonlPath, JSON.stringify(r) + "\n");
      }
      if      (r.winner === "player") aWins++;
      else if (r.winner === "ai")     bWins++;
      else                             draws++;
      matchIndex++;
    }
    const matchupMs = Date.now() - matchupT0;
    const aRate = (aWins / Math.max(1, gamesPerMatchup) * 100).toFixed(1);
    matchupResults.push({ stratA, stratB, games: gamesPerMatchup, aWins, bWins, draws, ms: matchupMs });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `  ${stratA.padEnd(15)} vs ${stratB.padEnd(15)}  A=${String(aWins).padStart(3)} B=${String(bWins).padStart(3)} D=${String(draws).padStart(3)}  (Awin ${aRate}%)  ${matchupMs}ms  total ${dt}s`
    );
  }

  await browser.close();
  server.close();

  console.log("[harness] writing CSVs…");
  if (!MATCHUP_ONLY && results.length > 0) await writeCsvs(results, OUT_DIR);
  await writeMatchupCsvs(results, matchupResults, OUT_DIR);
  const finalMatchCount = MATCHUP_ONLY
    ? matchupResults.reduce((s, m) => s + m.games, 0)
    : results.length;
  console.log(`[harness] done. ${finalMatchCount} matches in ${OUT_DIR}`);
}

// ----------------------------------------------------------------------------
// Matchup CSVs
// ----------------------------------------------------------------------------

async function writeMatchupCsvs(results, matchupResults, outDir) {
  // matchup-matrix.csv — per ordered (A controls player, B controls AI) pair
  {
    const rows = [csvRow([
      "strategyA", "strategyB", "games",
      "wins_A", "wins_B", "draws",
      "winRate_A", "winRate_B", "drawRate",
    ])];
    for (const m of matchupResults) {
      const r = (n) => m.games === 0 ? 0 : Math.round((n / m.games) * 10000) / 10000;
      rows.push(csvRow([
        m.stratA, m.stratB, m.games,
        m.aWins, m.bWins, m.draws,
        r(m.aWins), r(m.bWins), r(m.draws),
      ]));
    }
    await fs.writeFile(path.join(outDir, "matchup-matrix.csv"), rows.join("\n") + "\n");
  }

  // strategy-summary.csv — per strategy, aggregated across all matchups it
  // played (both as A and as B). "wins" means matches this strategy won.
  // Aggregates from `results` when available (full per-match data),
  // otherwise from `matchupResults` (counts only — matchup-only mode).
  {
    const tally = {}; // sid → { games, wins, losses, draws, asA_games, asA_wins, asB_games, asB_wins }
    const ensure = (sid) => {
      if (!tally[sid]) tally[sid] = {
        games: 0, wins: 0, losses: 0, draws: 0,
        asA_games: 0, asA_wins: 0, asB_games: 0, asB_wins: 0,
      };
      return tally[sid];
    };
    if (results.length > 0) {
      for (const r of results) {
        const a = ensure(r.strategyA);
        const b = ensure(r.strategyB);
        a.games += 1; b.games += 1;
        a.asA_games += 1; b.asB_games += 1;
        if (r.winner === "player") {
          a.wins += 1; b.losses += 1;
          a.asA_wins += 1;
        } else if (r.winner === "ai") {
          b.wins += 1; a.losses += 1;
          b.asB_wins += 1;
        } else {
          a.draws += 1; b.draws += 1;
        }
      }
    } else {
      // Aggregate from per-matchup tallies.
      for (const m of matchupResults) {
        const a = ensure(m.stratA);
        const b = ensure(m.stratB);
        a.games += m.games;     b.games += m.games;
        a.asA_games += m.games; b.asB_games += m.games;
        a.wins += m.aWins;      a.losses += m.bWins;      a.draws += m.draws;
        b.wins += m.bWins;      b.losses += m.aWins;      b.draws += m.draws;
        a.asA_wins += m.aWins;
        b.asB_wins += m.bWins;
      }
    }
    const rows = [csvRow([
      "strategy", "games", "wins", "losses", "draws", "winRate",
      "asA_games", "asA_winRate", "asB_games", "asB_winRate",
    ])];
    const ratio = (n, d) => d === 0 ? 0 : Math.round((n / d) * 10000) / 10000;
    for (const sid of Object.keys(tally).sort()) {
      const t = tally[sid];
      rows.push(csvRow([
        sid, t.games, t.wins, t.losses, t.draws,
        ratio(t.wins, t.games),
        t.asA_games, ratio(t.asA_wins, t.asA_games),
        t.asB_games, ratio(t.asB_wins, t.asB_games),
      ]));
    }
    await fs.writeFile(path.join(outDir, "strategy-summary.csv"), rows.join("\n") + "\n");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
