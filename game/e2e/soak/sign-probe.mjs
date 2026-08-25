// Sonda de LETREROS (batch 15: "letreros en log") — carril qa/soak-b15.
// Lee carteles REALES de Britain/Trinsic bajo lang=es y verifica:
//   1) que la (L)ook sobre el tile de cartel dibuja la CAJA en el flujo de consola
//      (varias líneas nuevas, no una fabricación "A sign reads:"),
//   2) que NO se fuga inglés (mismo clasificador que soak-es.mjs: HARD/SOFT + exentos),
//   3) que el prefijo look ("Thou dost see") sale traducido (si aparece crudo, es fuga).
// Determinista: setPosition adyacente al cartel (debugApi) + Look en su dirección.
//
// Uso: node game/e2e/soak/sign-probe.mjs   (dev server en U5_SOAK_URL, default :5246)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.U5_SOAK_URL ?? "http://localhost:5246/";
const DIR = path.dirname(new URL(import.meta.url).pathname);
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const LOG = path.join(DIR, `sign-probe-${STAMP}.jsonl`);
const signs = JSON.parse(fs.readFileSync(path.join(DIR, "../../assets/signs.json"), "utf8"));

// ── clasificador de inglés (copia fiel de soak-es.mjs) ──────────────────────
const EXEMPT = new Set([
  "britannia", "britain", "jhelom", "yew", "minoc", "trinsic", "skara", "brae",
  "moonglow", "magincia", "cove", "buccaneer", "buccaneers", "den", "serpent", "hold",
  "empath", "abbey", "lycaeum", "paws", "fogsbane", "stormcrow", "greyhaven",
  "bordermarch", "farthing", "sutek", "palace", "castle", "deceit", "despise",
  "destard", "wrong", "covetous", "shame", "hythloth", "doom", "dungeon",
  "lord", "british", "blackthorn", "iolo", "shamino", "dupre", "geoffrey", "katrina",
  "mariah", "julia", "jaana", "sentri", "gwenno", "toshi", "saduj", "avatar", "ultima",
  "exodus", "minax", "mondain", "shadowlords", "faulinei", "astaroth", "nosfentor",
  "batlin", "sherry", "smith", "hawkwind", "johne", "seggallion",
  "honesty", "compassion", "valor", "justice", "sacrifice", "honor", "spirituality",
  "humility", "truth", "love", "courage", "beh", "cah", "mu", "ra", "ahm", "sum", "om",
  "z-stats", "zstats", "hp", "mp", "hmp", "str", "dex", "int", "ml", "lv", "exp",
  "ankh", "karma", "am", "pm", "gp",
  "in", "vas", "mani", "flam", "grav", "por", "an", "bet", "corp", "des", "ex",
  "hur", "jux", "kal", "lor", "nox", "ort", "quas", "rel", "sanct", "tym", "uus", "wis", "ylem", "zu",
]);
const HARD_WORDS = /\b(thou|thee|thy|thine|hast|dost|doth|art|wilt|shalt|ye|unto|welcome|hello|goodbye|nothing|none|cannot|locked|opened|nobody|north|south|east|west|slain|killed|attacks?|misses?|blocked|night|dead|alive|door|chest|poison|sleep|hunger|starving|player|spell|reagent|reagents|weapon|armou?r|nobody|whom|who|cast|ready|wear|whither|enemy|enemies|escape|success|failed|hidden|found)\b/i;
const HARD_PHRASE = /\b(you see|you find|you are|there is|there are|press\b|game over|thou dost|by what name|art thou|new game|what o'clock|for what|& who)\b/i;
const SOFT_WORDS = ["the", "you", "your", "and", "with", "of", "to", "is", "are", "has", "have", "what", "that", "this", "from", "for", "not", "but", "all", "can", "will", "here", "now", "who", "why", "how"];
const stripExempt = (line) => line.toLowerCase().replace(/[^a-z'\s]/g, " ").split(/\s+/).filter((w) => w && !EXEMPT.has(w)).join(" ");
function classifyEnglish(rawLine) {
  const line = rawLine.trim();
  if (!line) return null;
  const cleaned = stripExempt(line);
  if (!cleaned) return null;
  if (HARD_PHRASE.test(line)) return { tier: "HARD", why: "phrase", line: rawLine };
  if (HARD_WORDS.test(cleaned)) { const m = cleaned.match(HARD_WORDS); return { tier: "HARD", why: "word:" + (m ? m[0] : "?"), line: rawLine }; }
  const hits = new Set();
  for (const w of SOFT_WORDS) if (new RegExp("\\b" + w + "\\b").test(cleaned)) hits.add(w);
  if (hits.size >= 2) return { tier: "SOFT", why: "funtores:" + [...hits].join(","), line: rawLine };
  return null;
}

const results = [];
function log(o) { fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), ...o }) + "\n"); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE + "?nointro&fresh&lang=es");
  await page.waitForFunction(() => { try { return !!window.__u5test?.worldReady?.(); } catch { return false; } }, { timeout: 25000 });
  await page.waitForFunction(() => !!window.__u5debug, { timeout: 10000 });

  const cl = () => page.evaluate(() => window.__u5test?.consoleLines?.() ?? []);
  const goTo = (loc, floor) => page.evaluate(([l, f]) => window.__u5debug.goToLocation(l, f), [loc, floor]);
  const setPos = (loc, floor, x, y) => page.evaluate(([l, f, x2, y2]) => window.__u5debug.setPosition(l, f, x2, y2), [loc, floor, x, y]);
  const locName = () => page.evaluate(() => window.__u5test.game.state.locationNames?.[window.__u5test.state().position.location - 1] ?? `loc${window.__u5test.state().position.location}`);

  // 1) Descubre el nombre vivo de cada localización con carteles (floor 0).
  const townSigns = signs.filter((s) => s.floor === 0 && s.location > 0);
  const byLoc = new Map();
  for (const s of townSigns) { if (!byLoc.has(s.location)) byLoc.set(s.location, []); byLoc.get(s.location).push(s); }
  const named = [];
  for (const [loc, arr] of byLoc) {
    try { await goTo(loc, 0); await page.waitForTimeout(120); const name = await locName(); named.push({ loc, name, signs: arr }); log({ ev: "loc-name", loc, name, count: arr.length }); }
    catch (e) { log({ ev: "loc-name-fail", loc, err: String(e) }); }
  }
  // 2) Prioriza Britain/Trinsic; completa hasta 5 con otros pueblos.
  const isTarget = (n) => /BRITAIN|TRINSIC/i.test(n);
  const ordered = [...named.filter((x) => isTarget(x.name)), ...named.filter((x) => !isTarget(x.name))];
  const chosen = [];
  for (const t of ordered) { for (const s of t.signs) { if (chosen.length >= 5) break; chosen.push({ ...s, town: t.name }); } if (chosen.length >= 5) break; }
  log({ ev: "chosen", signs: chosen.map((c) => ({ town: c.town, loc: c.location, x: c.x, y: c.y })) });

  const DIRS = [["ArrowUp", 0, 1], ["ArrowDown", 0, -1], ["ArrowLeft", 1, 0], ["ArrowRight", -1, 0]];
  for (const sign of chosen) {
    const expectedLines = sign.text.split("\n").map((l) => l.trim()).filter(Boolean);
    let done = false;
    for (const [arrow, dx, dy] of DIRS) {
      // coloca la party en el vecino OPUESTO a la dirección de mirada (mira hacia el cartel).
      await setPos(sign.location, 0, sign.x + dx, sign.y + dy);
      await page.waitForTimeout(80);
      const before = await cl();
      await page.keyboard.press("l");
      await page.waitForTimeout(60);
      await page.keyboard.press(arrow);
      await page.waitForTimeout(160);
      const after = await cl();
      const fresh = after.slice(before.length).length ? after.slice(before.length) : after.filter((l) => !before.includes(l));
      // ¿leyó el cartel? varias líneas nuevas y solapan con el cuerpo esperado.
      const overlap = fresh.filter((l) => expectedLines.some((e) => e && l.includes(e.slice(0, 6)))).length;
      const looksLikeSign = fresh.length >= 2 && overlap >= 1;
      if (looksLikeSign || arrow === "ArrowRight") {
        const leaks = fresh.map(classifyEnglish).filter(Boolean);
        const fabricated = fresh.some((l) => /a sign reads|el cartel dice|sign reads:/i.test(l));
        const r = { town: sign.town, loc: sign.location, x: sign.x, y: sign.y, dir: arrow, read: looksLikeSign, freshLines: fresh, leaks, fabricated };
        results.push(r);
        log({ ev: "sign", ...r });
        console.log(`\n[SIGN] ${sign.town} (${sign.x},${sign.y}) dir=${arrow} read=${looksLikeSign} leaks=${leaks.length} fab=${fabricated}`);
        for (const l of fresh) console.log(`   | ${l}`);
        done = true;
        break;
      }
    }
    if (!done) { results.push({ town: sign.town, x: sign.x, y: sign.y, read: false }); log({ ev: "sign-miss", town: sign.town, x: sign.x, y: sign.y }); }
  }

  log({ ev: "end", jsErrors: errors, total: results.length, read: results.filter((r) => r.read).length, leaked: results.filter((r) => (r.leaks || []).length).length });
  console.log(`\n=== RESUMEN letreros ===`);
  console.log(`carteles sondeados: ${results.length}  leídos: ${results.filter((r) => r.read).length}  con fuga inglés: ${results.filter((r) => (r.leaks || []).length).length}  fabricados: ${results.filter((r) => r.fabricated).length}`);
  console.log(`errores JS de página: ${errors.length}`);
  console.log(`log: ${LOG}`);
  await browser.close();
  process.exit(errors.length || results.some((r) => (r.leaks || []).some((x) => x.tier === "HARD") || r.fabricated) ? 2 : 0);
}
main().catch((e) => { console.error("PROBE CRASH:", e); process.exit(3); });
