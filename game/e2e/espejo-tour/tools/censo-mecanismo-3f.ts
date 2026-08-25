/**
 * FASE 3f — CENSO POR MECANISMO de los divergentes del LP1 tardío.
 *
 * El censo por racimos (`censo-3f.ts`) dice QUÉ texto diverge; éste dice POR QUÉ, repartiendo
 * cada divergente en cubos con una atribución declarada. La distinción que importa para 3f es
 * entre lo que es INSTRUMENTO (retirable del denominador con derivación) y lo que es HUECO DEL
 * PORT (que retirar sería AUTO-ABSOLUCIÓN — el riesgo que el doc de diseño marca como serio).
 *
 * Además mide el ECO DE MOVIMIENTO del LP contra los pasos de `nav` que la ruta llegó a
 * derivar: si el LP dio N pasos y la ruta sólo tiene M≪N, el port no puede estar donde estaba
 * el LP y el problema NO es el denominador.
 *
 *   npx tsx game/e2e/espejo-tour/tools/censo-mecanismo-3f.ts [--dir .espejo-lp1] [parts…]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadRoute, diffSegment, ROUTES_DIR } from "../runner";
import { LP1_PROFILE } from "../ocr-profile";

/**
 * Plegado AGRESIVO de la firma OCR del LP1 tardío — **para CLASIFICAR, jamás para casar**
 * (misma doctrina y mismo aviso que `probeFold` del perfil AD). Las confusiones se leen del
 * propio censo: `Wcgt`/`Wegt`/`Wcct`/`Wcst`→west, `Eagt`/`Eact`/`Eugt`→east, `8outh`/`gouth`/
 * `gvuth`→south, `Nvrth`→north, `F]v`/`F]y`→fly, `Hcad`→head, `Pagg`/`Pacc`/`Pugg`→pass.
 */
export function lateFold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[1l|\][]/g, "i")
    .replace(/[0c6]/g, "o")
    .replace(/[vy]/g, "u")
    .replace(/[g8]/g, "s")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/** Rumbo plegado (north/south/east/west) tolerando la firma del corpus tardío. */
const DIRS = ["north", "south", "east", "west"];
const dirLike = (w: string): string | null => {
  const f = w.replace(/u/g, "o"); // nurth→north, suuth→south
  for (const d of DIRS) {
    const df = d.replace(/[uv]/g, "o").replace(/[g8]/g, "s");
    if (f === df) return d;
    if (f.length === df.length && [...f].filter((c, i) => c !== df[i]).length === 1) return d;
  }
  return null;
};
/** Verbo de transporte del binario (MAINOUT transport_face 0x00DA): Ride/Fly/Row/Head. */
const VERBS: Record<string, string> = { ride: "ride", riae: "ride", fiy: "fly", fly: "fly", row: "row", head: "head", heod: "head", hood: "head" };
const verbLike = (w: string): string | null => {
  if (VERBS[w]) return VERBS[w]!;
  for (const [k, v] of Object.entries(VERBS))
    if (k.length === w.length && [...w].filter((c, i) => c !== k[i]).length === 1) return v;
  return null;
};

export interface MoveShape {
  verb: string | null; // null = a pie
  dir: string;
}
/** ¿Es el bloque UN eco de movimiento (con o sin verbo de transporte) y nada más? */
export function moveShape(text: string): MoveShape | null {
  const words = lateFold(text).split(" ").filter(Boolean);
  if (words.length === 1) {
    const d = dirLike(words[0]!);
    return d ? { verb: null, dir: d } : null;
  }
  if (words.length === 2) {
    const v = verbLike(words[0]!);
    const d = dirLike(words[1]!);
    return v && d ? { verb: v, dir: d } : null;
  }
  return null;
}

/** «Pass» (kernel 0x31F4 / DS 0x84ec) — el port SÍ lo emite (`game.ts:1852`). */
const passLike = (text: string): boolean => {
  const w = lateFold(text).replace(/\s+/g, "");
  return w.length >= 3 && w.length <= 5 && w.startsWith("pas");
};

/** Firma de COMBATE sobre el plegado tardío (la misma semántica que `RNG_AUTO` de LP1). */
const COMBAT_LATE: RegExp[] = [
  /[,.:;]\s*armed\b/, /attaok[-\s]*aim/, /attuok[-\s]*aim/, /set\s+aotiue\s+pir/,
  /\b(?:hit|missed|miss|wounded|srazed|kiiied|oritioai)\b!?/, /uiotoru|battie\s+is\s+iost/,
];

interface Bucket { n: number; ex: string[] }
const bump = (m: Map<string, Bucket>, k: string, ex: string): void => {
  const b = m.get(k) ?? { n: 0, ex: [] };
  b.n++;
  if (b.ex.length < 3) b.ex.push(ex.slice(0, 60));
  m.set(k, b);
};

function main(): void {
  const argv = process.argv.slice(2);
  let dir = ".espejo-lp1";
  const parts: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i]!;
    else parts.push(argv[i]!);
  }
  const list = parts.length
    ? parts
    : readdirSync(dir).filter((f) => f.endsWith(".transcript.json")).map((f) => f.replace(".transcript.json", "")).sort();

  const buckets = new Map<string, Bucket>();
  const byVerb = new Map<string, number>();
  let total = 0;
  let navSteps = 0;
  let moveBeatsAll = 0; // ecos de movimiento en TODO el expect (no sólo divergentes)
  for (const part of list) {
    if (!existsSync(join(dir, `${part}.transcript.json`))) continue;
    const route = loadRoute(part, ROUTES_DIR);
    const tr = JSON.parse(readFileSync(join(dir, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
    for (const seg of route.segments) {
      if (seg.skip != null) continue;
      const lines = tr[seg.id];
      if (!lines) continue;
      navSteps += seg.script.reduce((a, o) => a + (o.nav ? o.nav.reduce((b, r) => b + r.n, 0) : 0), 0);
      for (const e of seg.expect) if (moveShape(e.text)) moveBeatsAll++;
      const d = diffSegment(seg, lines, LP1_PROFILE);
      for (const b of d.blocks) {
        if (b.verdict !== "divergent") continue;
        const src = seg.expect.find((x) => x.ocrLn === b.ocrLn);
        if (!src) continue;
        total++;
        const t = src.text;
        const mv = moveShape(t);
        if (mv) {
          bump(buckets, mv.verb ? `MOV con verbo (${mv.verb})` : "MOV a pie (sin verbo)", t);
          byVerb.set(mv.verb ?? "(a pie)", (byVerb.get(mv.verb ?? "(a pie)") ?? 0) + 1);
        } else if (passLike(t)) bump(buckets, "PASS (el port lo emite)", t);
        else if (COMBAT_LATE.some((re) => re.test(lateFold(t)))) bump(buckets, "COMBATE (firma RNG)", t);
        else if (/quit|sa[vu]e game|hoie up|hoid up|hours|set watoh|uiew a sem|no sems/.test(lateFold(t)))
          bump(buckets, "FLUJO NO CONDUCIDO (quit/camp/gema)", t);
        else if (/[^\s"]"[^\s"]/.test(t)) bump(buckets, "SEGUNDA PASADA del OCR (fantasma)", t);
        else bump(buckets, "resto", t);
      }
    }
  }
  console.log(`DIVERGENTES ${total} · partes ${list.length}\n`);
  for (const [k, b] of [...buckets.entries()].sort((a, c) => c[1].n - a[1].n)) {
    console.log(`${String(b.n).padStart(6)}  ${((b.n / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
    for (const e of b.ex) console.log(`                     │ ${JSON.stringify(e)}`);
  }
  console.log(`\nVERBO de transporte en los ecos de movimiento divergentes:`);
  for (const [v, n] of [...byVerb.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(6)}  ${v}`);
  console.log(`\nECOS DE MOVIMIENTO en TODO el expect: ${moveBeatsAll}`);
  console.log(`PASOS DE NAV derivados a la ruta:     ${navSteps}`);
  console.log(`   ⇒ el arnés conduce ${((navSteps / Math.max(1, moveBeatsAll)) * 100).toFixed(1)}% del movimiento que el LP jugó`);
}

// Sólo corre como PROGRAMA. Sin esta guarda, importar `moveShape`/`lateFold` desde otro script
// dispara el censo entero del módulo importado y su salida se mezcla con la del que importa
// (pasó, y hacía leer números de 18 partes creyéndolos de 10).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) main();
