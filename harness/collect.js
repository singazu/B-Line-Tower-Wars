// Re-builds CSVs from out/matches.jsonl without re-running matches.
// Useful when you want to tweak aggregations (e.g. add a new bucket) over an
// existing batch.
//
// Usage:
//   node collect.js [--in out/matches.jsonl] [--out out/]

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const IN_PATH  = path.resolve(__dirname, args.in  || "out/matches.jsonl");
const OUT_DIR  = path.resolve(__dirname, args.out || "out");

function csvField(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(arr) { return arr.map(csvField).join(","); }

async function loadJsonl(p) {
  const text = await fs.readFile(p, "utf-8");
  return text.split("\n").filter(Boolean).map(line => JSON.parse(line));
}

async function writeCsvs(results, outDir) {
  if (results.length === 0) return;
  const towerIds = Object.keys(results[0].damage.player);
  const attackerIds = Object.keys(results[0].queued.player);

  {
    const rows = [csvRow(["matchIndex", "winner", "playerScore", "aiScore", "waves", "ticks"])];
    for (const r of results) rows.push(csvRow([r.matchIndex, r.winner, r.playerScore, r.aiScore, r.waves, r.ticks]));
    await fs.writeFile(path.join(outDir, "matches.csv"), rows.join("\n") + "\n");
  }

  {
    const rows = [csvRow(["matchIndex", "owner", "towerId", "damage", "hits", "kills", "shopUpgrades", "won"])];
    for (const r of results) for (const owner of ["player", "ai"]) {
      const won = r.winner === owner ? 1 : 0;
      for (const id of towerIds) rows.push(csvRow([
        r.matchIndex, owner, id,
        Math.round(r.damage[owner][id] * 1000) / 1000,
        r.hits[owner][id], r.kills[owner][id],
        (r.shopTowerUpgrades && r.shopTowerUpgrades[owner] && r.shopTowerUpgrades[owner][id]) || 0,
        won,
      ]));
    }
    await fs.writeFile(path.join(outDir, "towers.csv"), rows.join("\n") + "\n");
  }

  {
    const rows = [csvRow(["matchIndex", "owner", "kind", "id", "upgradesBought", "won"])];
    for (const r of results) for (const owner of ["player", "ai"]) {
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
    await fs.writeFile(path.join(outDir, "shop.csv"), rows.join("\n") + "\n");
  }

  {
    const rows = [csvRow(["matchIndex", "round", "owner", "slot", "towerId", "level", "manaPostDraft"])];
    for (const r of results) for (const p of r.placements) {
      for (const owner of ["player", "ai"]) {
        const slots = p[owner];
        for (let s = 0; s < slots.length; s++) {
          const t = slots[s];
          rows.push(csvRow([
            r.matchIndex, p.round, owner, s,
            t ? t.id : "", t ? t.level : "",
            owner === "player" ? p.playerMana : p.aiMana,
          ]));
        }
      }
    }
    await fs.writeFile(path.join(outDir, "placements.csv"), rows.join("\n") + "\n");
  }

  {
    const rows = [csvRow(["matchIndex", "owner", "attackerId", "queued", "won"])];
    for (const r of results) for (const owner of ["player", "ai"]) {
      const won = r.winner === owner ? 1 : 0;
      for (const id of attackerIds) rows.push(csvRow([r.matchIndex, owner, id, r.queued[owner][id], won]));
    }
    await fs.writeFile(path.join(outDir, "attackers.csv"), rows.join("\n") + "\n");
  }

  // tower-vs-attacker.csv
  {
    const rows = [csvRow(["matchIndex", "ownerOfTower", "towerId", "attackerId", "damage", "hits", "kills"])];
    for (const r of results) {
      if (!r.matrixDamage) continue;
      for (const owner of ["player", "ai"]) for (const tid of towerIds) for (const aid of attackerIds) {
        const d = r.matrixDamage[owner][tid][aid] || 0;
        const h = r.matrixHits[owner][tid][aid]   || 0;
        const k = r.matrixKills[owner][tid][aid]  || 0;
        if (d === 0 && h === 0 && k === 0) continue;
        rows.push(csvRow([r.matchIndex, owner, tid, aid, Math.round(d * 1000) / 1000, h, k]));
      }
    }
    await fs.writeFile(path.join(outDir, "tower-vs-attacker.csv"), rows.join("\n") + "\n");
  }

  // attacker-fate.csv
  {
    const rows = [csvRow([
      "matchIndex", "owner", "attackerId",
      "queued", "spawned", "killed", "scored", "damageTaken",
      "scoreShare", "won",
    ])];
    for (const r of results) for (const owner of ["player", "ai"]) {
      const won = r.winner === owner ? 1 : 0;
      const totalScored = (owner === "player" ? r.playerScore : r.aiScore);
      for (const aid of attackerIds) {
        const queued  = r.queued[owner][aid] || 0;
        const spawned = (r.spawned && r.spawned[owner] && r.spawned[owner][aid]) || queued;
        const killed  = (r.killedAS && r.killedAS[owner] && r.killedAS[owner][aid]) || 0;
        const dmgIn   = (r.damageTakenAS && r.damageTakenAS[owner] && r.damageTakenAS[owner][aid]) || 0;
        const scored  = Math.max(0, spawned - killed);
        const share = totalScored > 0 ? Math.round((scored / totalScored) * 10000) / 10000 : 0;
        rows.push(csvRow([r.matchIndex, owner, aid, queued, spawned, killed, scored, Math.round(dmgIn * 1000) / 1000, share, won]));
      }
    }
    await fs.writeFile(path.join(outDir, "attacker-fate.csv"), rows.join("\n") + "\n");
  }

  // rounds.csv
  {
    const headerKeys = [
      "manaPreDraft", "manaPostDraft", "manaPostShop",
      "manaSpentTowers", "manaSpentAttackers", "manaSpentShopT", "manaSpentShopA",
      "manaFromKills", "manaWastedToCap", "scoreDelta",
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
      for (const rd of r.rounds) for (const owner of ["player", "ai"]) {
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
    await fs.writeFile(path.join(outDir, "rounds.csv"), rows.join("\n") + "\n");
  }

  // status-effects.csv
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

  // economy.csv
  {
    const rows = [csvRow([
      "matchIndex", "owner", "won",
      "manaSpentTowers", "manaSpentAttackers", "manaSpentShopT", "manaSpentShopA",
      "manaFromKills", "manaWastedToCap",
      "totalSpent", "totalSpentNetOfWaste",
    ])];
    for (const r of results) for (const owner of ["player", "ai"]) {
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
    await fs.writeFile(path.join(outDir, "economy.csv"), rows.join("\n") + "\n");
  }

  // summary-towers.csv
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
    for (const owner of ["player", "ai"]) for (const tid of towerIds) {
      let matches = 0, matchesPresent = 0, wins = 0, winsPresent = 0;
      let damage = 0, shots = 0, hits = 0, kills = 0, placements = 0, shopUps = 0;
      for (const r of results) {
        matches += 1;
        if (r.winner === owner) wins += 1;
        const placedThis = (r.towersPlaced && r.towersPlaced[owner] && r.towersPlaced[owner][tid]) || 0;
        if (placedThis > 0) {
          matchesPresent += 1;
          if (r.winner === owner) winsPresent += 1;
        }
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
        owner, tid, matches, wins,
        Math.round(damage * 100) / 100, shots, hits, kills,
        placements, shopUps,
        avg(damage), avg(kills), avg(placements),
        ratio(damage, shots), ratio(damage, hits), ratio(kills, shots),
        winRatePresent,
      ]));
    }
    await fs.writeFile(path.join(outDir, "summary-towers.csv"), rows.join("\n") + "\n");
  }

  // summary-attackers.csv
  {
    const rows = [csvRow([
      "owner", "attackerId",
      "matches", "matchesWon",
      "totalQueued", "totalSpawned", "totalKilled", "totalScored", "totalDamageTaken",
      "avgQueuedPerMatch", "scoringRate", "killRate",
      "winRateWhenQueued",
    ])];
    for (const owner of ["player", "ai"]) for (const aid of attackerIds) {
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
        if (q > 0) { matchesQueued += 1; if (r.winner === owner) winsQueued += 1; }
      }
      const avgQueued = matches === 0 ? 0 : Math.round((queued / matches) * 1000) / 1000;
      const scoringRate = spawned === 0 ? 0 : Math.round((scored / spawned) * 10000) / 10000;
      const killRate    = spawned === 0 ? 0 : Math.round((killed / spawned) * 10000) / 10000;
      const winRateQueued = matchesQueued === 0 ? 0 : Math.round((winsQueued / matchesQueued) * 10000) / 10000;
      rows.push(csvRow([
        owner, aid, matches, wins,
        queued, spawned, killed, scored, Math.round(damageTaken * 100) / 100,
        avgQueued, scoringRate, killRate, winRateQueued,
      ]));
    }
    await fs.writeFile(path.join(outDir, "summary-attackers.csv"), rows.join("\n") + "\n");
  }

  // summary-matrix.csv
  {
    const rows = [csvRow([
      "ownerOfTower", "towerId", "attackerId",
      "matches", "totalDamage", "totalHits", "totalKills",
      "avgDamagePerMatch", "killsPerMatch",
    ])];
    for (const owner of ["player", "ai"]) for (const tid of towerIds) for (const aid of attackerIds) {
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
        owner, tid, aid, matches,
        Math.round(damage * 100) / 100, hits, kills,
        matches === 0 ? 0 : Math.round((damage / matches) * 1000) / 1000,
        matches === 0 ? 0 : Math.round((kills / matches) * 1000) / 1000,
      ]));
    }
    await fs.writeFile(path.join(outDir, "summary-matrix.csv"), rows.join("\n") + "\n");
  }

  {
    const buckets = {};
    for (const r of results) for (const owner of ["player", "ai"]) {
      const counts = Object.fromEntries(towerIds.map(id => [id, 0]));
      for (const t of r.finalTowers[owner]) if (t && (t.id in counts)) counts[t.id] += 1;
      const won = r.winner === owner ? 1 : 0;
      for (const id of towerIds) {
        const k = `${owner}|${id}|${counts[id]}`;
        if (!buckets[k]) buckets[k] = { matches: 0, wins: 0 };
        buckets[k].matches += 1;
        buckets[k].wins += won;
      }
    }
    const rows = [csvRow(["owner", "towerId", "finalCount", "matches", "wins", "winRate"])];
    for (const k of Object.keys(buckets).sort()) {
      const [owner, id, count] = k.split("|");
      const b = buckets[k];
      const rate = b.matches === 0 ? 0 : Math.round((b.wins / b.matches) * 10000) / 10000;
      rows.push(csvRow([owner, id, count, b.matches, b.wins, rate]));
    }
    await fs.writeFile(path.join(outDir, "win-by-tower-count.csv"), rows.join("\n") + "\n");
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const results = await loadJsonl(IN_PATH);
  await writeCsvs(results, OUT_DIR);
  console.log(`[collect] rebuilt CSVs from ${results.length} matches → ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
