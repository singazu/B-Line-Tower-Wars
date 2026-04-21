const PREP_SECONDS = 15;
const MAX_ROUNDS = 10;
const MANA_CAP = 99;
const ROUND_BANNER_SECONDS = 1.8;
const SHOP_UPGRADE_COST = 3;
const TOWER_UPGRADE_COST = 5;
const ATTACKER_UPGRADE_MULTIPLIER = 1.1;
const TOWER_UPGRADE_MULTIPLIER = 1.2;
const MAX_TOWER_UPGRADES = 2;
const STATS_STORAGE_KEY = "bline-tower-wars-match-stats";
const MATCH_STATE_STORAGE_KEY = "line-tower-wars-active-match";
const TOWER_CONE_HALF_ANGLE_RAD = (65 * Math.PI) / 180;
const TOWER_CONE_HALF_ANGLE_COS = Math.cos(TOWER_CONE_HALF_ANGLE_RAD);
const LOGICAL_CANVAS_WIDTH = 420;
const LOGICAL_CANVAS_HEIGHT = 760;

const towerDefs = [
  { id: "violet", name: "Violet", cost: 2, damage: 2, range: 0.378, fireRate: 0.85, color: "#7c3aed" },
  { id: "yellow", name: "Yellow", cost: 5, damage: 2, range: 0.473, fireRate: 0.95, color: "#eab308" },
  { id: "red", name: "Red", cost: 7, damage: 3, range: 0.434, fireRate: 1.05, color: "#dc2626" },
  { id: "green", name: "Green", cost: 9, damage: 4, range: 0.529, fireRate: 1.15, color: "#22c55e" },
  { id: "orange", name: "Orange", cost: 13, damage: 5, range: 0.492, fireRate: 1.25, color: "#f97316" }
];
const towerSpritePaths = {
  violet: "assets/towers/violet.png",
  yellow: "assets/towers/yellow.png",
  red: "assets/towers/red.png",
  green: "assets/towers/green.png",
  orange: "assets/towers/orange.png"
};

const towerSprites = {};
for (const tower of towerDefs) {
  const img = new Image();
  img.src = towerSpritePaths[tower.id];
  towerSprites[tower.id] = img;
}

const attackerDefs = [
  { id: "imp", name: "Imp", cost: 2, hp: 20, speed: 0.1, color: "#1f2937" },
  { id: "runner", name: "Runner", cost: 3, hp: 18, speed: 0.14, color: "#d97706" },
  { id: "brute", name: "Brute", cost: 4, hp: 36, speed: 0.075, color: "#15803d" },
  { id: "wisp", name: "Wisp", cost: 5, hp: 28, speed: 0.12, color: "#8b5cf6" },
  { id: "tank", name: "Tank", cost: 6, hp: 52, speed: 0.062, color: "#0f766e" }
];
const attackerSpriteConfig = {
  imp: {
    path: "assets/creeps/imp-sprite-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    frames: 3,
    fps: 6
  },
  runner: {
    path: "assets/creeps/runner-sprite-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    frames: 3,
    fps: 6
  },
  brute: {
    path: "assets/creeps/brute-sprite-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    frames: 3,
    fps: 6
  },
  wisp: {
    path: "assets/creeps/wisp-sprite-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    frames: 3,
    fps: 6
  },
  tank: {
    path: "assets/creeps/tank-sprite-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    frames: 3,
    fps: 6
  }
};

const attackerSprites = {};
for (const attackerId of Object.keys(attackerSpriteConfig)) {
  const cfg = attackerSpriteConfig[attackerId];
  const img = new Image();
  img.src = cfg.path;
  attackerSprites[attackerId] = img;
}

const menuScreenEl = document.getElementById("menu-screen");
const recordsScreenEl = document.getElementById("records-screen");
const gameScreenEl = document.getElementById("game-screen");
const appShellEl = document.getElementById("app-shell");
const orientationNoticeEl = document.getElementById("orientation-notice");
const playMatchBtnEl = document.getElementById("play-match-btn");
const resumeMatchBtnEl = document.getElementById("resume-match-btn");
const openRecordsBtnEl = document.getElementById("open-records-btn");
const recordsBackBtnEl = document.getElementById("records-back-btn");
const menuMetaEl = document.getElementById("menu-meta");
const recordsUpdatedAtEl = document.getElementById("records-updated-at");
const recordsOverviewEl = document.getElementById("records-overview");
const recordsMilestonesEl = document.getElementById("records-milestones");
const recordsTopAttackersEl = document.getElementById("records-top-attackers");
const recordsTopTowersEl = document.getElementById("records-top-towers");
const playerScoreEl = document.getElementById("player-score");
const aiScoreEl = document.getElementById("ai-score");
const waveNumberEl = document.getElementById("wave-number");
const playerManaEl = document.getElementById("player-mana");
const phaseLabelEl = document.getElementById("phase-label");
const phaseTimerEl = document.getElementById("phase-timer");
const waveProgressFillEl = document.getElementById("wave-progress-fill");
const statusTextEl = document.getElementById("status-text");
const replayBtnEl = document.getElementById("replay-btn");
const pauseBtnEl = document.getElementById("pause-btn");
const battleSkipBtnEl = document.getElementById("battle-skip-btn");
const shopOverlayEl = document.getElementById("shop-overlay");
const matchEndOverlayEl = document.getElementById("match-end-overlay");
const matchResultTitleEl = document.getElementById("match-result-title");
const matchResultCopyEl = document.getElementById("match-result-copy");
const matchSummaryGridEl = document.getElementById("match-summary-grid");
const matchNextGoalEl = document.getElementById("match-next-goal");
const matchPlayAgainBtnEl = document.getElementById("match-play-again-btn");
const matchRecordsBtnEl = document.getElementById("match-records-btn");
const matchHomeBtnEl = document.getElementById("match-home-btn");
const shopTitleEl = document.getElementById("shop-title");
const shopUnitNameEl = document.getElementById("shop-unit-name");
const shopCurrentUnitEl = document.getElementById("shop-current-unit");
const shopNextUnitEl = document.getElementById("shop-next-unit");
const shopLevelCurrentEl = document.getElementById("shop-level-current");
const shopLevelNextEl = document.getElementById("shop-level-next");
const shopDescriptionEl = document.getElementById("shop-description");
const shopUpgradeBtnEl = document.getElementById("shop-upgrade-btn");
const shopStartBtnEl = document.getElementById("shop-start-btn");

const enemySlotsEl = document.getElementById("enemy-slots");
const playerSlotsEl = document.getElementById("player-slots");
const towerPanelEl = document.getElementById("tower-panel");
const attackerPanelEl = document.getElementById("attacker-panel");
const arenaZoneEl = document.querySelector(".arena-zone");
const arenaDropZoneEl = document.getElementById("arena-drop-zone");
const progressBtnEl = document.getElementById("progress-btn");
const homeBtnEl = document.getElementById("home-btn");

const canvas = document.getElementById("arena-canvas");
const ctx = canvas.getContext("2d");
const BATTLEFIELD_BOTTOM_TRIM_PX = 10;
const FIELD_SHIFT_Y = BATTLEFIELD_BOTTOM_TRIM_PX / LOGICAL_CANVAS_HEIGHT;
const prefersTouchInput = window.matchMedia("(pointer: coarse)").matches || ("ontouchstart" in window);

const state = {
  screen: "menu",
  waveNumber: 1,
  phase: "banner",
  phaseTimer: PREP_SECONDS,
  playerMana: 9,
  aiMana: 9,
  playerScore: 0,
  aiScore: 0,
  gameOver: false,
  paused: false,
  winnerText: "",
  playerTowers: [null, null, null, null, null],
  aiTowers: [null, null, null, null, null],
  playerQueue: [],
  aiQueue: [],
  playerQueueCounts: {},
  attackersPlayer: [],
  attackersAI: [],
  projectiles: [],
  towerFlashes: [],
  deathParticles: [],
  nextUnitId: 1,
  nextProjectileId: 1,
  aiDraftDone: false,
  animationClock: 0,
  roundBannerTimer: ROUND_BANNER_SECONDS,
  roundBannerText: "Round 1",
  battleSkipUsedThisRound: false,
  shopSelectionType: "attacker",
  shopSelectionId: attackerDefs[0].id,
  matchWinner: "",
  hasActiveMatch: false,
  matchSummary: null,
  matchStats: null,
  playerTowerUpgrades: Object.fromEntries(towerDefs.map((tower) => [tower.id, 0])),
  playerAttackerUpgrades: Object.fromEntries(attackerDefs.map((attacker) => [attacker.id, 0])),
  matchUsage: {
    player: {
      towers: Object.fromEntries(towerDefs.map((tower) => [tower.id, false])),
      attackers: Object.fromEntries(attackerDefs.map((attacker) => [attacker.id, false]))
    },
    ai: {
      towers: Object.fromEntries(towerDefs.map((tower) => [tower.id, false])),
      attackers: Object.fromEntries(attackerDefs.map((attacker) => [attacker.id, false]))
    }
  },
  soundCooldowns: {
    violet: 0,
    yellow: 0,
    red: 0,
    green: 0,
    orange: 0
  }
};

let activeDragPayload = "";
let selectedTowerId = null;
let audioCtx = null;
let audioUnlocked = false;
let lastAppHiddenAt = null;
let wasPausedBeforeBackground = false;
let laneBackgroundCanvas = null;

const laneStarts = {
  player: { x: 0.5, y: 0.93 - FIELD_SHIFT_Y },
  ai: { x: 0.5, y: 0.07 }
};

const laneEnds = {
  player: { x: 0.5, y: 0.11 - FIELD_SHIFT_Y },
  ai: { x: 0.5, y: 0.89 - FIELD_SHIFT_Y }
};

const towerPosPlayer = [
  { x: 0.34, y: 0.77 + FIELD_SHIFT_Y },
  { x: 0.66, y: 0.77 + FIELD_SHIFT_Y },
  { x: 0.22, y: 0.9 + FIELD_SHIFT_Y },
  { x: 0.5, y: 0.9 + FIELD_SHIFT_Y },
  { x: 0.78, y: 0.9 + FIELD_SHIFT_Y }
];

const towerPosAI = [
  { x: 0.34, y: 0.23 - FIELD_SHIFT_Y },
  { x: 0.66, y: 0.23 - FIELD_SHIFT_Y },
  { x: 0.22, y: 0.1 - FIELD_SHIFT_Y },
  { x: 0.5, y: 0.1 - FIELD_SHIFT_Y },
  { x: 0.78, y: 0.1 - FIELD_SHIFT_Y }
];

const slotPosPlayer = towerPosPlayer;
const slotPosAI = towerPosAI;
let persistentStats = createEmptyPersistentStats();
let statsSaveTimeout = null;

function updateViewportHeight() {
  const height = window.innerHeight || document.documentElement.clientHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function resizeBattlefieldFrame() {
  if (state.screen !== "game") {
    return;
  }

  const zoneRect = arenaZoneEl.getBoundingClientRect();
  if (!zoneRect.width || !zoneRect.height) {
    return;
  }

  const aspect = LOGICAL_CANVAS_WIDTH / LOGICAL_CANVAS_HEIGHT;
  const maxWidth = Math.max(220, zoneRect.width);
  const maxHeight = Math.max(260, zoneRect.height);
  let frameWidth = maxWidth;
  let frameHeight = frameWidth / aspect;

  if (frameHeight > maxHeight) {
    frameHeight = maxHeight;
    frameWidth = frameHeight * aspect;
  }

  arenaDropZoneEl.style.width = `${Math.round(frameWidth)}px`;
  arenaDropZoneEl.style.height = `${Math.round(frameHeight)}px`;
}

function updateOrientationNotice() {
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  orientationNoticeEl.classList.toggle("hidden", !prefersTouchInput || !isPortrait);
}

async function lockLandscapeOrientation() {
  if (prefersTouchInput && screen.orientation?.lock) {
    try {
      await screen.orientation.lock("landscape");
    } catch {
    }
  }

  updateOrientationNotice();
}

function preventBrowserGestures(event) {
  if (!appShellEl.contains(event.target)) {
    return;
  }
  event.preventDefault();
}

function createOffscreenCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  return offscreen;
}

function getCapacitorPlugin(pluginName) {
  return window.Capacitor?.Plugins?.[pluginName] || null;
}

async function triggerPlacementHaptic(type) {
  const haptics = getCapacitorPlugin("Haptics");
  try {
    if (haptics) {
      if (type === "impact") {
        await haptics.impact({ style: "MEDIUM" });
        return;
      }
      await haptics.notification({ type: type.toUpperCase() });
      return;
    }
  } catch {
  }

  if (!navigator.vibrate) {
    return;
  }

  if (type === "impact") {
    navigator.vibrate(14);
  } else if (type === "success") {
    navigator.vibrate([12, 28, 16]);
  } else if (type === "error") {
    navigator.vibrate([24, 40, 24]);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function createCountMap(defs) {
  return Object.fromEntries(defs.map((def) => [def.id, 0]));
}

function createEmptyProfileStats() {
  return {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    currentWinStreak: 0,
    bestWinStreak: 0
  };
}

function createEmptyMatchStats() {
  return {
    towersPlaced: 0,
    attackersQueued: 0,
    upgradesBought: 0
  };
}

function createEmptyPersistentStats() {
  return {
    updatedAt: null,
    profile: createEmptyProfileStats(),
    unitScores: {
      total: createCountMap(attackerDefs),
      player: createCountMap(attackerDefs),
      ai: createCountMap(attackerDefs)
    },
    towerKills: {
      total: createCountMap(towerDefs),
      player: createCountMap(towerDefs),
      ai: createCountMap(towerDefs)
    },
    matchUsage: {
      attackers: {
        used: createCountMap(attackerDefs),
        winningTeamUsed: createCountMap(attackerDefs)
      },
      towers: {
        used: createCountMap(towerDefs),
        winningTeamUsed: createCountMap(towerDefs)
      }
    }
  };
}

function normalizePersistentStats(raw) {
  const stats = createEmptyPersistentStats();
  if (!raw || typeof raw !== "object") {
    return stats;
  }

  stats.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : null;
  stats.profile.matchesPlayed = Number.isFinite(raw.profile?.matchesPlayed) ? raw.profile.matchesPlayed : 0;
  stats.profile.wins = Number.isFinite(raw.profile?.wins) ? raw.profile.wins : 0;
  stats.profile.losses = Number.isFinite(raw.profile?.losses) ? raw.profile.losses : 0;
  stats.profile.draws = Number.isFinite(raw.profile?.draws) ? raw.profile.draws : 0;
  stats.profile.currentWinStreak = Number.isFinite(raw.profile?.currentWinStreak) ? raw.profile.currentWinStreak : 0;
  stats.profile.bestWinStreak = Number.isFinite(raw.profile?.bestWinStreak) ? raw.profile.bestWinStreak : 0;

  for (const scope of ["total", "player", "ai"]) {
    for (const attacker of attackerDefs) {
      const value = raw.unitScores?.[scope]?.[attacker.id];
      stats.unitScores[scope][attacker.id] = Number.isFinite(value) ? value : 0;
    }
    for (const tower of towerDefs) {
      const value = raw.towerKills?.[scope]?.[tower.id];
      stats.towerKills[scope][tower.id] = Number.isFinite(value) ? value : 0;
    }
  }

  for (const attacker of attackerDefs) {
    const usedValue = raw.matchUsage?.attackers?.used?.[attacker.id];
    const winningValue = raw.matchUsage?.attackers?.winningTeamUsed?.[attacker.id];
    stats.matchUsage.attackers.used[attacker.id] = Number.isFinite(usedValue) ? usedValue : 0;
    stats.matchUsage.attackers.winningTeamUsed[attacker.id] = Number.isFinite(winningValue) ? winningValue : 0;
  }

  for (const tower of towerDefs) {
    const usedValue = raw.matchUsage?.towers?.used?.[tower.id];
    const winningValue = raw.matchUsage?.towers?.winningTeamUsed?.[tower.id];
    stats.matchUsage.towers.used[tower.id] = Number.isFinite(usedValue) ? usedValue : 0;
    stats.matchUsage.towers.winningTeamUsed[tower.id] = Number.isFinite(winningValue) ? winningValue : 0;
  }

  return stats;
}

async function loadPersistentStats() {
  try {
    const response = await fetch("./stats", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Stats load failed: ${response.status}`);
    }
    persistentStats = normalizePersistentStats(await response.json());
    return;
  } catch {
  }

  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) {
      persistentStats = normalizePersistentStats(JSON.parse(raw));
    }
  } catch {
    persistentStats = createEmptyPersistentStats();
  }

  refreshMetaUI();
  refreshAllUI();
}

async function persistStatsNow() {
  persistentStats.updatedAt = new Date().toISOString();
  const body = JSON.stringify(persistentStats, null, 2);

  try {
    const response = await fetch("./stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    if (!response.ok) {
      throw new Error(`Stats save failed: ${response.status}`);
    }
    return;
  } catch {
  }

  try {
    localStorage.setItem(STATS_STORAGE_KEY, body);
  } catch {
  }
}

function queueStatsSave() {
  if (statsSaveTimeout) {
    clearTimeout(statsSaveTimeout);
  }
  statsSaveTimeout = setTimeout(() => {
    statsSaveTimeout = null;
    persistStatsNow();
  }, 150);
}

function saveMatchStateNow() {
  if (!state.hasActiveMatch || state.gameOver) {
    localStorage.removeItem(MATCH_STATE_STORAGE_KEY);
    return;
  }

  const snapshot = {
    waveNumber: state.waveNumber,
    phase: state.phase,
    phaseTimer: state.phaseTimer,
    playerMana: state.playerMana,
    aiMana: state.aiMana,
    playerScore: state.playerScore,
    aiScore: state.aiScore,
    paused: state.paused,
    winnerText: state.winnerText,
    playerTowers: state.playerTowers,
    aiTowers: state.aiTowers,
    playerQueue: state.playerQueue,
    aiQueue: state.aiQueue,
    playerQueueCounts: state.playerQueueCounts,
    attackersPlayer: state.attackersPlayer,
    attackersAI: state.attackersAI,
    projectiles: state.projectiles,
    towerFlashes: state.towerFlashes,
    deathParticles: state.deathParticles,
    nextUnitId: state.nextUnitId,
    nextProjectileId: state.nextProjectileId,
    aiDraftDone: state.aiDraftDone,
    animationClock: state.animationClock,
    roundBannerTimer: state.roundBannerTimer,
    roundBannerText: state.roundBannerText,
    battleSkipUsedThisRound: state.battleSkipUsedThisRound,
    shopSelectionType: state.shopSelectionType,
    shopSelectionId: state.shopSelectionId,
    matchWinner: state.matchWinner,
    matchSummary: state.matchSummary,
    matchStats: state.matchStats,
    playerTowerUpgrades: state.playerTowerUpgrades,
    playerAttackerUpgrades: state.playerAttackerUpgrades,
    matchUsage: state.matchUsage,
    soundCooldowns: state.soundCooldowns,
    hasActiveMatch: state.hasActiveMatch
  };

  try {
    localStorage.setItem(MATCH_STATE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
  }
}

function restoreSavedMatchState() {
  try {
    const raw = localStorage.getItem(MATCH_STATE_STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    Object.assign(state, snapshot);
    state.gameOver = false;
    state.hasActiveMatch = true;
    state.paused = true;
    refreshAllUI();
    return true;
  } catch {
    return false;
  }
}

function clearSavedMatchState() {
  try {
    localStorage.removeItem(MATCH_STATE_STORAGE_KEY);
  } catch {
  }
}

function getProfileStats() {
  return persistentStats.profile || createEmptyProfileStats();
}

function sumMapValues(map) {
  return Object.values(map || {}).reduce((sum, value) => sum + value, 0);
}

function formatUpdatedAt(isoString) {
  if (!isoString) {
    return "No saved records yet.";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "No saved records yet.";
  }

  return `Updated ${date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })}`;
}

function getWinRate(profile) {
  if (profile.matchesPlayed === 0) {
    return 0;
  }
  return Math.round((profile.wins / profile.matchesPlayed) * 100);
}

function getTopEntries(recordMap, defs, count) {
  return defs
    .map((def) => ({
      name: def.name,
      value: recordMap?.[def.id] || 0
    }))
    .sort((a, b) => {
      if (b.value !== a.value) {
        return b.value - a.value;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, count);
}

function getMilestones(profile) {
  const scoredUnits = sumMapValues(persistentStats.unitScores.player);
  const towerKills = sumMapValues(persistentStats.towerKills.player);

  return [
    {
      label: "Play 3 matches",
      progress: `${Math.min(profile.matchesPlayed, 3)}/3`,
      done: profile.matchesPlayed >= 3
    },
    {
      label: "Reach a 2-match win streak",
      progress: `${Math.min(profile.bestWinStreak, 2)}/2`,
      done: profile.bestWinStreak >= 2
    },
    {
      label: "Score 10 attackers",
      progress: `${Math.min(scoredUnits, 10)}/10`,
      done: scoredUnits >= 10
    },
    {
      label: "Destroy 25 enemy units with towers",
      progress: `${Math.min(towerKills, 25)}/25`,
      done: towerKills >= 25
    }
  ];
}

function getNextGoalText(profile) {
  const milestones = getMilestones(profile);
  const nextMilestone = milestones.find((item) => !item.done);
  if (nextMilestone) {
    return `Next goal: ${nextMilestone.label} (${nextMilestone.progress}).`;
  }
  return "Next goal: defend your best streak and keep improving your records.";
}

function renderStatCards(container, items) {
  container.innerHTML = items.map((item) => `
    <article class="stat-card">
      <strong>${item.value}</strong>
      <span>${item.label}</span>
    </article>
  `).join("");
}

function renderRankingRows(container, items, emptyLabel) {
  if (!items.some((item) => item.value > 0)) {
    container.innerHTML = `<div class="ranking-row"><strong>${emptyLabel}</strong><span>Complete a match to start filling this board.</span></div>`;
    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div class="ranking-row">
      <strong>#${index + 1} ${item.name}</strong>
      <span>${item.value} lifetime impact</span>
    </div>
  `).join("");
}

function refreshMenuUI() {
  const profile = getProfileStats();
  const hasResume = state.hasActiveMatch && !state.gameOver;
  playMatchBtnEl.textContent = hasResume ? "Start New Match" : "Play Match";
  resumeMatchBtnEl.classList.toggle("hidden", !hasResume);
  menuMetaEl.textContent = profile.matchesPlayed > 0
    ? `${profile.matchesPlayed} matches played · ${profile.wins} wins · Best streak ${profile.bestWinStreak}`
    : "No records yet. Your first match will begin a fresh commander profile.";
}

function refreshRecordsUI() {
  const profile = getProfileStats();
  recordsUpdatedAtEl.textContent = formatUpdatedAt(persistentStats.updatedAt);
  renderStatCards(recordsOverviewEl, [
    { label: "Matches Played", value: profile.matchesPlayed },
    { label: "Wins", value: profile.wins },
    { label: "Best Win Streak", value: profile.bestWinStreak },
    { label: "Win Rate", value: `${getWinRate(profile)}%` }
  ]);

  recordsMilestonesEl.innerHTML = getMilestones(profile).map((item) => `
    <div class="milestone-row">
      <strong>${item.done ? "Completed" : "In Progress"} · ${item.label}</strong>
      <span>${item.progress}</span>
    </div>
  `).join("");

  renderRankingRows(recordsTopAttackersEl, getTopEntries(persistentStats.unitScores.player, attackerDefs, 3), "Top attackers are waiting");
  renderRankingRows(recordsTopTowersEl, getTopEntries(persistentStats.towerKills.player, towerDefs, 3), "Top towers are waiting");
}

function refreshMetaUI() {
  refreshMenuUI();
  refreshRecordsUI();
}

function setScreen(screen) {
  state.screen = screen;
  menuScreenEl.classList.toggle("hidden", screen !== "menu");
  recordsScreenEl.classList.toggle("hidden", screen !== "records");
  gameScreenEl.classList.toggle("hidden", screen !== "game");
  refreshMenuUI();
  refreshRecordsUI();
  updateOrientationNotice();
  requestAnimationFrame(resizeBattlefieldFrame);
}

function recordUnitScore(attackerId, owner) {
  persistentStats.unitScores.total[attackerId] += 1;
  persistentStats.unitScores[owner][attackerId] += 1;
  queueStatsSave();
}

function recordTowerKill(towerId, owner) {
  persistentStats.towerKills.total[towerId] += 1;
  persistentStats.towerKills[owner][towerId] += 1;
  queueStatsSave();
}

function markMatchUsage(kind, id, owner) {
  state.matchUsage[owner][kind][id] = true;
}

function commitMatchUsageStats() {
  for (const owner of ["player", "ai"]) {
    const isWinningSide = state.matchWinner === owner;

    for (const attacker of attackerDefs) {
      if (!state.matchUsage[owner].attackers[attacker.id]) {
        continue;
      }
      persistentStats.matchUsage.attackers.used[attacker.id] += 1;
      if (isWinningSide) {
        persistentStats.matchUsage.attackers.winningTeamUsed[attacker.id] += 1;
      }
    }

    for (const tower of towerDefs) {
      if (!state.matchUsage[owner].towers[tower.id]) {
        continue;
      }
      persistentStats.matchUsage.towers.used[tower.id] += 1;
      if (isWinningSide) {
        persistentStats.matchUsage.towers.winningTeamUsed[tower.id] += 1;
      }
    }
  }

  queueStatsSave();
}

function getAttackerDef(attackerId) {
  return attackerDefs.find((item) => item.id === attackerId) || null;
}

function getTowerDef(towerId) {
  return towerDefs.find((item) => item.id === towerId) || null;
}

function getPlayerUpgradeLevel(attackerId) {
  return 1 + (state.playerAttackerUpgrades[attackerId] || 0);
}

function getPlayerTowerUpgradeLevel(towerId) {
  return 1 + (state.playerTowerUpgrades[towerId] || 0);
}

function createTowerInstance(def, owner = "player") {
  const upgradeMultiplier = owner === "player"
    ? Math.pow(TOWER_UPGRADE_MULTIPLIER, state.playerTowerUpgrades[def.id] || 0)
    : 1;
  return {
    ...def,
    damage: def.damage * upgradeMultiplier,
    range: def.range * upgradeMultiplier,
    fireRate: def.fireRate / upgradeMultiplier,
    cooldown: 0
  };
}

function towerPowerScore(tower) {
  if (!tower) {
    return 0;
  }
  return tower.damage * tower.range / tower.fireRate;
}

function resetMatch() {
  state.waveNumber = 1;
  state.phase = "banner";
  state.phaseTimer = PREP_SECONDS;
  state.playerMana = 9;
  state.aiMana = 9;
  state.playerScore = 0;
  state.aiScore = 0;
  state.gameOver = false;
  state.paused = false;
  state.winnerText = "";
  state.playerTowers = [null, null, null, null, null];
  state.aiTowers = [null, null, null, null, null];
  state.playerQueue = [];
  state.aiQueue = [];
  state.playerQueueCounts = {};
  state.attackersPlayer = [];
  state.attackersAI = [];
  state.projectiles = [];
  state.towerFlashes = [];
  state.deathParticles = [];
  state.nextUnitId = 1;
  state.nextProjectileId = 1;
  state.aiDraftDone = false;
  state.animationClock = 0;
  state.roundBannerTimer = ROUND_BANNER_SECONDS;
  state.roundBannerText = "Round 1";
  state.battleSkipUsedThisRound = false;
  state.shopSelectionType = "attacker";
  state.shopSelectionId = attackerDefs[0].id;
  state.matchWinner = "";
  state.hasActiveMatch = true;
  state.matchSummary = null;
  state.matchStats = createEmptyMatchStats();
  state.playerTowerUpgrades = Object.fromEntries(towerDefs.map((tower) => [tower.id, 0]));
  state.playerAttackerUpgrades = Object.fromEntries(attackerDefs.map((attacker) => [attacker.id, 0]));
  state.matchUsage = {
    player: {
      towers: Object.fromEntries(towerDefs.map((tower) => [tower.id, false])),
      attackers: Object.fromEntries(attackerDefs.map((attacker) => [attacker.id, false]))
    },
    ai: {
      towers: Object.fromEntries(towerDefs.map((tower) => [tower.id, false])),
      attackers: Object.fromEntries(attackerDefs.map((attacker) => [attacker.id, false]))
    }
  };
  state.soundCooldowns.violet = 0;
  state.soundCooldowns.yellow = 0;
  state.soundCooldowns.red = 0;
  state.soundCooldowns.green = 0;
  state.soundCooldowns.orange = 0;

  previousTime = performance.now();
  updateStatus("Round 1 coming up.");
  refreshAllUI();
  pauseBtnEl.textContent = "Pause";
}

function startNewMatch() {
  clearSavedMatchState();
  resetMatch();
  state.paused = false;
  setScreen("game");
  lockLandscapeOrientation();
  refreshAllUI();
}

function createTowerSlots() {
  enemySlotsEl.innerHTML = "";
  playerSlotsEl.innerHTML = "";

  for (let i = 0; i < 5; i += 1) {
    const enemySlot = document.createElement("div");
    enemySlot.className = "tower-slot enemy";
    enemySlot.dataset.slotIndex = String(i);
    enemySlot.style.left = `${slotPosAI[i].x * 100}%`;
    enemySlot.style.top = `${slotPosAI[i].y * 100}%`;
    enemySlotsEl.appendChild(enemySlot);

    const playerSlot = document.createElement("div");
    playerSlot.className = "tower-slot player";
    playerSlot.dataset.slotIndex = String(i);
    playerSlot.style.left = `${slotPosPlayer[i].x * 100}%`;
    playerSlot.style.top = `${slotPosPlayer[i].y * 100}%`;

    playerSlot.addEventListener("dragover", (event) => {
      if (!isPlayerInputAllowed()) {
        return;
      }
      event.preventDefault();
      playerSlot.classList.add("over");
    });

    playerSlot.addEventListener("dragleave", () => {
      playerSlot.classList.remove("over");
    });

    playerSlot.addEventListener("drop", (event) => {
      playerSlot.classList.remove("over");
      if (!isPlayerInputAllowed()) {
        return;
      }

      const payload = event.dataTransfer.getData("text/plain") || activeDragPayload;
      if (!payload.startsWith("tower:")) {
        return;
      }

      event.preventDefault();
      const towerId = payload.split(":")[1];
      placePlayerTower(i, towerId);
      clearSelectedTower();
    });

    playerSlot.addEventListener("click", () => {
      if (!isPlayerInputAllowed() || !selectedTowerId) {
        return;
      }
      placePlayerTower(i, selectedTowerId);
    });

    playerSlotsEl.appendChild(playerSlot);
  }
}

function createCards() {
  towerPanelEl.innerHTML = "";
  attackerPanelEl.innerHTML = "";

  for (const tower of towerDefs.slice().reverse()) {
    const card = document.createElement("div");
    card.className = "card tower";
    card.draggable = !prefersTouchInput;
    card.dataset.towerId = tower.id;
    card.dataset.cost = String(tower.cost);
    card.innerHTML = `
      <img class="tower-icon-card" src="${towerSpritePaths[tower.id]}" alt="${tower.name} tower" />
      <span class="tower-cost">${tower.cost}</span>
    `;
    if (!prefersTouchInput) {
      card.addEventListener("dragstart", (event) => {
        const payload = `tower:${tower.id}`;
        activeDragPayload = payload;
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", payload);
      });
      card.addEventListener("dragend", () => {
        activeDragPayload = "";
      });
    }
    card.addEventListener("click", () => {
      if (state.phase === "shop") {
        state.shopSelectionType = "tower";
        state.shopSelectionId = tower.id;
        refreshAllUI();
        return;
      }
      if (!isPlayerInputAllowed()) {
        return;
      }
      selectedTowerId = selectedTowerId === tower.id ? null : tower.id;
      refreshCardStates();
      updateStatus(selectedTowerId
        ? `Selected ${tower.name}. Tap an empty slot to place it.`
        : "Tower selection cleared.");
    });
    towerPanelEl.appendChild(card);
  }

  for (const attacker of attackerDefs) {
    const card = document.createElement("div");
    card.className = "card attacker";
    card.draggable = !prefersTouchInput;
    card.dataset.attackerId = attacker.id;
    card.dataset.cost = String(attacker.cost);
    if (attackerSpriteConfig[attacker.id]) {
      card.innerHTML = `
        <div class="attacker-icon-frame">
          <img class="attacker-icon-sheet" src="${attackerSpriteConfig[attacker.id].path}" alt="${attacker.name}" />
        </div>
        <span class="attacker-cost">${attacker.cost}</span>
      `;
    } else {
      card.innerHTML = `
        <div class="shape" style="background:${attacker.color}"></div>
        <span class="attacker-cost">${attacker.cost}</span>
      `;
    }
    if (!prefersTouchInput) {
      card.addEventListener("dragstart", (event) => {
        const payload = `attacker:${attacker.id}`;
        activeDragPayload = payload;
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", payload);
      });
      card.addEventListener("dragend", () => {
        activeDragPayload = "";
      });
    }
    card.addEventListener("click", () => {
      if (state.phase === "shop") {
        state.shopSelectionType = "attacker";
        state.shopSelectionId = attacker.id;
        refreshAllUI();
        return;
      }
      if (!isPlayerInputAllowed()) {
        return;
      }
      queuePlayerAttacker(attacker.id);
    });
    attackerPanelEl.appendChild(card);
  }
}

function isPlayerInputAllowed() {
  return state.screen === "game" && !state.gameOver && state.phase === "prep";
}

function placePlayerTower(slotIndex, towerId) {
  const towerDef = towerDefs.find((item) => item.id === towerId);
  if (!towerDef) {
    triggerPlacementHaptic("error");
    return;
  }

  if (state.playerMana < towerDef.cost) {
    updateStatus("Not enough mana for that tower.");
    triggerPlacementHaptic("error");
    return;
  }

  state.playerMana -= towerDef.cost;
  state.playerTowers[slotIndex] = createTowerInstance(towerDef, "player");
  state.matchStats.towersPlaced += 1;
  markMatchUsage("towers", towerId, "player");
  updateStatus(`Placed ${towerDef.name} tower in slot ${slotIndex + 1}.`);
  triggerPlacementHaptic("impact");
  clearSelectedTower();
  refreshAllUI();
}

function queuePlayerAttacker(attackerId) {
  const attacker = attackerDefs.find((item) => item.id === attackerId);
  if (!attacker) {
    triggerPlacementHaptic("error");
    return;
  }
  if (state.playerMana < attacker.cost) {
    updateStatus("Not enough mana for that attacker.");
    triggerPlacementHaptic("error");
    return;
  }

  state.playerMana -= attacker.cost;
  state.playerQueue.push(attacker.id);
  state.playerQueueCounts[attacker.id] = (state.playerQueueCounts[attacker.id] || 0) + 1;
  state.matchStats.attackersQueued += 1;
  markMatchUsage("attackers", attacker.id, "player");
  updateStatus(`${attacker.name} added to next wave queue.`);
  refreshAllUI();
}

function setupArenaDrop() {
  arenaDropZoneEl.addEventListener("dragover", (event) => {
    if (!isPlayerInputAllowed()) {
      return;
    }
    event.preventDefault();
  });

  arenaDropZoneEl.addEventListener("drop", (event) => {
    if (!isPlayerInputAllowed()) {
      return;
    }
    const payload = event.dataTransfer.getData("text/plain") || activeDragPayload;
    if (!payload.startsWith("attacker:")) {
      return;
    }
    event.preventDefault();
    const attackerId = payload.split(":")[1];
    queuePlayerAttacker(attackerId);
  });
}

function clearSelectedTower() {
  selectedTowerId = null;
}

function refreshCardStates() {
  const towerCards = towerPanelEl.querySelectorAll(".card.tower");
  const attackerCards = attackerPanelEl.querySelectorAll(".card.attacker");

  towerCards.forEach((card) => {
    const cost = Number(card.dataset.cost);
    const towerId = card.dataset.towerId;
    const upgraded = (state.playerTowerUpgrades[towerId] || 0) > 0;
    const inShop = state.phase === "shop";
    card.classList.toggle("disabled", !inShop && (!isPlayerInputAllowed() || state.playerMana < cost));
    card.classList.toggle("selected", inShop
      ? state.shopSelectionType === "tower" && state.shopSelectionId === towerId
      : selectedTowerId === towerId);
    card.classList.toggle("shop-mode", inShop);
    card.classList.toggle("upgraded", upgraded);
  });

  attackerCards.forEach((card) => {
    const cost = Number(card.dataset.cost);
    const attackerId = card.dataset.attackerId;
    const queued = state.playerQueueCounts[attackerId] || 0;
    const upgraded = (state.playerAttackerUpgrades[attackerId] || 0) > 0;
    const inShop = state.phase === "shop";
    card.classList.toggle("disabled", !inShop && (!isPlayerInputAllowed() || state.playerMana < cost));
    card.classList.toggle("queued", !inShop && queued > 0);
    card.classList.toggle("selected", inShop && state.shopSelectionId === attackerId);
    card.classList.toggle("shop-mode", inShop);
    card.classList.toggle("upgraded", upgraded);
    card.dataset.queued = queued > 0 ? `x${queued}` : "";
  });
}

function refreshTowerSlots() {
  const enemySlots = enemySlotsEl.querySelectorAll(".tower-slot");
  const playerSlots = playerSlotsEl.querySelectorAll(".tower-slot");

  const towerMarkup = (tower) => {
    if (!tower) {
      return "";
    }
    return `<div class="slot-tower">
      <img class="tower-icon-slot" src="${towerSpritePaths[tower.id]}" alt="${tower.name} tower" />
    </div>`;
  };

  for (let i = 0; i < 5; i += 1) {
    const playerSlot = playerSlots[i];
    const playerTower = state.playerTowers[i];
    playerSlot.innerHTML = playerTower ? towerMarkup(playerTower) : `<span>${i + 1}</span>`;
    playerSlot.classList.toggle("filled", !!playerTower);
    playerSlot.classList.toggle("placement-target", !!selectedTowerId && !playerTower && isPlayerInputAllowed());

    const enemySlot = enemySlots[i];
    const aiTower = state.aiTowers[i];
    enemySlot.innerHTML = aiTower ? towerMarkup(aiTower) : "";
    enemySlot.classList.toggle("filled", !!aiTower);
  }
}

function refreshHUD() {
  playerScoreEl.textContent = String(state.playerScore);
  aiScoreEl.textContent = String(state.aiScore);
  waveNumberEl.textContent = String(state.waveNumber);
  playerManaEl.textContent = String(state.playerMana);
  if (state.phase === "prep") {
    phaseLabelEl.textContent = "Prep";
  } else if (state.phase === "battle") {
    phaseLabelEl.textContent = "Battle";
  } else if (state.phase === "shop") {
    phaseLabelEl.textContent = "Shop";
  } else {
    phaseLabelEl.textContent = "Round";
  }
  phaseLabelEl.classList.toggle("prep", state.phase === "prep");
  phaseLabelEl.classList.toggle("battle", state.phase === "battle");
  phaseTimerEl.textContent = state.phase === "prep" ? state.phaseTimer.toFixed(1) : "--";

  if (state.phase === "prep") {
    const ratio = clamp(state.phaseTimer / PREP_SECONDS, 0, 1);
    waveProgressFillEl.style.transform = `scaleY(${ratio})`;
  } else {
    waveProgressFillEl.style.transform = "scaleY(1)";
  }

  const canSkipToBattle = !state.gameOver && !state.paused && state.phase === "prep" && !state.battleSkipUsedThisRound;
  battleSkipBtnEl.disabled = !canSkipToBattle;
  battleSkipBtnEl.hidden = state.screen !== "game" || !canSkipToBattle;
  pauseBtnEl.textContent = state.paused ? "Resume" : "Pause";
}

function refreshShopUI() {
  // Between-round upgrade flow is disabled for faster-paced matches.
  shopOverlayEl.classList.add("hidden");
}

function refreshMatchEndOverlay() {
  const showOverlay = state.gameOver;
  matchEndOverlayEl.classList.toggle("hidden", !showOverlay);
  if (!showOverlay) {
    return;
  }
  const summary = state.matchSummary || {
    title: "Match Complete",
    copy: state.winnerText,
    stats: [],
    nextGoal: getNextGoalText(getProfileStats())
  };
  matchResultTitleEl.textContent = summary.title;
  matchResultCopyEl.textContent = summary.copy;
  matchSummaryGridEl.innerHTML = summary.stats.map((item) => `
    <div class="match-stat">
      <strong>${item.value}</strong>
      <span>${item.label}</span>
    </div>
  `).join("");
  matchNextGoalEl.textContent = summary.nextGoal;
}

function refreshAllUI() {
  refreshHUD();
  refreshTowerSlots();
  refreshCardStates();
  refreshShopUI();
  refreshMatchEndOverlay();
  refreshMetaUI();
}

function registerNativeAppLifecycle() {
  const appPlugin = getCapacitorPlugin("App");
  if (!appPlugin?.addListener) {
    return;
  }

  appPlugin.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) {
      wasPausedBeforeBackground = state.paused;
      if (state.hasActiveMatch && !state.gameOver) {
        state.paused = true;
        saveMatchStateNow();
        queueStatsSave();
      }
      return;
    }

    previousTime = performance.now();
    if (state.hasActiveMatch && !state.gameOver) {
      state.paused = wasPausedBeforeBackground;
    }
    updateViewportHeight();
    resizeBattlefieldFrame();
    lockLandscapeOrientation();
    resumeAudioAfterBackground();
    refreshAllUI();
  });
}

function updateStatus(text) {
  statusTextEl.textContent = text;
}

function makeAttacker(owner, attackerId, sequenceOffset) {
  const def = getAttackerDef(attackerId);
  const id = state.nextUnitId;
  state.nextUnitId += 1;
  const fanSeed = Math.random() * 2 - 1;
  const upgradeMultiplier = owner === "player"
    ? Math.pow(ATTACKER_UPGRADE_MULTIPLIER, state.playerAttackerUpgrades[attackerId] || 0)
    : 1;

  return {
    id,
    owner,
    defId: def.id,
    hp: def.hp * upgradeMultiplier,
    maxHp: def.hp * upgradeMultiplier,
    speed: def.speed * upgradeMultiplier,
    color: def.color,
    progress: -sequenceOffset * 0.035,
    fanSeed,
    isDefeated: false
  };
}

function launchWave() {
  state.phase = "battle";
  state.aiDraftDone = false;
  clearSelectedTower();

  state.attackersPlayer = state.playerQueue.map((attackerId, idx) => makeAttacker("player", attackerId, idx));
  state.attackersAI = state.aiQueue.map((attackerId, idx) => makeAttacker("ai", attackerId, idx));
  state.projectiles = [];
  state.towerFlashes = [];
  state.deathParticles = [];

  state.playerQueue = [];
  state.aiQueue = [];
  state.playerQueueCounts = {};

  updateStatus("Wave launched. Towers firing.");
  refreshAllUI();
}

window.addEventListener("resize", updateViewportHeight);
window.addEventListener("orientationchange", () => {
  updateViewportHeight();
  lockLandscapeOrientation();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    lastAppHiddenAt = performance.now();
    wasPausedBeforeBackground = state.paused;
    if (state.hasActiveMatch && !state.gameOver) {
      state.paused = true;
      saveMatchStateNow();
      queueStatsSave();
    }
    return;
  }

  updateViewportHeight();
  lockLandscapeOrientation();
  previousTime = performance.now();
  if (state.hasActiveMatch && !state.gameOver) {
    state.paused = wasPausedBeforeBackground;
    saveMatchStateNow();
  }
  resumeAudioAfterBackground();
});
document.addEventListener("touchmove", preventBrowserGestures, { passive: false });
document.addEventListener("contextmenu", preventBrowserGestures);
document.addEventListener("pointerdown", unlockAudioFromGesture, { passive: true });

function beginPrepPhase() {
  state.phase = "prep";
  state.phaseTimer = PREP_SECONDS;
  state.aiDraftDone = false;
  clearSelectedTower();

  prepareAIMoves();
  refreshAllUI();
  updateStatus(`Round ${state.waveNumber} prep. Queue attackers and place towers.`);
}

function beginRoundBanner() {
  state.phase = "banner";
  state.roundBannerTimer = ROUND_BANNER_SECONDS;
  state.roundBannerText = `Round ${state.waveNumber}`;
  state.battleSkipUsedThisRound = false;
  clearSelectedTower();
  refreshAllUI();
  updateStatus(`${state.roundBannerText} is about to begin.`);
}

function openRoundShop() {
  const gain = 9 + state.waveNumber;
  state.playerMana = clamp(state.playerMana + gain, 0, MANA_CAP);
  state.aiMana = clamp(state.aiMana + gain, 0, MANA_CAP);
  state.waveNumber += 1;
  beginRoundBanner();
  updateStatus(`Round ${state.waveNumber} begins soon.`);
}

function buildMatchSummary() {
  const margin = state.playerScore - state.aiScore;
  const profile = getProfileStats();
  let title = "Battle Report";
  let copy = `Final score ${state.playerScore} to ${state.aiScore}.`;

  if (state.matchWinner === "player") {
    title = "Victory";
    copy = margin > 1
      ? `You secured the lane ${state.playerScore} to ${state.aiScore} and closed the match with room to spare.`
      : `You edged out the AI ${state.playerScore} to ${state.aiScore} in a tight final round.`;
  } else if (state.matchWinner === "ai") {
    title = "Defeat";
    copy = `The AI held the lane ${state.aiScore} to ${state.playerScore}. Review your records, then adjust your next build.`;
  } else {
    title = "Draw";
    copy = `Both commanders finished level at ${state.playerScore}. A sharper lane plan can swing the rematch.`;
  }

  return {
    title,
    copy,
    stats: [
      { label: "Scoreline", value: `${state.playerScore}-${state.aiScore}` },
      { label: "Towers Placed", value: state.matchStats.towersPlaced },
      { label: "Attackers Queued", value: state.matchStats.attackersQueued },
      { label: "Career Matches", value: profile.matchesPlayed }
    ],
    nextGoal: getNextGoalText(profile)
  };
}

function finishMatch() {
  state.phase = "gameover";
  state.gameOver = true;
  if (state.playerScore === state.aiScore) {
    state.matchWinner = "draw";
    state.winnerText = "Draw match.";
  } else if (state.playerScore > state.aiScore) {
    state.matchWinner = "player";
    state.winnerText = "Player wins the match.";
  } else {
    state.matchWinner = "ai";
    state.winnerText = "AI wins the match.";
  }

  const profile = getProfileStats();
  profile.matchesPlayed += 1;
  if (state.matchWinner === "player") {
    profile.wins += 1;
    profile.currentWinStreak += 1;
    profile.bestWinStreak = Math.max(profile.bestWinStreak, profile.currentWinStreak);
  } else if (state.matchWinner === "ai") {
    profile.losses += 1;
    profile.currentWinStreak = 0;
  } else {
    profile.draws += 1;
    profile.currentWinStreak = 0;
  }

  commitMatchUsageStats();
  queueStatsSave();
  state.hasActiveMatch = false;
  state.matchSummary = buildMatchSummary();
  clearSavedMatchState();
  updateStatus(`${state.winnerText} Review the battle report or start a new match.`);
  refreshAllUI();
}

function onBattleFinished() {
  if (state.waveNumber >= MAX_ROUNDS) {
    finishMatch();
    return;
  }
  openRoundShop();
}

function applyTowerUpgradeToPlacedTowers(towerId) {
  for (let i = 0; i < state.playerTowers.length; i += 1) {
    const tower = state.playerTowers[i];
    if (!tower || tower.id !== towerId) {
      continue;
    }
    tower.damage *= TOWER_UPGRADE_MULTIPLIER;
    tower.range *= TOWER_UPGRADE_MULTIPLIER;
    tower.fireRate /= TOWER_UPGRADE_MULTIPLIER;
  }
}

function upgradeSelectedAttacker() {
  const attackerId = state.shopSelectionId;
  if (state.phase !== "shop") {
    return;
  }
  if ((state.playerAttackerUpgrades[attackerId] || 0) > 0) {
    updateStatus(`${getAttackerDef(attackerId).name} is already upgraded.`);
    refreshAllUI();
    return;
  }
  if (state.playerMana < SHOP_UPGRADE_COST) {
    updateStatus("Not enough mana for that upgrade.");
    triggerPlacementHaptic("error");
    refreshAllUI();
    return;
  }

  state.playerMana -= SHOP_UPGRADE_COST;
  state.playerAttackerUpgrades[attackerId] = 1;
  state.matchStats.upgradesBought += 1;
  updateStatus(`${getAttackerDef(attackerId).name} upgraded for the rest of the match.`);
  triggerPlacementHaptic("success");
  refreshAllUI();
}

function upgradeSelectedTower() {
  const towerId = state.shopSelectionId;
  if (state.phase !== "shop") {
    return;
  }
  if ((state.playerTowerUpgrades[towerId] || 0) >= MAX_TOWER_UPGRADES) {
    updateStatus(`${getTowerDef(towerId).name} is already at max level.`);
    triggerPlacementHaptic("error");
    refreshAllUI();
    return;
  }
  if (state.playerMana < TOWER_UPGRADE_COST) {
    updateStatus("Not enough mana for that upgrade.");
    triggerPlacementHaptic("error");
    refreshAllUI();
    return;
  }

  state.playerMana -= TOWER_UPGRADE_COST;
  state.playerTowerUpgrades[towerId] += 1;
  state.matchStats.upgradesBought += 1;
  applyTowerUpgradeToPlacedTowers(towerId);
  updateStatus(`${getTowerDef(towerId).name} upgraded to level ${getPlayerTowerUpgradeLevel(towerId)} for the rest of the match.`);
  triggerPlacementHaptic("success");
  refreshAllUI();
}

function totalDefenseScore(towers) {
  return towers.reduce((sum, tower) => sum + towerPowerScore(tower), 0);
}

function pickBestAITowerPlacement(mana, defenseBudget, playerDefenseScore, waveNumber) {
  const towerCounts = {};
  for (const tower of state.aiTowers) {
    if (tower) {
      towerCounts[tower.id] = (towerCounts[tower.id] || 0) + 1;
    }
  }

  let best = null;
  for (let slotIndex = 0; slotIndex < state.aiTowers.length; slotIndex += 1) {
    const existing = state.aiTowers[slotIndex];
    const existingPower = towerPowerScore(existing);

    for (const candidate of towerDefs) {
      if (candidate.cost > mana || candidate.cost > defenseBudget) {
        continue;
      }
      if (existing && existing.id === candidate.id) {
        continue;
      }

      const candidatePower = towerPowerScore(candidate);
      const improvement = existing ? candidatePower - existingPower : candidatePower + 0.9;
      if (existing && improvement < 0.1) {
        continue;
      }

      const diversityPenalty = (towerCounts[candidate.id] || 0) * 0.85;
      const expensiveEarlyPenalty = waveNumber <= 2 && candidate.cost >= 9 ? 1.3 : 0;
      const counterBoost = playerDefenseScore > 9 ? candidate.range * 2.1 : candidate.damage * 0.2;
      const emptyBonus = existing ? 0 : 0.8;
      const value = improvement + counterBoost + emptyBonus - diversityPenalty - candidate.cost * 0.09 - expensiveEarlyPenalty + Math.random() * 0.08;

      if (!best || value > best.value) {
        best = { slotIndex, tower: candidate, value };
      }
    }
  }

  return best;
}

function chooseAIBatchPattern(playerDefenseScore, waveNumber) {
  if (playerDefenseScore < 6 || waveNumber <= 2) {
    return ["runner", "runner", "imp", "runner", "imp"];
  }
  if (playerDefenseScore > 10) {
    return ["tank", "brute", "wisp", "imp"];
  }
  return ["imp", "runner", "brute", "wisp", "runner"];
}

function queueAIBatch(pattern, attackBudget) {
  let spent = 0;
  let sent = 0;
  let cursor = 0;

  while (cursor < pattern.length) {
    const attacker = attackerDefs.find((item) => item.id === pattern[cursor]);
    if (!attacker) {
      cursor += 1;
      continue;
    }
    if (spent + attacker.cost > attackBudget || state.aiMana < attacker.cost) {
      break;
    }
    state.aiMana -= attacker.cost;
    spent += attacker.cost;
    sent += 1;
    state.aiQueue.push(attacker.id);
    markMatchUsage("attackers", attacker.id, "ai");
    cursor += 1;
  }

  return sent;
}

function chooseAIAttackerByDefense(playerDefenseScore, mana, waveNumber) {
  const options = attackerDefs.filter((attacker) => attacker.cost <= mana);
  if (options.length === 0) {
    return null;
  }

  const pressure = playerDefenseScore / Math.max(1, waveNumber);
  const weightById = {
    imp: pressure < 1.8 ? 1.25 : 0.75,
    runner: pressure < 1.8 ? 1.35 : 0.8,
    brute: pressure > 2.2 ? 1.25 : 0.9,
    wisp: pressure > 2.6 ? 1.2 : 1,
    tank: pressure > 2.1 ? 1.4 : 0.85
  };

  let best = options[0];
  let bestScore = -Infinity;
  for (const attacker of options) {
    const hpValue = attacker.hp / attacker.cost;
    const speedValue = attacker.speed * 6;
    const score = (hpValue + speedValue) * (weightById[attacker.id] || 1);
    if (score > bestScore) {
      bestScore = score;
      best = attacker;
    }
  }
  return best;
}

function prepareAIMoves() {
  if (state.aiDraftDone || state.gameOver) {
    return;
  }

  const playerDefenseScore = totalDefenseScore(state.playerTowers);
  const minAttackerCost = Math.min(...attackerDefs.map((item) => item.cost));
  const forcedWaveAttackerId = state.waveNumber === 1 ? "wisp" : state.waveNumber === 2 ? "tank" : null;
  const forcedWaveAttacker = forcedWaveAttackerId
    ? attackerDefs.find((item) => item.id === forcedWaveAttackerId) || null
    : null;
  const forcedReserve = forcedWaveAttacker ? forcedWaveAttacker.cost : 0;
  const reserveTarget = clamp(8 + state.waveNumber * 2, 10, 38);
  let defenseBudget = Math.max(0, state.aiMana - reserveTarget - forcedReserve);
  let placementCount = 0;

  while (placementCount < 3) {
    const bestPlacement = pickBestAITowerPlacement(state.aiMana, defenseBudget, playerDefenseScore, state.waveNumber);
    if (!bestPlacement) {
      break;
    }
    if (bestPlacement.tower.cost > state.aiMana || bestPlacement.tower.cost > defenseBudget) {
      break;
    }
    state.aiMana -= bestPlacement.tower.cost;
    defenseBudget -= bestPlacement.tower.cost;
    state.aiTowers[bestPlacement.slotIndex] = createTowerInstance(bestPlacement.tower, "ai");
    markMatchUsage("towers", bestPlacement.tower.id, "ai");
    placementCount += 1;
  }

  const postDefenseReserve = clamp(reserveTarget * 0.7, 6, 28);
  let sentCount = 0;
  if (forcedWaveAttacker && state.aiMana >= forcedWaveAttacker.cost) {
    state.aiMana -= forcedWaveAttacker.cost;
    state.aiQueue.push(forcedWaveAttacker.id);
    markMatchUsage("attackers", forcedWaveAttacker.id, "ai");
    sentCount = 1;
  }
  let attackBudget = Math.max(0, state.aiMana - postDefenseReserve);
  const pattern = chooseAIBatchPattern(playerDefenseScore, state.waveNumber);

  while (attackBudget >= minAttackerCost) {
    const sentInBatch = queueAIBatch(pattern, attackBudget);
    if (sentInBatch === 0) {
      break;
    }
    sentCount += sentInBatch;
    attackBudget = Math.max(0, state.aiMana - postDefenseReserve);
  }

  if (sentCount === 0 && state.aiMana >= minAttackerCost) {
    const fallback = chooseAIAttackerByDefense(playerDefenseScore, state.aiMana, state.waveNumber) || attackerDefs[0];
    state.aiMana -= fallback.cost;
    state.aiQueue.push(fallback.id);
    markMatchUsage("attackers", fallback.id, "ai");
  }

  state.aiDraftDone = true;
}

function attackerPosition(unit) {
  const start = laneStarts[unit.owner];
  const end = laneEnds[unit.owner];
  const p = clamp(unit.progress, 0, 1);
  const baseX = start.x + (end.x - start.x) * p;
  const baseY = start.y + (end.y - start.y) * p;
  const spread = 0.39 - 0.05 * p;
  const sway = Math.sin((p * Math.PI * 2) + unit.id * 0.37) * 0.025 * (1 - 0.5 * p);
  let x = baseX + unit.fanSeed * spread + sway;
  const yFan = (0.01 + 0.018 * p) * unit.fanSeed;
  const y = clamp(baseY + yFan, 0.04, 0.96);
  x = clamp(x, 0.05, 0.95);

  return {
    x,
    y
  };
}

function targetForTower(towerPos, incomingAttackers, range) {
  const isPlayerTower = towerPos.y > 0.5;
  const dirX = 0;
  const dirY = isPlayerTower ? -1 : 1;
  const candidates = [];

  for (const unit of incomingAttackers) {
    const pos = attackerPosition(unit);
    const vx = pos.x - towerPos.x;
    const vy = pos.y - towerPos.y;
    const dist = Math.hypot(vx, vy);
    if (dist <= range) {
      if (dist === 0) {
        candidates.push({ unit, dist });
        continue;
      }
      const cosAngle = (vx * dirX + vy * dirY) / dist;
      if (cosAngle >= TOWER_CONE_HALF_ANGLE_COS) {
        candidates.push({ unit, dist });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.unit.progress !== a.unit.progress) {
      return b.unit.progress - a.unit.progress;
    }
    if (a.dist !== b.dist) {
      return a.dist - b.dist;
    }
    return a.unit.id - b.unit.id;
  });

  return candidates[0].unit;
}

function spawnProjectile(fromPos, target, damage, color, towerId, owner) {
  const projectileId = state.nextProjectileId;
  state.nextProjectileId += 1;
  state.projectiles.push({
    id: projectileId,
    x: fromPos.x,
    y: fromPos.y,
    prevX: fromPos.x,
    prevY: fromPos.y,
    targetId: target.id,
    targetOwner: target.owner,
    damage,
    speed: 1.35,
    color,
    towerId,
    owner,
    age: 0,
    trail: [{ x: fromPos.x, y: fromPos.y }]
  });
}

function ensureAudioContext() {
  if (!audioUnlocked && !audioCtx) {
    return null;
  }
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return null;
    }
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function unlockAudioFromGesture() {
  audioUnlocked = true;
  ensureAudioContext();
}

function resumeAudioAfterBackground() {
  if (!audioUnlocked || !audioCtx) {
    return;
  }
  ensureAudioContext();
}

function playTowerFireSfx(towerId) {
  const ctxAudio = ensureAudioContext();
  if (!ctxAudio) {
    return;
  }

  const now = ctxAudio.currentTime;

  if (towerId === "violet") {
    const osc = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();
    const wobble = ctxAudio.createOscillator();
    const wobbleGain = ctxAudio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.09);
    wobble.type = "sine";
    wobble.frequency.setValueAtTime(7, now);
    wobbleGain.gain.setValueAtTime(16, now);
    wobble.connect(wobbleGain);
    wobbleGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctxAudio.destination);
    wobble.start(now);
    osc.start(now);
    wobble.stop(now + 0.12);
    osc.stop(now + 0.12);
    return;
  }

  if (towerId === "yellow") {
    const osc = ctxAudio.createOscillator();
    const gateLfo = ctxAudio.createOscillator();
    const gateGain = ctxAudio.createGain();
    const gain = ctxAudio.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.06);
    gateLfo.type = "square";
    gateLfo.frequency.setValueAtTime(95, now);
    gateGain.gain.setValueAtTime(0.018, now);
    gateLfo.connect(gateGain);
    gateGain.connect(gain.gain);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.028, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctxAudio.destination);
    gateLfo.start(now);
    osc.start(now);
    gateLfo.stop(now + 0.075);
    osc.stop(now + 0.075);
    return;
  }

  if (towerId === "red") {
    const osc = ctxAudio.createOscillator();
    const toneGain = ctxAudio.createGain();
    const noise = ctxAudio.createBufferSource();
    const noiseGain = ctxAudio.createGain();
    const mix = ctxAudio.createGain();
    const filter = ctxAudio.createBiquadFilter();
    const duration = 0.2;

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + duration);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.08, now + 0.016);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const sampleRate = ctxAudio.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = ctxAudio.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.7;
    }
    noise.buffer = buffer;
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + duration);
    filter.Q.value = 0.9;

    mix.gain.setValueAtTime(0.9, now);
    osc.connect(toneGain);
    toneGain.connect(filter);
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    filter.connect(mix);
    mix.connect(ctxAudio.destination);

    osc.start(now);
    noise.start(now);
    osc.stop(now + duration);
    noise.stop(now + duration);
    return;
  }

  if (towerId === "green") {
    const osc = ctxAudio.createOscillator();
    const lfo = ctxAudio.createOscillator();
    const lfoGain = ctxAudio.createGain();
    const gain = ctxAudio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(460, now + 0.06);
    osc.frequency.linearRampToValueAtTime(300, now + 0.12);
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(18, now);
    lfoGain.gain.setValueAtTime(26, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctxAudio.destination);
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.14);
    osc.stop(now + 0.14);
    return;
  }

  if (towerId === "orange") {
    const osc = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();
    const filter = ctxAudio.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.12);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.Q.value = 1.5;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctxAudio.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }
}

function spawnTowerFlash(pos, color) {
  state.towerFlashes.push({
    x: pos.x,
    y: pos.y,
    color,
    life: 0.11,
    maxLife: 0.11
  });
}

function spawnDeathParticles(unit) {
  const origin = attackerPosition(unit);
  const particleCount = 12;
  for (let i = 0; i < particleCount; i += 1) {
    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.25;
    const speed = 0.08 + Math.random() * 0.14;
    state.deathParticles.push({
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.34 + Math.random() * 0.18,
      maxLife: 0.52,
      size: 1.5 + Math.random() * 2.4,
      color: unit.color
    });
  }
}

function spawnProjectileImpactParticles(x, y, color, particleCount) {
  for (let i = 0; i < particleCount; i += 1) {
    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.45;
    const speed = 0.045 + Math.random() * 0.09;
    state.deathParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.12 + Math.random() * 0.08,
      maxLife: 0.2,
      size: 1.1 + Math.random() * 1.9,
      color
    });
  }
}

function updateTowerFire(dt) {
  for (let i = 0; i < state.playerTowers.length; i += 1) {
    const tower = state.playerTowers[i];
    if (!tower) {
      continue;
    }
    tower.cooldown -= dt;
    if (tower.cooldown > 0) {
      continue;
    }
    const target = targetForTower(towerPosPlayer[i], state.attackersAI, tower.range);
    if (!target) {
      continue;
    }
    spawnProjectile(towerPosPlayer[i], target, tower.damage, tower.color, tower.id, "player");
    spawnTowerFlash(towerPosPlayer[i], tower.color);
    if ((tower.id === "violet" || tower.id === "yellow" || tower.id === "red" || tower.id === "green" || tower.id === "orange") && state.soundCooldowns[tower.id] <= 0) {
      playTowerFireSfx(tower.id);
      state.soundCooldowns[tower.id] = tower.id === "orange" ? 0.08 : tower.id === "red" ? 0.075 : tower.id === "violet" ? 0.07 : 0.06;
    }
    tower.cooldown = tower.fireRate;
  }

  for (let i = 0; i < state.aiTowers.length; i += 1) {
    const tower = state.aiTowers[i];
    if (!tower) {
      continue;
    }
    tower.cooldown -= dt;
    if (tower.cooldown > 0) {
      continue;
    }
    const target = targetForTower(towerPosAI[i], state.attackersPlayer, tower.range);
    if (!target) {
      continue;
    }
    spawnProjectile(towerPosAI[i], target, tower.damage, tower.color, tower.id, "ai");
    spawnTowerFlash(towerPosAI[i], tower.color);
    if ((tower.id === "violet" || tower.id === "yellow" || tower.id === "red" || tower.id === "green" || tower.id === "orange") && state.soundCooldowns[tower.id] <= 0) {
      playTowerFireSfx(tower.id);
      state.soundCooldowns[tower.id] = tower.id === "orange" ? 0.08 : tower.id === "red" ? 0.075 : tower.id === "violet" ? 0.07 : 0.06;
    }
    tower.cooldown = tower.fireRate;
  }
}

function findUnitById(owner, id) {
  const list = owner === "player" ? state.attackersPlayer : state.attackersAI;
  return list.find((unit) => unit.id === id) || null;
}

function updateProjectiles(dt) {
  const stillActive = [];

  for (const projectile of state.projectiles) {
    const target = findUnitById(projectile.targetOwner, projectile.targetId);
    if (!target || target.isDefeated) {
      continue;
    }

    const targetPos = attackerPosition(target);
    const dx = targetPos.x - projectile.x;
    const dy = targetPos.y - projectile.y;
    const dist = Math.hypot(dx, dy);

    projectile.age += dt;
    projectile.prevX = projectile.x;
    projectile.prevY = projectile.y;

    if (dist <= 0.012) {
      target.hp -= projectile.damage;
      if (projectile.towerId === "orange") {
        spawnProjectileImpactParticles(projectile.x, projectile.y, "#fdba74", 8);
      }
      if (target.hp <= 0 && !target.isDefeated) {
        target.isDefeated = true;
        recordTowerKill(projectile.towerId, projectile.owner);
      }
      continue;
    }

    const move = Math.min(dist, projectile.speed * dt);
    const invDist = dist > 0 ? 1 / dist : 0;
    projectile.x += dx * invDist * move;
    projectile.y += dy * invDist * move;
    projectile.trail.push({ x: projectile.x, y: projectile.y });
    if (projectile.trail.length > 10) {
      projectile.trail.shift();
    }
    stillActive.push(projectile);
  }

  state.projectiles = stillActive;
}

function updateTowerFlashes(dt) {
  const active = [];
  for (const flash of state.towerFlashes) {
    flash.life -= dt;
    if (flash.life > 0) {
      active.push(flash);
    }
  }
  state.towerFlashes = active;
}

function updateDeathParticles(dt) {
  const active = [];
  for (const particle of state.deathParticles) {
    particle.life -= dt;
    if (particle.life <= 0) {
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.94;
    particle.vy *= 0.94;
    active.push(particle);
  }
  state.deathParticles = active;
}

function updateAttackers(dt) {
  let playerScored = 0;
  let aiScored = 0;

  for (const unit of state.attackersPlayer) {
    unit.progress += unit.speed * dt;
    if (unit.progress >= 1) {
      playerScored += 1;
      recordUnitScore(unit.defId, "player");
    }
  }
  for (const unit of state.attackersAI) {
    unit.progress += unit.speed * dt;
    if (unit.progress >= 1) {
      aiScored += 1;
      recordUnitScore(unit.defId, "ai");
    }
  }

  for (const unit of state.attackersPlayer) {
    if (unit.hp <= 0) {
      spawnDeathParticles(unit);
    }
  }
  for (const unit of state.attackersAI) {
    if (unit.hp <= 0) {
      spawnDeathParticles(unit);
    }
  }

  state.attackersPlayer = state.attackersPlayer.filter((unit) => unit.hp > 0 && unit.progress < 1);
  state.attackersAI = state.attackersAI.filter((unit) => unit.hp > 0 && unit.progress < 1);

  state.playerScore += playerScored;
  state.aiScore += aiScored;
}

function updateGame(dt) {
  if (state.gameOver || state.paused) {
    return;
  }
  state.animationClock += dt;
  state.soundCooldowns.violet = Math.max(0, state.soundCooldowns.violet - dt);
  state.soundCooldowns.yellow = Math.max(0, state.soundCooldowns.yellow - dt);
  state.soundCooldowns.red = Math.max(0, state.soundCooldowns.red - dt);
  state.soundCooldowns.green = Math.max(0, state.soundCooldowns.green - dt);
  state.soundCooldowns.orange = Math.max(0, state.soundCooldowns.orange - dt);

  if (state.phase === "banner") {
    state.roundBannerTimer -= dt;
    if (state.roundBannerTimer <= 0) {
      state.roundBannerTimer = 0;
      beginPrepPhase();
    }
    return;
  }

  if (state.phase === "shop") {
    return;
  }

  if (state.phase === "prep") {
    if (!state.aiDraftDone) {
      prepareAIMoves();
    }

    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phaseTimer = 0;
      launchWave();
    }
  } else {
    updateAttackers(dt);
    updateTowerFire(dt);
    updateProjectiles(dt);
    updateTowerFlashes(dt);
    updateDeathParticles(dt);

    if (
      state.attackersPlayer.length === 0 &&
      state.attackersAI.length === 0 &&
      state.projectiles.length === 0 &&
      state.deathParticles.length === 0
    ) {
      onBattleFinished();
    }
  }
}

function drawLane() {
  const w = canvas.width;
  const h = canvas.height;
  if (!laneBackgroundCanvas || laneBackgroundCanvas.width !== w || laneBackgroundCanvas.height !== h) {
    laneBackgroundCanvas = createOffscreenCanvas(w, h);
    const laneCtx = laneBackgroundCanvas.getContext("2d");
    laneCtx.fillStyle = "#6f6a78";
    laneCtx.fillRect(0, 0, w, h);

    laneCtx.fillStyle = "rgba(255,255,255,0.07)";
    laneCtx.fillRect(0, 0, w, h * 0.48);

    laneCtx.fillStyle = "rgba(0,0,0,0.07)";
    laneCtx.fillRect(0, h * 0.52, w, h * 0.48);

    laneCtx.strokeStyle = "rgba(255,255,255,0.2)";
    laneCtx.lineWidth = 2;
    laneCtx.beginPath();
    laneCtx.moveTo(w * 0.02, h * 0.5);
    laneCtx.lineTo(w * 0.98, h * 0.5);
    laneCtx.stroke();
  }

  ctx.drawImage(laneBackgroundCanvas, 0, 0);
}

function drawTowerRanges() {
  const drawTower = (tower, pos) => {
    if (!tower) {
      return;
    }
    const x = canvas.width * pos.x;
    const y = canvas.height * pos.y;
    const range = tower.range * canvas.width;
    const facingUp = pos.y > 0.5;
    const baseAngle = facingUp ? -Math.PI / 2 : Math.PI / 2;
    const startAngle = baseAngle - TOWER_CONE_HALF_ANGLE_RAD;
    const endAngle = baseAngle + TOWER_CONE_HALF_ANGLE_RAD;

    ctx.fillStyle = `${tower.color}33`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
  };

  for (let i = 0; i < 5; i += 1) {
    drawTower(state.playerTowers[i], towerPosPlayer[i]);
    drawTower(state.aiTowers[i], towerPosAI[i]);
  }
}

function drawAttackers(units) {
  for (const unit of units) {
    const pos = attackerPosition(unit);
    const x = canvas.width * pos.x;
    const y = canvas.height * pos.y;

    const spriteCfg = attackerSpriteConfig[unit.defId];
    const spriteImg = attackerSprites[unit.defId];
    if (spriteCfg && spriteImg && spriteImg.complete) {
      const frame = Math.floor(state.animationClock * spriteCfg.fps) % spriteCfg.frames;
      const spriteSize = 20;
      const shouldInvertForAI = unit.owner === "ai" && (unit.defId === "wisp" || unit.defId === "tank");
      if (shouldInvertForAI) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, -1);
        ctx.drawImage(
          spriteImg,
          frame * spriteCfg.frameWidth,
          0,
          spriteCfg.frameWidth,
          spriteCfg.frameHeight,
          -spriteSize / 2,
          -spriteSize / 2,
          spriteSize,
          spriteSize
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          spriteImg,
          frame * spriteCfg.frameWidth,
          0,
          spriteCfg.frameWidth,
          spriteCfg.frameHeight,
          x - spriteSize / 2,
          y - spriteSize / 2,
          spriteSize,
          spriteSize
        );
      }
    } else {
      ctx.fillStyle = unit.color;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    const hpRatio = clamp(unit.hp / unit.maxHp, 0, 1);
    ctx.fillStyle = "#111827";
    ctx.fillRect(x - 10, y - 14, 20, 3);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(x - 10, y - 14, 20 * hpRatio, 3);
  }
}

function drawProjectiles() {
  for (const projectile of state.projectiles) {
    const x = canvas.width * projectile.x;
    const y = canvas.height * projectile.y;
    if (projectile.towerId === "yellow") {
      const trail = projectile.trail;
      if (trail.length > 1) {
        ctx.lineCap = "round";
        for (let i = 1; i < trail.length; i += 1) {
          const p0 = trail[i - 1];
          const p1 = trail[i];
          const x0 = canvas.width * p0.x;
          const y0 = canvas.height * p0.y;
          const x1 = canvas.width * p1.x;
          const y1 = canvas.height * p1.y;
          const midX = (x0 + x1) * 0.5;
          const midY = (y0 + y1) * 0.5;
          const jitter = ((projectile.id + i) % 2 === 0 ? 1 : -1) * 3;

          ctx.strokeStyle = "rgba(250, 204, 21, 0.42)";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(midX + jitter, midY - jitter);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(x, y, 3.1, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (projectile.towerId === "red") {
      const pulse = 0.85 + 0.2 * Math.sin(state.animationClock * 25 + projectile.id);
      const radius = 3.1 * pulse;
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fca5a5";
      ctx.beginPath();
      ctx.arc(x - 0.8, y - 0.8, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 4; i += 1) {
        const angle = state.animationClock * 9 + projectile.id * 0.3 + i * (Math.PI / 2);
        const sx = x + Math.cos(angle) * 4.2;
        const sy = y + Math.sin(angle) * 4.2;
        ctx.fillStyle = i % 2 === 0 ? "#fb7185" : "#f97316";
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
      continue;
    }

    if (projectile.towerId === "green") {
      const trail = projectile.trail;
      const pNow = trail[trail.length - 1] || { x: projectile.x, y: projectile.y };
      const pPrev = trail[Math.max(0, trail.length - 3)] || { x: projectile.prevX, y: projectile.prevY };
      const x0 = canvas.width * pPrev.x;
      const y0 = canvas.height * pPrev.y;
      const x1 = canvas.width * pNow.x;
      const y1 = canvas.height * pNow.y;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;

      const trailLen = 14;
      ctx.strokeStyle = "rgba(74, 222, 128, 0.55)";
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.2) {
        const bx = x1 - ux * trailLen * t;
        const by = y1 - uy * trailLen * t;
        const twist = Math.sin((state.animationClock * 40) + projectile.id + t * 8) * (2.2 * (1 - t));
        const tx = bx + px * twist;
        const ty = by + py * twist;
        if (t === 0) {
          ctx.moveTo(tx, ty);
        } else {
          ctx.lineTo(tx, ty);
        }
      }
      ctx.stroke();

      const tipX = x1;
      const tipY = y1;
      const backX = tipX - ux * 8;
      const backY = tipY - uy * 8;
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(backX + px * 3.4, backY + py * 3.4);
      ctx.lineTo(backX - px * 3.4, backY - py * 3.4);
      ctx.closePath();
      ctx.fill();
      continue;
    }

    if (projectile.towerId === "orange") {
      ctx.fillStyle = "rgba(251, 146, 60, 0.28)";
      ctx.beginPath();
      ctx.arc(x, y, 7.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(x, y, 6.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fdba74";
      ctx.beginPath();
      ctx.arc(x - 1.2, y - 1.2, 2.1, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.fillStyle = projectile.color;
    ctx.beginPath();
    ctx.arc(x, y, 3.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTowerFlashes() {
  for (const flash of state.towerFlashes) {
    const t = clamp(flash.life / flash.maxLife, 0, 1);
    const x = canvas.width * flash.x;
    const y = canvas.height * flash.y;
    const radius = 10 + (1 - t) * 18;
    ctx.fillStyle = `${flash.color}${Math.round(80 + t * 100).toString(16).padStart(2, "0")}`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDeathParticles() {
  for (const particle of state.deathParticles) {
    const x = canvas.width * particle.x;
    const y = canvas.height * particle.y;
    const t = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = t;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(x, y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawRoundBanner() {
  if (state.phase !== "banner" || state.roundBannerTimer <= 0) {
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "rgba(15, 23, 42, 0.42)";
  ctx.fillRect(w * 0.12, h * 0.41, w * 0.76, h * 0.18);
  ctx.strokeStyle = "rgba(226, 232, 240, 0.72)";
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.12, h * 0.41, w * 0.76, h * 0.18);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 18px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Prepare Yourself", w * 0.5, h * 0.47);
  ctx.font = "700 40px Trebuchet MS";
  ctx.fillText(state.roundBannerText, w * 0.5, h * 0.535);
}

function drawBoard() {
  drawLane();
  drawTowerRanges();
  drawAttackers(state.attackersPlayer);
  drawAttackers(state.attackersAI);
  drawProjectiles();
  drawTowerFlashes();
  drawDeathParticles();
  drawRoundBanner();
}

let previousTime = performance.now();
function gameLoop(timestamp) {
  const dt = clamp((timestamp - previousTime) / 1000, 0, 0.25);
  previousTime = timestamp;

  if (state.screen === "game") {
    updateGame(dt);
    drawBoard();
    refreshHUD();
  }

  requestAnimationFrame(gameLoop);
}

replayBtnEl.addEventListener("click", () => {
  startNewMatch();
});

battleSkipBtnEl.addEventListener("click", () => {
  if (state.phase !== "prep" || state.gameOver || state.paused || state.battleSkipUsedThisRound) {
    return;
  }
  state.battleSkipUsedThisRound = true;
  state.phaseTimer = 0;
  launchWave();
});

shopUpgradeBtnEl.addEventListener("click", () => {
  if (state.shopSelectionType === "tower") {
    upgradeSelectedTower();
  } else {
    upgradeSelectedAttacker();
  }
});

shopStartBtnEl.addEventListener("click", () => {
  if (state.phase !== "shop") {
    return;
  }
  beginRoundBanner();
});

pauseBtnEl.addEventListener("click", () => {
  if (state.gameOver || state.phase === "shop" || state.phase === "banner") {
    return;
  }
  state.paused = !state.paused;
  pauseBtnEl.textContent = state.paused ? "Resume" : "Pause";
  saveMatchStateNow();
  if (state.paused) {
    updateStatus("Paused.");
  } else {
    updateStatus(state.phase === "prep" ? "Prep resumed." : "Battle resumed.");
  }
});

playMatchBtnEl.addEventListener("click", () => {
  startNewMatch();
});

resumeMatchBtnEl.addEventListener("click", () => {
  if (!state.hasActiveMatch || state.gameOver) {
    return;
  }
  state.paused = false;
  setScreen("game");
  lockLandscapeOrientation();
  refreshAllUI();
  updateStatus(state.phase === "prep" ? "Prep resumed." : "Battle resumed.");
});

openRecordsBtnEl.addEventListener("click", () => {
  setScreen("records");
});

recordsBackBtnEl.addEventListener("click", () => {
  setScreen("menu");
});

progressBtnEl.addEventListener("click", () => {
  if (state.hasActiveMatch && !state.gameOver) {
    state.paused = true;
    saveMatchStateNow();
  }
  setScreen("records");
});

homeBtnEl.addEventListener("click", () => {
  if (state.hasActiveMatch && !state.gameOver) {
    state.paused = true;
    updateStatus("Match paused from the menu.");
    saveMatchStateNow();
  }
  setScreen("menu");
});

matchPlayAgainBtnEl.addEventListener("click", () => {
  startNewMatch();
});

matchRecordsBtnEl.addEventListener("click", () => {
  setScreen("records");
});

matchHomeBtnEl.addEventListener("click", () => {
  setScreen("menu");
});

createTowerSlots();
createCards();
setupArenaDrop();
updateViewportHeight();
loadPersistentStats();
resetMatch();
const restoredMatch = restoreSavedMatchState();
state.hasActiveMatch = restoredMatch;
state.paused = restoredMatch;
setScreen("menu");
lockLandscapeOrientation();
registerNativeAppLifecycle();
resizeBattlefieldFrame();
refreshAllUI();
requestAnimationFrame(gameLoop);
