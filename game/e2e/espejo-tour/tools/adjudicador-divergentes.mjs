/**
 * ADJUDICADOR OFFLINE de bloques divergentes (carril espejo-auditor, hito 3).
 *
 * Toma un directorio de `*.report.json` (writeReport/ESPEJO_OUT), junta cada
 * bloque `divergent` con su ESPERADO OCR (join por ocrLn contra el route.json
 * del corpus que toque, elegido por el PREFIJO de la parte como los bancos
 * calib-*), y lo clasifica en un funnel de PRIMERA PASADA:
 *
 *   - `eco-drift`      : eco de comando/movimiento/banner (con glifos plegados
 *                        0→o, |]→l ANTES del predicado — «0pen» empieza por cero).
 *                        El port TIENE esos ecos; que diverjan ahí es deriva de
 *                        celda/estado del replay, no deuda de fidelidad.
 *   - `en-inventario`  : el esperado casa (substring normalizado, trigrama, o
 *                        bigrama ≥9 para citas cortas) contra el corpus canónico
 *                        de strings del port (`tools/i18n-corpus.mjs`, la MISMA
 *                        base anti-fabricación de i18n) ⇒ el port SABE decirlo;
 *                        no lo dijo EN ESE BEAT (deriva/estado/RNG).
 *   - `ocr-basura`     : ratio de letras <0.55 o texto útil <4 chars.
 *   - `SIN-inventario` : residuo — ÚNICO cajón donde puede vivir un flujo
 *                        AUSENTE del port. La primera pasada NO es un veredicto:
 *                        la cola se revisa a mano (en los dos corpus medidos el
 *                        21-08 resultó ser corrupción OCR de ecos: Advunoe/F]v/
 *                        Vlew u gem/Eagt/Nvrth/8outh…).
 *
 *   node tools/adjudicador-divergentes.mjs <dirReports> [--sin=N]
 *
 * Cero playwright; no muta nada. La clasificación fina (bug port / error OCR /
 * ruta imprecisa / RNG) es del auditor con este funnel + resyncs + ledger.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCorpus } from "../../../tools/i18n-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, "..");

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) { console.error("uso: node adjudicador-divergentes.mjs <dirReports> [--sin=N]"); process.exit(2); }
const sinN = Number(args.find((a) => a.startsWith("--sin="))?.split("=")[1] ?? 40);

const fold = (s) => s.replace(/0/g, "o").replace(/[|\]\[]/g, "l");
const norm = (s) => fold(s).toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const normc = (s) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const { corpus } = buildCorpus();
const cn = [...corpus].map(normc).filter((c) => c.length >= 4);
const cnset = new Set(cn);
const big = " || " + cn.filter((c) => c.length >= 9).join(" || ") + " || ";

const DRIFT = new RegExp(
  "^(>?\\s*)?(x?open|push|pull|get|board|x-?it|klimb|search|look|jimmy|talk|tolk|move|head|ride|fly|x?north|south|east|west|blocked|escape|burning|rowing|slow progress|britannia|pass|attack|on foot|dost thou wish to leave|use item|yell|cast|enter|ignite|advance|turn|back up|view a gem|hole up|z-stats|fire|player:)",
  "i",
);

function classify(t) {
  const tf = fold(t).trim();
  const tn = norm(t);
  const letters = (tf.match(/[A-Za-z]/g) ?? []).length;
  if (letters / Math.max(1, tf.length) < 0.55 || tn.length < 4) return "ocr-basura";
  if (DRIFT.test(tf)) return "eco-drift";
  if (cnset.has(tn)) return "en-inventario";
  const words = tn.split(" ");
  for (let i = 0; i + 2 < words.length + 1 && i < words.length - 2; i++) {
    const tri = words.slice(i, i + 3).join(" ");
    if (tri.length >= 12 && big.includes(tri)) return "en-inventario";
  }
  for (let i = 0; i < words.length - 1; i++) {
    const bi = words.slice(i, i + 2).join(" ");
    if (bi.length >= 9 && big.includes(bi)) return "en-inventario~bi";
  }
  return "SIN-inventario";
}

const routeCache = new Map();
function routeFor(part) {
  if (!routeCache.has(part)) {
    const d = part.startsWith("ad") ? "routes-ad" : "routes";
    routeCache.set(part, JSON.parse(readFileSync(join(BASE, d, part + ".route.json"), "utf8")));
  }
  return routeCache.get(part);
}

const counts = {};
const sin = new Map();
let total = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".report.json")).sort()) {
  const p = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const exp = new Map();
  for (const s of routeFor(p.part).segments) {
    for (const e of s.expect ?? []) exp.set(s.id + ":" + e.ocrLn, e.text ?? "");
  }
  for (const s of p.segments) {
    for (const b of s.blocks ?? []) {
      if (b.verdict !== "divergent") continue;
      total++;
      const t = exp.get(s.id + ":" + b.ocrLn) ?? "";
      const cl = classify(t);
      counts[cl] = (counts[cl] ?? 0) + 1;
      if (cl === "SIN-inventario") sin.set(t.slice(0, 70), (sin.get(t.slice(0, 70)) ?? 0) + 1);
    }
  }
}
console.log("TOTAL divergentes:", total);
console.log(counts);
console.log(`\n--- SIN-inventario únicos (top ${sinN}; REVISAR A MANO) ---`);
for (const [t, n] of [...sin.entries()].sort((a, b) => b[1] - a[1]).slice(0, sinN)) {
  console.log(String(n).padStart(3), JSON.stringify(t));
}
