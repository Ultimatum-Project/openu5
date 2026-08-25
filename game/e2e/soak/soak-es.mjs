// Soak-test jugador para el clon de Ultima V — VARIANTE PIEL FIEL + PILAR ESPAÑOL.
// Adaptación de soak.mjs (2026-07-11) a la realidad del build de 2026-07-19:
//  - La piel `dev` fue JUBILADA: el arranque `?skin=dev` + espera de `.title-screen`
//    /`.title-new`/`.hud-clock` (DOM sólo-dev) ya NO existe → el bot histórico cuelga.
//  - La piel FIEL (default) es CANVAS: dialogue/ztats no son DOM. Se conduce por
//    los hooks `__u5test` (worldReady/dialogueOpen/shopOpen/consoleLines/state).
//  - AÑADIDO: detector del PILAR ESPAÑOL — escanea consoleLines() (texto ya
//    traducido por t()) buscando inglés bajo lang=es. Tiers HARD/SOFT + exentos.
//
// AMPLIACIÓN 2026-07-20 (carril qa/dungeon-soak): DEEP-LINK DE MAZMORRA. El soak
// original tenía un hueco de cobertura conocido (dungeons = 0: el bot sólo entraba a
// mazmorra orgánicamente, cosa que no ocurría). Se añade:
//  - `enterDungeonDeepLink(id)` — entra a una mazmorra por el mecanismo REAL del
//    arnés del Grand Tour (teleport a la entrada del overworld + sello de la Palabra
//    de Poder + (E)nter). Réplica en JS de `enterDungeon` de e2e/grandtour/nav.ts.
//  - Modo DIRIGIDO `--dungeon <ids-csv>` (p.ej. `--dungeon 33,34,37` = Deceit/Despise/
//    Covetous): el boot entra a la 1ª mazmorra y el bucle RE-ENTRA al salir, para
//    saturar el subsistema 3D en vez de deambular por el overworld.
//  - Ejercitadores nuevos: In Lor (luz), movimiento 3D + fosos, cofres de pasillo
//    (O) con CONTABILIDAD de botín, Des Por (descenso mágico), y SALAS de combate
//    por `startDungeonRoomCombat` con la PERMANENCIA post-victoria nueva (matar →
//    salir por el borde). Detectores nuevos: cofre-que-no-abre, victoria-que-no-cierra,
//    botín-descuadrado (double/lost-credit), inventario/HP negativos tras trampa.
//
// AMPLIACIÓN 2026-07-22 (carril sell-chatter): campProbe — (H)ole up & camp EN mazmorra
//  (el «refugio de mazmorra» que el censo i18n marcaba sin cobertura) — y viewGemProbe
//  ((V)iew a gem, DNGLOOK 0x06a8; seedCaster siembra gemas). Ambos con scan ES por fase.
//
// Uso: node game/e2e/soak/soak-es.mjs --minutes 30 [--seed 1234] [--headed]
//        [--dungeon 33,34,37]   (sin valor = 33,34,37 = Deceit/Despise/Covetous)
//   env: U5_SOAK_URL (default http://localhost:5263/)

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { finalExitCode, scanHeartbeatProblem } from "./soak-lib.mjs";

const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean),
);
const MINUTES = Number(ARGS.minutes ?? 30);
const SEED = Number(ARGS.seed ?? Date.now() % 2 ** 31);
const BASE = process.env.U5_SOAK_URL ?? "http://localhost:5263/";
const DIR = path.dirname(new URL(import.meta.url).pathname);
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const LOG = path.join(DIR, `soak-es-${STAMP}-seed${SEED}.jsonl`);
const SHOTS = path.join(DIR, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

// ── Pasabilidad de arena para la SALIDA post-victoria (calco de e2e/grandtour/nav.ts) ──
// El escape post-victoria debe rodear muros Y los COFRES impasables (batch 15). BFS al
// borde de salida evitando ocupados+cofres+no-transitables; si un cofre tapona, se ABRE
// con Open direccional (ejercita el "cofre direccional" nuevo). Cita: nav.ts escapeFirstStep.
const TILE_DATA = JSON.parse(fs.readFileSync(path.join(DIR, "../../src/core/data/TileData.json"), "utf8"));
const REGULAR_DOORS = new Set([184, 186]);
const traversable = (tile) => Boolean(TILE_DATA[String(tile)]?.IsWalking_Passable) || REGULAR_DOORS.has(tile);
const CARD = [[0, -1, "north"], [0, 1, "south"], [-1, 0, "west"], [1, 0, "east"]];
const DIR_KEY = { north: "ArrowUp", south: "ArrowDown", west: "ArrowLeft", east: "ArrowRight" };
// Primer paso cardinal (BFS) hacia el borde `exitDir`, rodeando ocupados+cofres+muros.
function escapeFirstStep(s, exitDir) {
  const G = s.tiles.length;
  const onEdge = (x, y) => exitDir === "west" ? x === 0 : exitDir === "east" ? x === G - 1 : exitDir === "north" ? y === 0 : y === G - 1;
  if (onEdge(s.ax, s.ay)) return exitDir;
  const blocked = new Set([...s.occ, ...(s.chests ?? [])].map((o) => `${o.x}:${o.y}`));
  const key = (x, y) => `${x}:${y}`;
  const prev = new Map();
  const seen = new Set([key(s.ax, s.ay)]);
  let q = [{ x: s.ax, y: s.ay }];
  while (q.length) {
    const nq = [];
    for (const cur of q) {
      if (onEdge(cur.x, cur.y)) {
        let c = key(cur.x, cur.y), firstDir = null;
        while (prev.has(c)) { const p = prev.get(c); firstDir = p.dir; c = key(p.x, p.y); }
        return firstDir;
      }
      for (const [dx, dy, dir] of CARD) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const k = key(nx, ny);
        if (seen.has(k) || blocked.has(k) || !traversable(s.tiles[ny]?.[nx])) continue;
        seen.add(k); prev.set(k, { x: cur.x, y: cur.y, dir }); nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return null;
}
// Si un cofre adyacente tapona: dirección para (O)pen direccional que lo retira.
function chestOpenDir(s) {
  const chestSet = new Set((s.chests ?? []).map((c) => `${c.x}:${c.y}`));
  for (const [dx, dy, dir] of CARD) if (chestSet.has(`${s.ax + dx}:${s.ay + dy}`)) return dir;
  return null;
}
// Primer paso cardinal (BFS) hacia una celda ADYACENTE a un enemigo, rodeando muros/
// ocupados/cofres (calco de nav.ts combatFirstStep). Sin esto el bot deambula al azar y
// no arrincona a enemigos tras obstáculos → combat-never-ends (700 iter) en salas duras.
function combatFirstStep(s) {
  const G = s.tiles.length;
  const occ = new Set([...s.occ, ...(s.chests ?? [])].map((o) => `${o.x}:${o.y}`));
  const enemyAdj = new Set();
  for (const e of s.enemies ?? []) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) enemyAdj.add(`${e.x + dx}:${e.y + dy}`);
  if (!enemyAdj.size) return null;
  const key = (x, y) => `${x}:${y}`;
  const prev = new Map();
  const seen = new Set([key(s.ax, s.ay)]);
  let q = [{ x: s.ax, y: s.ay }];
  while (q.length) {
    const nq = [];
    for (const cur of q) {
      if (enemyAdj.has(key(cur.x, cur.y))) {
        let c = key(cur.x, cur.y), firstDir = null;
        while (prev.has(c)) { const p = prev.get(c); firstDir = p.dir; c = key(p.x, p.y); }
        return firstDir;
      }
      for (const [dx, dy, dir] of CARD) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const k = key(nx, ny);
        if (seen.has(k) || occ.has(k) || !traversable(s.tiles[ny]?.[nx])) continue;
        seen.add(k); prev.set(k, { x: cur.x, y: cur.y, dir }); nq.push({ x: nx, y: ny });
      }
    }
    q = nq;
  }
  return null;
}

// ── Modo mazmorra (deep-link) ───────────────────────────────────────────────
// id → nombre (locationsX/Y[id-1]); ch14 usa DECEIT=33 (nav.ts). El overworld-tile
// se lee VIVO de game.data.locationsX/Y en el deep-link (no se hardcodea aquí).
const DUNGEON_NAMES = { 33: "Deceit", 34: "Despise", 35: "Destard", 36: "Wrong", 37: "Covetous", 38: "Shame", 39: "Hythloth", 40: "Doom" };
const DUNGEON_MODE = "dungeon" in ARGS;
const DUNGEON_IDS = (ARGS.dungeon && ARGS.dungeon !== "true" ? String(ARGS.dungeon) : "33,34,37")
  .split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 33 && n <= 40);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const stats = { actions: 0, anomalies: 0, combats: 0, roomCombats: 0, dungeons: 0, dungeonEntries: 0, chestsOpened: 0, saves: 0, loads: 0, reloads: 0, travels: 0, enTexts: 0, enTextsHard: 0, scannedLines: 0, scanErrors: 0, byAction: {} };
let page;
function log(obj) {
  fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), actions: stats.actions, ...obj }) + "\n");
}
async function anomaly(kind, detail) {
  stats.anomalies += 1;
  const shot = path.join(SHOTS, `${STAMP}-seed${SEED}-a${stats.anomalies}-${kind}.png`);
  let state = null;
  try { state = await snapshot(); } catch { /* puede estar roto */ }
  try { await page.screenshot({ path: shot, timeout: 5000 }); } catch { /* ídem */ }
  log({ level: "ANOMALY", kind, detail, state, shot });
  console.log(`[ANOMALY ${stats.anomalies}] ${kind}: ${JSON.stringify(detail).slice(0, 220)}`);
}

// ── Detector del PILAR ESPAÑOL ────────────────────────────────────────────
// Exentos: nombres propios, comandos, términos de juego que NO se traducen.
const EXEMPT = new Set([
  // topónimos
  "britannia", "britain", "jhelom", "yew", "minoc", "trinsic", "skara", "brae",
  "moonglow", "magincia", "cove", "buccaneer", "buccaneers", "den", "serpent", "hold",
  "empath", "abbey", "lycaeum", "paws", "fogsbane", "stormcrow", "greyhaven",
  "bordermarch", "farthing", "sutek", "palace", "castle", "deceit", "despise",
  "destard", "wrong", "covetous", "shame", "hythloth", "doom", "dungeon",
  // personajes / facciones
  "lord", "british", "blackthorn", "iolo", "shamino", "dupre", "geoffrey", "katrina",
  "mariah", "julia", "jaana", "sentri", "gwenno", "toshi", "saduj", "avatar", "ultima",
  "exodus", "minax", "mondain", "shadowlords", "faulinei", "astaroth", "nosfentor",
  "batlin", "sherry", "smith", "hawkwind", "johne", "seggallion",
  // virtudes / principios / mantras
  "honesty", "compassion", "valor", "justice", "sacrifice", "honor", "spirituality",
  "humility", "truth", "love", "courage", "beh", "cah", "mu", "ra", "ahm", "sum", "om",
  // sistema / comandos / stats
  "z-stats", "zstats", "hp", "mp", "hmp", "str", "dex", "int", "ml", "lv", "exp",
  "ankh", "karma", "am", "pm", "gp",
  // palabras de hechizo (idioma mágico, no se traduce)
  "in", "vas", "mani", "flam", "grav", "por", "an", "bet", "corp", "des", "ex",
  "hur", "jux", "kal", "lor", "nox", "ort", "quas", "rel", "sanct", "tym", "uus", "wis", "ylem", "zu",
]);
// HARD: inglés inequívoco (arcaico 2ª persona / frases / direcciones sin traducir).
const HARD_WORDS = /\b(thou|thee|thy|thine|hast|dost|doth|art|wilt|shalt|ye|unto|welcome|hello|goodbye|nothing|none|cannot|locked|opened|nobody|north|south|east|west|slain|killed|attacks?|misses?|blocked|night|dead|alive|door|chest|poison|sleep|hunger|starving|player|spell|reagent|reagents|weapon|armou?r|nobody|whom|who|cast|ready|wear|whither|enemy|enemies|escape|success|failed|hidden|found)\b/i;
const HARD_PHRASE = /\b(you see|you find|you are|there is|there are|press\b|game over|thou dost|by what name|art thou|new game|what o'clock|for what|& who)\b/i;
// SOFT: >=2 funtores ingleses distintos en la misma línea.
const SOFT_WORDS = ["the", "you", "your", "and", "with", "of", "to", "is", "are", "has", "have", "what", "that", "this", "from", "for", "not", "but", "all", "can", "will", "here", "now", "who", "why", "how"];
function stripExempt(line) {
  return line.toLowerCase().replace(/[^a-z'\s]/g, " ").split(/\s+/).filter((w) => w && !EXEMPT.has(w)).join(" ");
}
function classifyEnglish(rawLine) {
  const line = rawLine.trim();
  if (!line) return null;
  const cleaned = stripExempt(line);
  if (!cleaned) return null;
  if (HARD_PHRASE.test(line)) return { tier: "HARD", why: "phrase", line: rawLine };
  if (HARD_WORDS.test(cleaned)) {
    const m = cleaned.match(HARD_WORDS);
    return { tier: "HARD", why: "word:" + (m ? m[0] : "?"), line: rawLine };
  }
  const hits = new Set();
  for (const w of SOFT_WORDS) if (new RegExp("\\b" + w + "\\b").test(cleaned)) hits.add(w);
  if (hits.size >= 2) return { tier: "SOFT", why: "funtores:" + [...hits].join(","), line: rawLine };
  return null;
}
const seenLines = new Set();
async function scanSpanish() {
  let lines = [];
  // G5: el catch ya no es silencioso — scanErrors cuenta los fallos del hook y
  // scannedLines certifica que FLUYEN líneas; scan-dead se decide con ambos.
  try { lines = (await page.evaluate(() => window.__u5test?.consoleLines?.() ?? [])) ?? []; } catch { stats.scanErrors += 1; return; }
  stats.scannedLines += lines.length;
  for (const l of lines) {
    if (seenLines.has(l)) continue;
    seenLines.add(l);
    const v = classifyEnglish(l);
    if (v) {
      stats.enTexts += 1;
      if (v.tier === "HARD") stats.enTextsHard += 1; // G4: las HARD deciden el exit
      log({ level: "EN_TEXT", tier: v.tier, why: v.why, line: v.line, pos: (await snapshot().catch(() => null))?.pos });
      if (v.tier === "HARD") console.log(`[EN ${v.tier}] ${v.why}: "${v.line}"`);
    }
  }
  // recorta el set para no crecer sin límite
  if (seenLines.size > 4000) { const arr = [...seenLines]; seenLines.clear(); arr.slice(-2000).forEach((x) => seenLines.add(x)); }
}

// ── lectura de estado (hooks, no DOM) ──────────────────────────────────────
async function snapshot() {
  return page.evaluate(() => {
    const t = window.__u5test;
    if (!t) return null;
    const s = t.state();
    const g = t.game;
    const c = g.combat;
    const ds = g.dungeonState;
    return {
      pos: { ...s.position },
      time: { ...s.time },
      gold: s.gold, food: s.food, karma: s.karma,
      keys: s.keys, gems: s.gems, torches: s.torches,
      chars: s.characters.slice(0, 6).map((ch) => ({ n: ch.name, hp: ch.currentHp, maxHp: ch.maxHp, mp: ch.currentMp, st: ch.status })),
      inCombat: c != null,
      inDungeon: ds != null,
      combatOver: c ? c.over : null,
      victory: c ? c.victory : null,
      light: g.dungeonLightDepth ?? null,
      dpos: ds ? { dungeon: ds.pos.dungeon, floor: ds.pos.floor, x: ds.pos.x, y: ds.pos.y, facing: ds.pos.facing } : null,
      dialogue: (() => { try { return !!t.dialogueOpen?.(); } catch { return false; } })(),
      shop: (() => { try { return !!t.shopOpen?.(); } catch { return false; } })(),
    };
  });
}
async function domPanels() {
  return page.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => getComputedStyle(e).display !== "none" && e.offsetParent !== null);
    return {
      save: [...document.querySelectorAll(".save-panel")].filter((e) => getComputedStyle(e).display !== "none" && e.offsetParent !== null).length,
      journal: vis(".journal-panel"), minimap: vis(".minimap-panel"), viewgem: vis(".viewgem-panel"),
      error: (() => { const e = document.querySelector("#error"); return !!e && getComputedStyle(e).display !== "none" && e.textContent.trim().length > 0; })(),
    };
  });
}

// ── invariantes ────────────────────────────────────────────────────────────
let lastTimeKey = ""; let sameTimeCount = 0;
let lastPosKey = ""; let samePosCount = 0;
async function checkInvariants(s, dp) {
  if (!s) { await anomaly("state-unavailable", {}); return; }
  const bad = [];
  const fin = (v) => Number.isFinite(v);
  if (!fin(s.gold) || s.gold < 0) bad.push(`gold=${s.gold}`);
  if (!fin(s.food) || s.food < 0) bad.push(`food=${s.food}`);
  if (!fin(s.karma) || s.karma < 0 || s.karma > 99) bad.push(`karma=${s.karma}`);
  // Inventario NUNCA negativo (detector nuevo: trampa/botín que descuenta de más).
  for (const k of ["keys", "gems", "torches"]) if (s[k] != null && (!fin(s[k]) || s[k] < 0)) bad.push(`${k}=${s[k]}`);
  for (const c of s.chars) {
    if (!fin(c.hp) || !fin(c.maxHp) || c.hp > c.maxHp) bad.push(`${c.n}: hp ${c.hp}/${c.maxHp}`);
    // HP negativo tras trampa/foso (el binario satura a 0, nunca baja de 0).
    if (fin(c.hp) && c.hp < 0) bad.push(`${c.n}: hp<0 (${c.hp})`);
    if (!fin(c.mp) || c.mp < 0) bad.push(`${c.n}: mp ${c.mp}`);
  }
  if (!fin(s.pos.x) || !fin(s.pos.y) || s.pos.x < 0 || s.pos.y < 0 || s.pos.x > 255 || s.pos.y > 255) bad.push(`pos ${s.pos.x},${s.pos.y}`);
  if (bad.length) await anomaly("invariant", { bad });
  if (dp.error) await anomaly("error-overlay", {});

  const modal = s.inCombat || s.dialogue || s.shop || dp.save > 0 || dp.journal || dp.minimap || dp.viewgem;
  const tk = JSON.stringify(s.time);
  sameTimeCount = tk === lastTimeKey ? sameTimeCount + 1 : 0; lastTimeKey = tk;
  if (sameTimeCount === 150 && !modal) { await anomaly("clock-frozen", { time: s.time }); sameTimeCount = 0; }
  const pk = JSON.stringify(s.inDungeon ? s.dpos : s.pos);
  samePosCount = pk === lastPosKey ? samePosCount + 1 : 0; lastPosKey = pk;
  if (samePosCount === 180 && !modal && !s.inDungeon) {
    // antes de declarar atasco, intenta desatascar (modal canvas invisible p.ej. ztats)
    await blurEsc(); await blurEsc(); await page.waitForTimeout(60);
    const s2 = await snapshot();
    if (s2 && JSON.stringify(s2.pos) === pk) await anomaly("stuck-position", { pos: s.pos });
    samePosCount = 0;
  }
}

// ── manejadores por modo ────────────────────────────────────────────────────
const DIRS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
async function key(k) { await page.keyboard.press(k); }
// El save-panel/selector DOM se traga Escape (stopPropagation en savepanel.ts:78):
// el handler de ventana que cierra (main.ts:2798) sólo dispara con el foco FUERA del
// panel → hay que blur() primero. Cierre robusto de cualquier panel DOM.
async function blurEsc() {
  await page.evaluate(() => document.activeElement?.blur());
  await key("Escape");
  await page.waitForTimeout(40);
}

// ── Deep-link de MAZMORRA (réplica JS de enterDungeon, e2e/grandtour/nav.ts) ──
// Costura de arnés declarada, CLASE #47 (misma que reseed/teleportOverworld): siembra
// maná/nivel/quantities del caster para In Lor (círculo 1) + Des Por (círculo 4), y cura
// a los VIVOS (no revive muertos → no fantasmas). Valores fijos → sin efecto en RNG.
async function seedCaster() {
  await page.evaluate(() => {
    const g = window.__u5test.game;
    for (let i = 0; i < g.state.partySize; i++) {
      const c = g.state.characters[i];
      if (!c) continue;
      c.currentMp = 99; c.level = 8;
      if (c.status !== "D") c.currentHp = c.maxHp;
    }
    g.state.spellQuantities[0] = 20;  // In Lor
    g.state.spellQuantities[22] = 20; // Des Por
    g.state.gems = Math.max(g.state.gems ?? 0, 6); // (V)iew a gem en mazmorra (DNGLOOK 0x06a8)
  });
}
// Entra a la mazmorra `id` por el mecanismo REAL: teleporta a su tile-entrada del
// overworld, abre el sello de la Palabra de Poder (questFlag word-spoken:<id>) y (E)nter.
// Devuelve el dpos o null si no cargó.
async function enterDungeonDeepLink(id) {
  openedChests.clear(); // cofres re-stockeados en cada entrada (dungeonState nuevo)
  await seedCaster();
  await page.evaluate((locId) => {
    const g = window.__u5test.game;
    window.__u5debug.teleportOverworld(g.data.locationsX[locId - 1], g.data.locationsY[locId - 1]);
    g.state.questFlags[`word-spoken:${locId}`] = true;
  }, id);
  await key("e");
  await page.waitForTimeout(160);
  const s = await snapshot();
  if (s?.inDungeon) { stats.dungeonEntries += 1; log({ level: "EVENT", msg: "enter-dungeon", id, name: DUNGEON_NAMES[id], dpos: s.dpos }); }
  else await anomaly("dungeon-enter-failed", { id, name: DUNGEON_NAMES[id] });
  return s?.dpos ?? null;
}

// ── COMBATE (overworld Y sala de mazmorra), CONSCIENTE DE VICTORIA-NO-CIERRA ──
// La semántica nueva (combat.ts get over(): party-empty): matar al último enemigo NO
// cierra el combate — imprime "VICTORY!" y la party debe SALIR ANDANDO por el borde
// (todos por la MISMA salida). Un driver que sólo ataca al azar se colgaría en un
// combate GANADO. Este driver: ataca hasta limpiar el bando enemigo, luego compromete
// una dirección de salida y camina a todos al borde. DETECTA "victoria-que-no-cierra".
async function arenaState() {
  return page.evaluate(() => {
    const c = window.__u5test.game.combat;
    if (!c) return { inCombat: false };
    const cur = c.currentUnit;
    const alive = (u) => u.status !== "dead" && u.status !== "fled";
    const enemiesLeft = c.combatants.filter((u) => alive(u) && (u.kind === "enemy" ? !u.charmed : u.charmed)).length;
    let aimAt = null, aimFrom = null, ax = null, ay = null, turn = "other";
    if (cur && cur.kind === "player" && !cur.charmed) {
      turn = "player"; ax = cur.x; ay = cur.y;
      // aimAt = rival en alcance más cercano (táctica del bot; era el auto-target del
      // aimGeometry pre-hotfix#4). aimFrom = arranque FIEL del cursor (último objetivo
      // o el actor, COMSUBS 0x0504): las flechas del bot lo llevan hasta aimAt.
      try {
        const nextWeapon = c.ensureAttackQueue(cur)[0];
        const range = Math.max(1, (nextWeapon && nextWeapon.range) || 1);
        const dist = (dx, dy) => { const d2 = dx * dx + dy * dy; let si = 1, n = 0, rest = d2; while (rest >= si) { rest -= si; si += 2; n++; } return n; };
        let best = null, bestD = Infinity;
        for (const u of c.combatants) {
          if (!c.isActive(u) || c.sideOf(u) === c.sideOf(cur)) continue;
          if (!c.canReach(cur, u, range, nextWeapon && nextWeapon.id)) continue;
          const d = dist(cur.x - u.x, cur.y - u.y);
          if (d < bestD) { bestD = d; best = u; }
        }
        aimAt = best ? { x: best.x, y: best.y } : null;
        const geo = c.aimGeometry();
        aimFrom = geo ? geo.initial : { x: cur.x, y: cur.y };
      } catch { /* sin geo */ }
    }
    return { inCombat: true, over: c.over, victory: c.victory, enemiesLeft, turn, aimAt, aimFrom, ax, ay };
  });
}
// Proyección de arena para el ESCAPE post-victoria (grid + ocupados + cofres impasables).
async function arenaExitState() {
  return page.evaluate(() => {
    const c = window.__u5test.game.combat;
    if (!c) return null;
    const cur = c.currentUnit;
    const alive = (u) => u.status !== "dead" && u.status !== "fled";
    if (!cur || cur.kind !== "player" || cur.charmed) return { turn: "other" };
    const tiles = c.mapTiles;
    const G = tiles.length;
    const chests = [];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (c.chestAt?.(x, y)) chests.push({ x, y });
    return {
      turn: "player", ax: cur.x, ay: cur.y, tiles,
      occ: c.combatants.filter(alive).map((u) => ({ x: u.x, y: u.y })),
      enemies: c.combatants.filter((u) => alive(u) && (u.kind === "enemy" ? !u.charmed : u.charmed)).map((e) => ({ x: e.x, y: e.y })),
      chests,
    };
  });
}
// ── PROBE DE PANELES EN COMBATE (batch 15: Z-stats y R en combate) ───────────
// El bucle de comando de COMBATE (COMBAT.OVL 0x0838, gate coreview.ts awaitingCommand)
// acepta (Z)stats y (R)eady mientras hay enemigos vivos — rutas NUEVAS del batch 15 que
// el driver de ataque puro nunca tocaba. Este probe, en el turno del jugador, abre el
// panel, ESCANEA ESPAÑOL dentro (fuga de inglés en el panel en-combate), verifica que no
// hay crash (#error), lo cierra (Escape robusto) y confirma que el combate SIGUE VIVO y
// jugable después (detector "panel-en-combate-no-cierra": el turno del jugador debe
// poder proseguir tras cerrar). Cap por combate para no derailar la pelea.
async function inCombatPanelProbe(cmd) {
  const before = await arenaState();
  if (!before.inCombat || before.turn !== "player") return;
  log({ level: "EVENT", msg: "in-combat-panel", cmd });
  await key(cmd);              // 'z' = Ztats, 'r' = Ready
  await page.waitForTimeout(140);
  await scanSpanish();         // fuga de inglés DENTRO del panel en-combate
  const dp = await domPanels();
  if (dp.error) { await anomaly("in-combat-panel-error", { cmd }); return; }
  // Cierre robusto (el panel de combate se cierra con Escape; blur por si un getstring
  // de piel retuvo el foco). Reintenta hasta 3 veces.
  for (let k = 0; k < 3; k++) {
    await blurEsc();
    const st = await arenaState().catch(() => null);
    if (!st) { await anomaly("in-combat-panel-state-lost", { cmd }); return; }
    if (!st.inCombat) return; // el panel/flee terminó el combate: válido, el bucle sale
    // Si volvemos a tener turno de jugador con estado legible, el panel cerró bien.
    if (st.turn === "player" || st.turn === "other") break;
  }
  // Confirma jugabilidad: tras cerrar, el combate debe seguir avanzando. Un pase basta;
  // si el panel quedó tragando input, arenaState seguirá clavado y lo caza combat-never-ends.
  await key(" ");
  await page.waitForTimeout(45);
}

async function actCombat() {
  stats.combats += 1;
  let victoryTurns = 0, lootGrabbed = false, panelProbes = 0, lastActorKey = "", stuckSame = 0, noReach = 0, fleeing = false;
  const goldAtStart = (await snapshot())?.gold ?? 0;
  for (let i = 0; i < 700; i++) {
    const s = await arenaState();
    if (!s.inCombat) return;
    await scanSpanish();
    if (s.turn === "other") { await key(" "); await page.waitForTimeout(45); continue; }
    // Bando enemigo LIMPIO (victoria): recoger botín una vez + salir por el borde.
    if (s.victory || s.enemiesLeft === 0) {
      if (!lootGrabbed) {
        // (G)et del botín de suelo con CONTABILIDAD de double/lost-credit.
        await lootGetProbe(goldAtStart);
        lootGrabbed = true;
      }
      victoryTurns += 1;
      // Salida post-victoria con BFS que RODEA muros/ocupados/cofres impasables (calco de
      // nav.ts escapeFirstStep), por el borde MÁS CERCANO al actor ACTUAL — cada miembro a
      // su arista, como un jugador. Si un cofre tapona adyacente, se ABRE con Open direccional
      // (ejercita el "cofre direccional" del batch 15) para retirarlo. Pre-triage del lead:
      // el "victory-cannot-exit" previo era LÍMITE DEL BOT (dir única sin rodeo), no softlock.
      const ex = await arenaExitState();
      const ax = ex?.ax ?? s.ax ?? 5, ay = ex?.ay ?? s.ay ?? 5;
      const G = ex?.tiles?.length ?? 11;
      const toLeft = ax, toRight = (G - 1) - ax, toTop = ay, toBottom = (G - 1) - ay;
      const m = Math.min(toLeft, toRight, toTop, toBottom);
      const exitDir = m === toLeft ? "west" : m === toRight ? "east" : m === toTop ? "north" : "south";
      let moved = false;
      if (ex?.tiles) {
        const cd = chestOpenDir(ex);
        if (cd) { await key("o"); await key(DIR_KEY[cd]); await page.waitForTimeout(60); moved = true; } // Open direccional retira el cofre
        else {
          const step = escapeFirstStep(ex, exitDir);
          if (step) { await key(DIR_KEY[step]); await page.waitForTimeout(45); moved = true; }
        }
      }
      if (!moved) {
        // Sin grid o sin ruta BFS: camina a la arista cardinal + nudge perpendicular alterno.
        await key(DIR_KEY[exitDir]); await page.waitForTimeout(45);
        const s2 = await arenaState();
        const actorKey = `${ax},${ay}`;
        if (s2.inCombat && s2.turn === "player" && s2.ax === ax && s2.ay === ay) {
          stuckSame = actorKey === lastActorKey ? stuckSame + 1 : 1;
          await key(stuckSame % 2 === 0
            ? (exitDir === "west" || exitDir === "east" ? "ArrowDown" : "ArrowRight")
            : (exitDir === "west" || exitDir === "east" ? "ArrowUp" : "ArrowLeft"));
        } else stuckSame = 0;
        lastActorKey = `${ax},${ay}`;
      }
      if (victoryTurns > 260) { await anomaly("victory-cannot-exit", { ax, ay, exitDir, chests: ex?.chests?.length ?? null, note: "bot-exit-limit per lead pre-triage; needs manual witness if it fires" }); return; }
      continue;
    }
    // Aún hay enemigos: de vez en cuando abre un panel en-combate (Z/R, batch 15)
    // antes de actuar, con tope de 3 por pelea para no derailar la pelea.
    if (panelProbes < 3 && rnd() < 0.12) { panelProbes += 1; await inCombatPanelProbe(rnd() < 0.5 ? "z" : "r"); continue; }
    // ataca si hay alcance; si no, CAMINA hacia el enemigo (BFS que rodea muros/cofres).
    if (s.aimAt) {
      // 'a' abre el cursor en aimFrom (fiel); flechas vía la celda del actor hasta
      // aimAt (cada tramo mantiene dist ≤ range); Enter confirma. Mismo
      // playerAttack(celda) que pre-hotfix.
      await key("a");
      const seg = (a, b, out) => {
        for (let x = a.x; x !== b.x; x += Math.sign(b.x - a.x)) out.push(b.x > a.x ? "ArrowRight" : "ArrowLeft");
        for (let y = a.y; y !== b.y; y += Math.sign(b.y - a.y)) out.push(b.y > a.y ? "ArrowDown" : "ArrowUp");
      };
      const arrows = [];
      const actor = { x: s.ax, y: s.ay };
      seg(s.aimFrom ?? actor, actor, arrows);
      seg(actor, s.aimAt, arrows);
      for (const k of arrows) await key(k);
      await key("Enter");
      noReach = 0;
    }
    else {
      const cs = await arenaExitState();
      const step = cs?.tiles ? combatFirstStep(cs) : null;
      if (step) { await key(DIR_KEY[step]); noReach = 0; }
      else {
        // Sin ruta melé al enemigo (divisoria impasable) y el bot no tiene ranged/hechizo:
        // tras 25 turnos sin alcance → HUIR por el borde (calco de la salida post-victoria).
        // Evita el wedge combat-never-ends en salas con enemigos inalcanzables (límite del
        // bot, no bug — mismo criterio que F3). Se registra como flee, no como anomalía.
        noReach += 1;
        if (cs?.tiles && noReach > 25) {
          if (!fleeing) { fleeing = true; log({ level: "EVENT", msg: "combat-flee-unreachable", ax: cs.ax, ay: cs.ay, enemies: cs.enemies?.length ?? null }); }
          const G = cs.tiles.length, ax = cs.ax, ay = cs.ay;
          const toL = ax, toR = (G - 1) - ax, toT = ay, toB = (G - 1) - ay, m = Math.min(toL, toR, toT, toB);
          const exitDir = m === toL ? "west" : m === toR ? "east" : m === toT ? "north" : "south";
          await key(DIR_KEY[escapeFirstStep(cs, exitDir) ?? exitDir]);
        } else if (rnd() < 0.6) await key(pick(DIRS));
        else await key(" ");
      }
    }
    await page.waitForTimeout(45);
  }
  // Tope de iteraciones alcanzado. Si estábamos HUYENDO de enemigos inalcanzables
  // (salas selladas DEADEND-fiel de ch24 Covetous: enemigos wall-bound + party en
  // bolsillo amurallado — testigo shots/…-a1: miembro encajonado, «Blocked!» en bucle),
  // NO es anomalía del port: es topología fiel que el bot no puede resolver. Se
  // abandona con EVENTO y recuperación dura (reload), para no moler 700 iter ×N con
  // el MISMO wedge (el patrón de la corrida 2026-07-20: 24 anomalías idénticas).
  if (fleeing) {
    log({ level: "EVENT", msg: "combat-abandoned-unreachable-deadend", iterations: 700 });
    await hardRecover();
    return;
  }
  await anomaly("combat-never-ends", { iterations: 700 });
  for (let i = 0; i < 60; i++) { await key(pick(["ArrowLeft", "ArrowUp"])); await page.waitForTimeout(50); if (!(await arenaState()).inCombat) return; }
  // Sigue en combate tras el intento de escape: recuperación dura también (el bucle
  // exterior re-entraría a actCombat con el mismo wedge y repetiría la anomalía).
  if ((await arenaState().catch(() => ({ inCombat: false }))).inCombat) await hardRecover();
}

// Recuperación DURA del driver: re-boot fresco (mismo mecanismo que la rama party-dead)
// y, en modo dirigido, re-entrada a mazmorra. Para wedges de topología fiel (dead-end
// sellado) donde no existe salida jugable.
async function hardRecover() {
  stats.reloads += 1;
  await page.goto(`${BASE}?nointro&fresh&lang=es`);
  await waitWorld();
  if (DUNGEON_MODE) await enterDungeonDeepLink(pick(DUNGEON_IDS));
}

// Recoge botín de suelo con (G)et y comprueba la CONTABILIDAD: la línea "¡Halláis N de
// oro!" / "Thou dost find N gold!" debe casar el delta de oro EXACTO (ni doble ni cero).
const GOLD_LINE = /(?:Halláis|dost find)\s+(\d+)\s+(?:de oro|gold)/i;
async function lootGetProbe(goldBefore) {
  const before = (await snapshot())?.gold ?? goldBefore;
  await key("g");
  await page.waitForTimeout(90);
  await scanSpanish();
  const after = (await snapshot())?.gold ?? before;
  const lines = await page.evaluate(() => window.__u5test?.consoleLines?.().slice(-4) ?? []).catch(() => []);
  const goldLine = lines.map((l) => l.match(GOLD_LINE)).find(Boolean);
  if (goldLine) {
    const announced = Number(goldLine[1]);
    const delta = after - before;
    if (delta !== announced && delta !== 0) {
      // delta 0 = el (G)et no era sobre este botín (otra celda) → no accionable.
      await anomaly("loot-gold-mismatch", { announced, delta, before, after, line: goldLine[0] });
    }
  }
  if (after < before) await anomaly("loot-negative-gold", { before, after });
}

// ── MAZMORRA (movimiento 3D + luz + cofres + descenso + salas) ───────────────
// Lee la celda VIVA bajo la party (type/sub) para decidir acciones dirigidas.
async function dungeonCellHere() {
  return page.evaluate(() => {
    const g = window.__u5test.game; const ds = g.dungeonState;
    if (!ds) return null;
    const p = ds.pos;
    const c = ds.cellAt(p.floor, p.x, p.y);
    return { type: c.type, sub: c.sub, floor: p.floor, x: p.x, y: p.y, light: g.dungeonLightDepth ?? 0 };
  });
}
async function castInLor() {
  await key("c"); await key("1"); await key("i"); await key("l"); await key("Enter");
  await page.waitForTimeout(120);
  await scanSpanish();
}
async function castDesPor() {
  await key("c"); await key("1"); await key("d"); await key("p"); await key("Enter");
  await page.waitForTimeout(120);
  await scanSpanish();
}
// Cofres YA abiertos en la visita ACTUAL (clave floor:x:y). El cofre del fondo de Deceit
// (7,5,5) está amurallado por 4 lados: la party cae DENTRO y no puede salir salvo por Des
// Por, así que sin esta memoria el bucle re-abriría el mismo cofre vacío eternamente
// ("Already Open!") y saturaría el detector. Se limpia en cada entrada a mazmorra.
const openedChests = new Set();
// Cofre de pasillo (type 0x4/0x7): (O)pen estando ENCIMA. Contabilidad + detector de
// "cofre-que-no-abre" (nada cambia NI hay mensaje de resultado en la 1ª apertura). El
// botín REAL es un árbol combinado (oro/comida/llaves/gemas + trampa GAS) — hay que mirar
// TODOS los recursos, no sólo el oro (un cofre puede dar sólo comida).
async function openChestHere(cell) {
  const ck = `${cell.floor}:${cell.x}:${cell.y}`;
  const before = await snapshot();
  const gBefore = before?.gold ?? 0, kBefore = before?.keys ?? 0, fBefore = before?.food ?? 0, mBefore = before?.gems ?? 0;
  await key("o");
  await page.waitForTimeout(120);
  await scanSpanish();
  stats.chestsOpened += 1;
  const after = await snapshot();
  const lines = await page.evaluate(() => window.__u5test?.consoleLines?.().slice(-6) ?? []).catch(() => []);
  const goldLine = lines.map((l) => l.match(GOLD_LINE)).find(Boolean);
  const resourceChanged = !!after && (after.gold !== gBefore || after.keys !== kBefore || after.food !== fBefore || after.gems !== mBefore);
  // Mensajes de resultado legítimos: botín (oro/comida/llave/gema), trampa (GAS/veneno),
  // vacío, o "ya abierto". Con CUALQUIERA de ellos, el (O)pen respondió → no es "no-abre".
  const sawMsg = lines.some((l) => /oro|gold|llave|key|trampa|trap|gas|veneno|poison|gema|gem|comida|food|nada|empty|vac|abiert|already open|hall[áa]is|chest opened/i.test(l));
  if (!resourceChanged && !sawMsg) await anomaly("chest-cannot-open", { cell, lines });
  if (goldLine) {
    const announced = Number(goldLine[1]);
    const delta = (after?.gold ?? gBefore) - gBefore;
    if (delta !== announced && delta !== 0) await anomaly("loot-gold-mismatch", { where: "chest", announced, delta, line: goldLine[0] });
  }
  openedChests.add(ck);
  log({ level: "EVENT", msg: "chest-open", cell, goldDelta: (after?.gold ?? gBefore) - gBefore, keyDelta: (after?.keys ?? kBefore) - kBefore, foodDelta: (after?.food ?? fBefore) - fBefore, gemDelta: (after?.gems ?? mBefore) - mBefore });
}
// Dispara una SALA de combate REAL (startDungeonRoomCombat) para ejercitar la
// permanencia post-victoria. Índices válidos 0..nCombatMaps-1; 17 = Room-1 de Deceit.
async function roomCombatProbe() {
  const started = await page.evaluate(() => {
    const g = window.__u5test.game;
    if (g.combat || !g.dungeonState) return false;
    const n = g.combatResources?.combatMaps?.length ?? 0;
    if (!n) return false;
    // Sesgo a mapas de sala poblados; 17 es la Room-1 de Deceit (7× Gremlin).
    const idx = 17 < n ? 17 : Math.floor(Math.random() * n);
    try { g.startDungeonRoomCombat(idx); } catch { return false; }
    return g.combat != null;
  });
  if (started) { stats.roomCombats += 1; log({ level: "EVENT", msg: "room-combat-probe" }); await actCombat(); }
}
// ── DESCENSO DIRIGIDO al cofre de pasillo (réplica JS de dungeonDescendTo, nav.ts) ──
// Los cofres de mazmorra viven en el FONDO (Deceit floor 7 (5,5)) y sólo se alcanzan
// CAYENDO por fosos + Des Por (hallazgo topológico ch14b). Este probe planifica el
// descenso REAL (Dijkstra sobre el grid estático) y abre el cofre con contabilidad —
// ejercita "cofre de pasillo con ruta real + trampa completa" que el movimiento aleatorio
// nunca alcanza. Determinista sobre el mapa (no RNG). Devuelve true si abrió el cofre.
const DN = 8;
const DCW = ["north", "east", "south", "west"]; // horario (giro derecha)
function facingToward(x, y, nx, ny) {
  let dx = nx - x, dy = ny - y;
  if (dx > 1) dx -= DN; if (dx < -1) dx += DN;
  if (dy > 1) dy -= DN; if (dy < -1) dy += DN;
  if (dy === -1) return "north"; if (dy === 1) return "south";
  if (dx === -1) return "west"; return "east";
}
async function dpos() { return (await snapshot())?.dpos ?? null; }
async function readAllFloors() {
  return page.evaluate(() => {
    const ds = window.__u5test.game.dungeonState;
    const out = [];
    for (let f = 0; f < 8; f++) { const fl = []; for (let y = 0; y < 8; y++) { const row = []; for (let x = 0; x < 8; x++) { const c = ds.cellAt(f, x, y); row.push({ type: c.type, sub: c.sub }); } fl.push(row); } out.push(fl); }
    return out;
  });
}
function planDescent(grid, sf, sx, sy, goalFn) {
  const cell = (f, x, y) => grid[f][y][x];
  const isRoom = (c) => c.type === 0xf || c.type === 0xa;
  const isWall = (c) => c.type === 0xb || c.type === 0xc;
  const isField = (c) => c.type === 8;
  const trapKind = (c) => (c.type === 6 ? (c.sub & 7) : -1);
  const k = (f, x, y) => `${f}:${x}:${y}`;
  const start = k(sf, sx, sy);
  const dist = new Map([[start, 0]]); const prev = new Map();
  let pq = [{ s: start, c: 0 }];
  const pop = () => { let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i].c < pq[bi].c) bi = i; return pq.splice(bi, 1)[0]; };
  let goal = null;
  while (pq.length) {
    const { s, c } = pop();
    if (c > (dist.get(s) ?? Infinity)) continue;
    const [f, x, y] = s.split(":").map(Number);
    if (goalFn(f, x, y)) { goal = s; break; }
    const cur = cell(f, x, y);
    const relax = (ns, w, how) => { const nc = c + w; if (nc < (dist.get(ns) ?? Infinity)) { dist.set(ns, nc); prev.set(ns, { from: s, how }); pq.push({ s: ns, c: nc }); } };
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = (x + dx + DN) % DN, ny = (y + dy + DN) % DN;
      const nc = cell(f, nx, ny);
      if (isRoom(nc)) { if (goalFn(f, nx, ny)) relax(k(f, nx, ny), 1, "step-room"); continue; }
      if (isWall(nc) || isField(nc)) continue;
      const tk = trapKind(nc);
      if (tk === 1) { if (f < 7) relax(k(f + 1, nx, ny), 5, "pitfall"); continue; }
      if (tk === 2) continue;
      relax(k(f, nx, ny), 1, "step");
    }
    if ((cur.type === 2 || cur.type === 3) && f < 7) relax(k(f + 1, x, y), 1, "klimbdown");
    if ((cur.type === 1 || cur.type === 3) && f > 0) relax(k(f - 1, x, y), 1, "klimbup");
    if (f < 7 && cell(f + 1, x, y).type === 0) relax(k(f + 1, x, y), 3, "despor");
  }
  if (!goal) return null;
  const path = []; let curk = goal;
  while (prev.has(curk)) { const p = prev.get(curk); const [f, x, y] = curk.split(":").map(Number); path.unshift({ f, x, y, how: p.how }); curk = p.from; }
  return path;
}
async function turnTo(target) {
  for (let i = 0; i < 4; i++) {
    const p = await dpos(); if (!p) return;
    if (p.facing === target) return;
    const right = (DCW.indexOf(target) - DCW.indexOf(p.facing) + 4) % 4;
    await key(right <= 2 ? "ArrowRight" : "ArrowLeft");
  }
}
async function faceStep(cur, nx, ny) { await turnTo(facingToward(cur.x, cur.y, nx, ny)); await key("ArrowUp"); await page.waitForTimeout(60); }
async function klimb(dir) {
  const needs = await page.evaluate(() => window.__u5test.game.dungeonKlimbNeedsChoice());
  await key("k"); if (needs) await key(dir === "up" ? "u" : "d"); await page.waitForTimeout(70);
}
// Deceit (33): cofre floor 7 (5,5). Descenso dirigido + (O)pen con contabilidad.
async function descendToChestProbe() {
  let s = await snapshot();
  if (!s?.inDungeon || s.dpos?.dungeon !== 33) return false;
  if ((s.light ?? 0) === 0) await castInLor();
  const grid = await readAllFloors();
  const goalFn = (f, x, y) => f === 7 && x === 5 && y === 5;
  for (let iter = 0; iter < 60; iter++) {
    if ((await snapshot())?.inCombat) { await actCombat(); continue; }
    const p = await dpos(); if (!p) return false;
    if (goalFn(p.floor, p.x, p.y)) {
      const cell = await dungeonCellHere();
      if (cell) await openChestHere(cell);
      return true;
    }
    const path = planDescent(grid, p.floor, p.x, p.y, goalFn);
    if (!path || !path.length) { log({ level: "EVENT", msg: "descend-no-plan", from: p }); return false; }
    let i = 0;
    while (i < path.length && path[i].how === "step") {
      const n = path[i]; const cur = await dpos(); if (!cur) return false;
      if (grid[n.f][n.y][n.x].type === 0xd) { await turnTo(facingToward(cur.x, cur.y, n.x, n.y)); await key("s"); }
      await faceStep(cur, n.x, n.y); i++;
    }
    const op = path[i];
    if (!op) continue;
    if (op.how === "klimbdown") await klimb("down");
    else if (op.how === "klimbup") await klimb("up");
    else if (op.how === "despor") await castDesPor();
    else if (op.how === "pitfall" || op.how === "step-room") { const cur = await dpos(); if (cur) await faceStep(cur, op.x, op.y); }
    await scanSpanish();
  }
  log({ level: "EVENT", msg: "descend-budget-exhausted" });
  return false;
}

let chestProbeDone = 0; // límite de descensos dirigidos por corrida (caros)
async function actDungeon() {
  const s0 = await snapshot();
  if (!s0?.inDungeon) return;
  // Luz: si está a oscuras, In Lor (la vista 3D y el (S)earch la necesitan).
  if ((s0.light ?? 0) === 0 && rnd() < 0.9) { await castInLor(); return; }
  // Probe dirigido de cofre de pasillo (Deceit): sólo desde la ENTRADA (floor 0), donde
  // el planificador SIEMPRE halla ruta al cofre (7,5,5); desde una posición profunda al
  // azar la topología puede no tener vuelta al cofre (descend-no-plan, no accionable).
  if (s0.dpos?.dungeon === 33 && s0.dpos?.floor === 0 && chestProbeDone < 3 && rnd() < 0.6) {
    chestProbeDone += 1;
    await descendToChestProbe();
    return;
  }
  const steps = 6 + Math.floor(rnd() * 22);
  for (let i = 0; i < steps; i++) {
    const s = await snapshot();
    if (!s || !s.inDungeon) return;
    if (s.inCombat) { await actCombat(); continue; }
    const cell = await dungeonCellHere();
    // Cofre bajo la party → abrir con contabilidad (una vez por visita; el cofre del fondo
    // de Deceit está amurallado y re-abrirlo sólo da "Already Open!").
    if (cell && (cell.type === 0x4 || cell.type === 0x7) && !openedChests.has(`${cell.floor}:${cell.x}:${cell.y}`)) {
      await openChestHere(cell); await page.waitForTimeout(60); continue;
    }
    const r = rnd();
    if (r < 0.58) await key("ArrowUp");                       // avanzar (puede caer en foso / entrar a sala)
    else if (r < 0.76) await key(pick(["ArrowLeft", "ArrowRight"]));
    else if (r < 0.84) await key("s");                        // (S)earch (revela puertas/trampas)
    else if (r < 0.90) await key("k");                        // (K)limb escalera
    else if (r < 0.94) await castDesPor();                    // descenso mágico
    else if (r < 0.96) await roomCombatProbe();               // sala de combate (permanencia post-victoria)
    else if (r < 0.975) await campProbe();                    // (H)ole up & camp en mazmorra (refugio; carril sell-chatter)
    else if (r < 0.99) await viewGemProbe();                  // (V)iew a gem (DNGLOOK 0x06a8, planta 8×8)
    else await key("i");                                      // (I)gnite torch (o "None owned!")
    await page.waitForTimeout(70);
    await scanSpanish();
  }
}

// (H)ole up & camp EN MAZMORRA (kernel 0x3C9A rama loc>=0x21; carril sell-chatter —
// el censo i18n marcaba el «refugio de mazmorra» como hueco sin cobertura). Secuencia:
// 'h' → "Hole up & camp!" → horas (dígito) → watch Y/N → duerme. Sin watch ('n') para
// no derivar al picker de guardia. Escanea ES tras cada fase (cabecera/prompts/cura).
async function campProbe() {
  log({ level: "EVENT", msg: "camp-probe" });
  await key("h");
  await page.waitForTimeout(120);
  await scanSpanish();
  await key(String(1 + Math.floor(rnd() * 3))); // 1-3 horas
  await page.waitForTimeout(120);
  await scanSpanish();
  await key("n"); // sin guardia (con party de 1 el prompt puede no salir: tecla inocua)
  // el sueño avanza el reloj por horas; margen holgado + Escape de saneo por si un
  // prompt residual quedara armado (inocuo si no hay panel).
  await page.waitForTimeout(900);
  await scanSpanish();
  await blurEsc();
}

// (V)iew a gem en mazmorra (dispatcher 0x341A rama loc>=0x21 → DNGLOOK 0x06a8): la
// vista 8×8 de la planta con glifos RUNES + cruz verde. seedCaster garantiza gemas.
// Cualquier tecla la cierra; se verifica que el mundo sigue vivo después.
async function viewGemProbe() {
  const before = (await snapshot())?.gems ?? 0;
  log({ level: "EVENT", msg: "viewgem-probe", gems: before });
  await key("v");
  await page.waitForTimeout(200);
  await scanSpanish();
  await key(" "); // cierra la vista
  await page.waitForTimeout(120);
  const after = await snapshot();
  if (after && before > 0 && (after.gems ?? 0) > before) await anomaly("viewgem-gem-gain", { before, after: after.gems });
}

async function actConversation(s) {
  // Conversación fiel = CANVAS, entrada por keywords tecleadas o Space/bye.
  const r = rnd();
  if (r < 0.35) { for (const ch of pick(["name", "job", "bye", "yes", "no", "health"])) { await page.keyboard.press(ch); await page.waitForTimeout(25); } await key("Enter"); }
  else if (r < 0.7) await key(" ");            // avanzar página
  else { await key("Enter"); await key("Escape"); } // bye vacío
  await page.waitForTimeout(80);
}
async function actShop() {
  const r = rnd();
  if (r < 0.5) await key(pick(["ArrowUp", "ArrowDown", " ", "Enter"]));
  else await key("Escape");
  await page.waitForTimeout(80);
}
async function actDomPanel(dp) {
  if (dp.save > 0) {
    const panel = page.locator(".save-panel:visible").first();
    const btns = panel.locator("button:visible");
    const n = await btns.count().catch(() => 0);
    if (n > 0 && rnd() < 0.4) {
      const b = btns.nth(Math.floor(rnd() * n));
      const label = (await b.textContent().catch(() => "")) ?? "";
      if (/delete|borrar/i.test(label) && rnd() < 0.85) { await blurEsc(); return; }
      await b.click({ timeout: 2000 }).catch(() => {});
      if (/load|cargar/i.test(label)) stats.loads += 1;
    } else await blurEsc();
    return;
  }
  await blurEsc(); // journal/minimap/viewgem → cerrar
}

const TRAVEL = [
  "loc=13&x=15&y=15&hour=10",   // Iolo's Hut
  "loc=2&x=26&y=2&hour=11",     // Britain día
  "loc=2&x=15&y=15&hour=21",    // Britain noche
  "loc=17&x=20&y=20&hour=12",   // Castillo LB
  "loc=1&x=15&y=15&hour=13",    // Moonglow
  "x=76&y=40&hour=10",          // overworld grass día
  "x=102&y=43&hour=2",          // overworld grass noche (spawns)
  "x=240&y=74&hour=3",          // junto a Deceit, madrugada
  "x=80&y=190&hour=23",         // sur, noche
];
async function travel() {
  await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("u5clone:save:save-"));
    keys.slice(0, Math.max(0, keys.length - 5)).forEach((k) => localStorage.removeItem(k));
  }).catch(() => {});
  const dest = pick(TRAVEL);
  await page.goto(`${BASE}?nointro&${dest}&lang=es`);
  await waitWorld();
  stats.travels += 1;
  log({ level: "EVENT", msg: "travel", dest });
}

async function actWorld() {
  const r = rnd();
  if (r < 0.004) { await travel(); return; }
  if (r < 0.55) await key(pick(DIRS));
  else if (r < 0.63) { await key("l"); await key(pick(DIRS)); }
  else if (r < 0.68) { await key("g"); await key(pick(DIRS)); }
  else if (r < 0.73) { await key("o"); await key(pick(DIRS)); }
  else if (r < 0.76) await key("s");
  else if (r < 0.79) await key("k");
  else if (r < 0.83) { await key("t"); await key(pick(DIRS)); }
  else if (r < 0.85) { await key("j"); await key(pick(DIRS)); }
  else if (r < 0.87) { await key("z"); await page.waitForTimeout(60); await key("Escape"); }   // ztats canvas → cerrar
  else if (r < 0.89) { await key("F6"); await page.waitForTimeout(60); await key("Escape"); }   // journal
  else if (r < 0.91) { await key("Tab"); await page.waitForTimeout(60); await key("Escape"); }  // minimap
  else if (r < 0.93) { await key("m"); await page.waitForTimeout(60); await key("Escape"); }    // mix
  else if (r < 0.95) { await key("r"); await page.waitForTimeout(60); await key("Escape"); }    // ready
  else if (r < 0.97) { await key("c"); await page.waitForTimeout(60); await key("Escape"); }    // cast
  else {
    await key("F5"); await page.waitForTimeout(150);
    const inp = page.locator(".save-panel:visible .save-name");
    if (await inp.count().catch(() => 0)) {
      await inp.fill("soak-slot").catch(() => {});
      const saveBtn = page.locator(".save-panel:visible button:visible", { hasText: /save|guardar/i }).first();
      await saveBtn.click({ timeout: 2000 }).catch(() => {});
      stats.saves += 1;
    }
    await blurEsc();
  }
}

// ── boot / main ──────────────────────────────────────────────────────────
const consoleErrors = [];
async function waitWorld() {
  await page.waitForFunction(() => { try { return !!window.__u5test?.worldReady?.(); } catch { return false; } }, { timeout: 25000 });
}
async function boot(browser) {
  page = await browser.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 400) consoleErrors.push(`http-${r.status()}: ${r.url()}`); });
  await page.goto(`${BASE}?nointro&fresh&lang=es`);
  await waitWorld();
  // sanity: idioma realmente en ES
  const lang = await page.evaluate(() => window.__u5test?.lang?.());
  if (lang !== "es") await anomaly("lang-not-es", { lang });
  if (DUNGEON_MODE) await enterDungeonDeepLink(pick(DUNGEON_IDS));
}

const browser = await chromium.launch({ headless: !("headed" in ARGS), args: ["--window-size=1100,850"] });
await boot(browser);
log({ level: "INFO", msg: "soak-es start", seed: SEED, minutes: MINUTES, base: BASE, dungeonMode: DUNGEON_MODE, dungeonIds: DUNGEON_IDS });
console.log(`Soak-ES start: seed=${SEED} minutes=${MINUTES} dungeonMode=${DUNGEON_MODE} ids=[${DUNGEON_IDS}] log=${LOG}`);

const deadline = Date.now() + MINUTES * 60_000;
let lastReport = Date.now();
let scanDeadReported = false;
while (Date.now() < deadline) {
  try {
    let s = await snapshot();
    const dp = await domPanels();
    if (!s) {
      // Reintento antes de declarar: un null transitorio (página en transición — p.ej.
      // recarga de recuperación aún asentándose) no es anomalía; solo si PERSISTE.
      await page.waitForTimeout(400);
      s = await snapshot().catch(() => null);
      if (!s) { await anomaly("state-unavailable", {}); await page.reload(); await waitWorld().catch(() => {}); continue; }
    }

    if (s.chars.length && s.chars.every((c) => c.hp <= 0)) {
      log({ level: "EVENT", msg: "party-dead, reload" }); stats.reloads += 1;
      await page.goto(`${BASE}?nointro&fresh&lang=es`); await waitWorld();
      if (DUNGEON_MODE) await enterDungeonDeepLink(pick(DUNGEON_IDS));
      continue;
    }

    // Modo DIRIGIDO: si salimos de la mazmorra (klimb-up al overworld, Des Por al
    // Underworld, etc.) y no hay modal, RE-ENTRAMOS para saturar el subsistema 3D.
    if (DUNGEON_MODE && !s.inDungeon && !s.inCombat && !s.dialogue && !s.shop && dp.save === 0 && !dp.journal && !dp.minimap && !dp.viewgem) {
      await enterDungeonDeepLink(pick(DUNGEON_IDS));
      stats.actions += 1;
      continue;
    }

    if (s.inCombat) { stats.byAction.combat = (stats.byAction.combat ?? 0) + 1; await actCombat(); }
    else if (s.inDungeon) { stats.byAction.dungeon = (stats.byAction.dungeon ?? 0) + 1; stats.dungeons += 1; await actDungeon(); }
    else if (s.dialogue) { stats.byAction.talk = (stats.byAction.talk ?? 0) + 1; await actConversation(s); }
    else if (s.shop) { stats.byAction.shop = (stats.byAction.shop ?? 0) + 1; await actShop(); }
    else if (dp.save > 0 || dp.journal || dp.minimap || dp.viewgem) { stats.byAction.panel = (stats.byAction.panel ?? 0) + 1; await actDomPanel(dp); }
    else { stats.byAction.world = (stats.byAction.world ?? 0) + 1; await actWorld(); }

    stats.actions += 1;
    await page.waitForTimeout(35);
    await scanSpanish();

    while (consoleErrors.length) await anomaly("js-error", { msg: consoleErrors.shift() });

    const s2 = await snapshot();
    const dp2 = await domPanels();
    await checkInvariants(s2, dp2);

    if (Date.now() - lastReport > 120_000) {
      lastReport = Date.now();
      log({ level: "STATUS", stats: { ...stats }, state: s2 });
      console.log(`[status] actions=${stats.actions} anomalies=${stats.anomalies} enTexts=${stats.enTexts} (hard=${stats.enTextsHard}) scanned=${stats.scannedLines} combats=${stats.combats} rooms=${stats.roomCombats} chests=${stats.chestsOpened} dungeon=${s2?.inDungeon ? JSON.stringify(s2.dpos) : "no"}`);
      // G5: detector muerto detectado EN CALIENTE (no solo al final del run).
      const hb = scanHeartbeatProblem(stats);
      if (hb && !scanDeadReported) { scanDeadReported = true; await anomaly("scan-dead", { detail: hb }); }
    }
  } catch (e) {
    await anomaly("driver-exception", { msg: String(e).slice(0, 300) });
    try {
      await page.reload({ timeout: 20000 }); await waitWorld(); stats.reloads += 1;
      if (DUNGEON_MODE) await enterDungeonDeepLink(pick(DUNGEON_IDS));
    } catch { break; }
  }
}

// G5: si el run terminó sin que el detector escaneara UNA sola línea, es un
// verde en falso — cuenta como anomalía antes de decidir el exit.
const hbFinal = scanHeartbeatProblem(stats);
if (hbFinal && !scanDeadReported) { scanDeadReported = true; await anomaly("scan-dead", { detail: hbFinal }); }
log({ level: "INFO", msg: "soak-es end", stats });
console.log(`SOAK-ES END — actions=${stats.actions} anomalies=${stats.anomalies} enTexts=${stats.enTexts} (hard=${stats.enTextsHard}) scanned=${stats.scannedLines} scanErrors=${stats.scanErrors} combats=${stats.combats} rooms=${stats.roomCombats} chests=${stats.chestsOpened} dungeonEntries=${stats.dungeonEntries} saves=${stats.saves} loads=${stats.loads} reloads=${stats.reloads} travels=${stats.travels}`);
console.log(`Log: ${LOG}`);
await browser.close();
// G4: el pilar español decide el exit — anomalías O fugas HARD de inglés = 2.
process.exit(finalExitCode(stats));
