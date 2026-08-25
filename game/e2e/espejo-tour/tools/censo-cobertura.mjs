/**
 * CENSO DE COBERTURA del corpus espejo (carril espejo-auditor, hito 1).
 *
 * Deriva, POR EPISODIO y de los propios route.json + overlays (sin corpus OCR,
 * que no vive en esta máquina), el estado de transcripción/curación:
 *
 *   - span OCR cubierto por los segmentos (unión de intervalos [from,to]) y los
 *     HUECOS internos (líneas del ocrlog entre minFrom y maxTo que ningún
 *     segmento reclama). LIMITACIÓN DECLARADA: sin el ocrlog no se conoce el
 *     total de líneas del episodio — la cola tras maxTo es invisible aquí; lo
 *     que se reporta es cobertura DEL SPAN SEGMENTADO, no del vídeo.
 *   - conducción: ops totales, `todo` (no conducibles) vs conducidas, % conducido.
 *   - expect: bloques por clase (auto/exact/pending).
 *   - segmentos skip + histograma de skipReason (qué material está CERRADO y por qué).
 *   - interiores abiertos por fase (`openedBy`).
 *   - anclas (`op.anchor`), ops de mazmorra (`dng`), ops de arnés (seedX, recruit, dismiss).
 *   - curación: la riqueza del overlay (notas, anchors, insertOps, asserts de
 *     ledger). OJO: el campo `generated` dice «BORRADOR, curar a mano» en LOS 49
 *     routes (boilerplate de segment.mjs) — NO discrimina curado de crudo; el
 *     discriminante real es %conducidas + overlay (medido en el estreno del censo).
 *     El campo `borrador` se conserva en el --json por si el boilerplate cambia.
 *
 *   node tools/censo-cobertura.mjs [--json] [--dir routes|routes-ad|ambos]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, "..");

const DRIVEN_OPS = new Set([
  "nav", "key", "typed", "typedMantra", "dng", "use", "wait", "ynFrom",
  "recruit", "dismiss", "seedGold", "seedInt", "seedEquip", "seedStr",
  "enterLoc", "exitOverworld", "gap",
]);
const HARNESS_OPS = new Set([
  "recruit", "dismiss", "seedGold", "seedInt", "seedEquip", "seedStr", "enterLoc", "exitOverworld",
]);

function unionLen(intervals) {
  const iv = intervals.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b >= a)
    .sort((x, y) => x[0] - y[0]);
  let len = 0, curA = null, curB = null;
  for (const [a, b] of iv) {
    if (curA === null) { curA = a; curB = b; continue; }
    if (a <= curB + 1) { curB = Math.max(curB, b); }
    else { len += curB - curA + 1; curA = a; curB = b; }
  }
  if (curA !== null) len += curB - curA + 1;
  return len;
}

function censarParte(dir, file) {
  const r = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const overlayPath = join(dir, "overlays", r.part + ".json");
  let overlay = null;
  try { overlay = JSON.parse(readFileSync(overlayPath, "utf8")); } catch { /* sin overlay */ }

  const c = {
    part: r.part,
    source: r.source ?? null,
    borrador: /BORRADOR/i.test(r.generated ?? ""),
    entry: r.entry?.boot ? "boot" : (r.entry?.checkpoint ?? null),
    segs: r.segments.length,
    segsSkip: 0,
    skipReasons: {},
    interioresPorFase: {},
    ocrMin: Infinity, ocrMax: -Infinity, ocrCubierto: 0,
    expect: { total: 0, auto: 0, exact: 0, pending: 0, otras: 0 },
    ops: { total: 0, todo: 0, todoKeep: 0, conducidas: 0, arnes: 0, dng: 0, anchor: 0 },
    overlay: overlay ? {
      segsConNota: 0, segsConAnchor: 0, insertOps: 0,
      ledgerAssert: Object.keys(overlay.ledger?.assert ?? {}).length,
    } : null,
    ledgerAssert: Object.keys(r.ledger?.assert ?? {}).length,
  };

  const intervals = [];
  for (const s of r.segments) {
    if (s.skip) {
      c.segsSkip++;
      const reason = (s.skipReason ?? "(sin razón)").replace(/^\[SKIP:([^\]]+)\].*$/s, "$1").slice(0, 40);
      c.skipReasons[reason] = (c.skipReasons[reason] ?? 0) + 1;
    }
    if (s.openedBy) c.interioresPorFase[s.openedBy] = (c.interioresPorFase[s.openedBy] ?? 0) + 1;
    if (s.ocr && Number.isFinite(s.ocr.from) && Number.isFinite(s.ocr.to)) {
      intervals.push([s.ocr.from, s.ocr.to]);
      c.ocrMin = Math.min(c.ocrMin, s.ocr.from);
      c.ocrMax = Math.max(c.ocrMax, s.ocr.to);
    }
    for (const e of s.expect ?? []) {
      c.expect.total++;
      const cls = e.class ?? "(sin)";
      if (cls === "auto") c.expect.auto++;
      else if (cls === "exact") c.expect.exact++;
      else if (cls === "pending") c.expect.pending++;
      else c.expect.otras++;
    }
    for (const op of s.script ?? []) {
      c.ops.total++;
      if ("todo" in op) c.ops.todo++;
      if ("todoKeep" in op) c.ops.todoKeep++;
      if ("anchor" in op && op.anchor) c.ops.anchor++;
      if ("dng" in op) c.ops.dng++;
      if (Object.keys(op).some((k) => DRIVEN_OPS.has(k))) c.ops.conducidas++;
      if (Object.keys(op).some((k) => HARNESS_OPS.has(k))) c.ops.arnes++;
    }
  }
  c.ocrCubierto = unionLen(intervals);
  if (!Number.isFinite(c.ocrMin)) { c.ocrMin = null; c.ocrMax = null; }

  if (overlay) {
    for (const s of Object.values(overlay.segments ?? {})) {
      if (s.note) c.overlay.segsConNota++;
      if (s.anchor) c.overlay.segsConAnchor++;
      if (Array.isArray(s.insertOps)) c.overlay.insertOps += s.insertOps.length;
    }
  }
  return c;
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const dirArg = args.find((a) => a.startsWith("--dir"))?.split("=")[1] ?? "ambos";
const dirs = dirArg === "ambos" ? ["routes", "routes-ad"] : [dirArg];

const censo = [];
for (const d of dirs) {
  const full = join(BASE, d);
  for (const f of readdirSync(full).filter((x) => x.endsWith(".route.json")).sort()) {
    censo.push({ corpus: d, ...censarParte(full, f) });
  }
}

if (asJson) {
  console.log(JSON.stringify(censo, null, 2));
} else {
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "—");
  console.log(
    "| parte | segs | skip | span OCR | huecos-span | ops | todo | conducidas | %cond | expect | exact | anclas | dng | arnés | ledger.assert |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const tot = { segs: 0, skip: 0, span: 0, cub: 0, ops: 0, todo: 0, cond: 0, exp: 0, exact: 0, anc: 0, dng: 0, arn: 0 };
  for (const c of censo) {
    const span = c.ocrMax != null ? c.ocrMax - c.ocrMin + 1 : 0;
    const huecos = span - c.ocrCubierto;
    tot.segs += c.segs; tot.skip += c.segsSkip; tot.span += span; tot.cub += c.ocrCubierto;
    tot.ops += c.ops.total; tot.todo += c.ops.todo; tot.cond += c.ops.conducidas;
    tot.exp += c.expect.total; tot.exact += c.expect.exact; tot.anc += c.ops.anchor;
    tot.dng += c.ops.dng; tot.arn += c.ops.arnes;
    console.log(
      `| ${c.part} | ${c.segs} | ${c.segsSkip} | ${c.ocrMin ?? "—"}–${c.ocrMax ?? "—"} (${span}) | ${huecos} (${pct(huecos, span)}) | ${c.ops.total} | ${c.ops.todo} | ${c.ops.conducidas} | ${pct(c.ops.conducidas, c.ops.total)} | ${c.expect.total} | ${c.expect.exact} | ${c.ops.anchor} | ${c.ops.dng} | ${c.ops.arnes} | ${c.ledgerAssert} |`);
  }
  console.log(
    `| **TOTAL** | ${tot.segs} | ${tot.skip} | — (${tot.span}) | ${tot.span - tot.cub} (${pct(tot.span - tot.cub, tot.span)}) | ${tot.ops} | ${tot.todo} | ${tot.cond} | ${pct(tot.cond, tot.ops)} | ${tot.exp} | ${tot.exact} | ${tot.anc} | ${tot.dng} | ${tot.arn} | — |`);

  // histogramas agregados
  const skipAgg = {}, faseAgg = {};
  for (const c of censo) {
    for (const [k, v] of Object.entries(c.skipReasons)) skipAgg[k] = (skipAgg[k] ?? 0) + v;
    for (const [k, v] of Object.entries(c.interioresPorFase)) faseAgg[k] = (faseAgg[k] ?? 0) + v;
  }
  console.log("\nskipReasons:", JSON.stringify(skipAgg));
  console.log("interiores openedBy:", JSON.stringify(faseAgg));
}
