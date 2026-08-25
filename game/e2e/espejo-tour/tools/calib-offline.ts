/**
 * CALIBRACIÓN OFFLINE del comparador del ESPEJO (banco de pruebas del perfil de OCR).
 *
 * `diffSegment` es PURO: dado el `expect` de la ruta y las líneas de consola del port,
 * el veredicto no depende de nada más. Así que con un TRANSCRIPT volcado en una corrida
 * (`ESPEJO_DUMP=1` → `writeTranscript`) se puede re-medir el comparador con CUALQUIER
 * perfil sobre el MISMO material, sin volver a gastar la ventana playwright (que es el
 * recurso escaso del carril: un run cada vez).
 *
 * Es EL instrumento que hace auditable la calibración: el antes/después se mide con el
 * material congelado, así que la diferencia es atribuible al PERFIL y a nada más (un
 * re-run cambia también el replay, y entonces los dos efectos se confunden).
 *
 *   npx tsx game/e2e/espejo-tour/tools/calib-offline.ts [--dir DIR] [parts…]
 *
 * `--dir` = carpeta con los `NN.transcript.json` (default `.espejo-probe` de la raíz del
 * repo). Sin partes explícitas mide todas las que tengan transcript en esa carpeta.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRoute, diffSegment, ROUTES_AD_DIR, ROUTES_DIR } from "../runner";
import { LP1_PROFILE, AD_PROFILE, AD_PRE3C_PROFILE, profileFor, collapseWith, stripGhostPass, coverageRatio, type OcrProfile } from "../ocr-profile";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = join(HERE, "..", "..", "..", "..", ".espejo-probe");

/** Corpus de una parte por su PREFIJO (`adNN` → routes-ad, `partNN` → routes). Sin esto el banco
 *  sólo sabía leer AD y la NO-REGRESIÓN de LP1 no se podía comprobar con el mismo instrumento. */
const routesFor = (part: string): string => (part.startsWith("ad") ? ROUTES_AD_DIR : ROUTES_DIR);

interface Agg {
  comparable: number;
  matched: number;
  divergent: number;
  covered: number;
  ghost: number;
  garbage: number;
  pending: number;
  presentacion: number;
  ocrPartial: number;
  rng: number;
  overlay: number;
  knownGap: number;
  blocks: number;
  segs: number;
  portLines: number;
  // FASE 3c, por MECANISMO (el antes/después tiene que ser atribuible palanca a palanca)
  combat: number;
  rosterTail: number;
  curated: number;
  salaDeferred: number;
}
const zero = (): Agg => ({
  comparable: 0, matched: 0, divergent: 0, covered: 0, ghost: 0, garbage: 0, pending: 0,
  presentacion: 0, ocrPartial: 0, rng: 0, overlay: 0, knownGap: 0, blocks: 0, segs: 0, portLines: 0,
  combat: 0, rosterTail: 0, curated: 0, salaDeferred: 0,
});

/**
 * Mide una parte con un perfil sobre su transcript congelado. PURO respecto al port.
 *
 * `drivenOnly` descarta los segmentos con transcript VACÍO: son los que el runner NO
 * condujo (los `skip: "pendiente-runner"`, 67 de los 646 de AD, que concentran los 22 100
 * bloques atrapados del censo). Medirlos es medir INSTRUMENTO — sus bloques divergen por
 * construcción porque el port nunca habló — y hunde el denominador con material que no está
 * en juego. Fuera de este banco, el reporte de la suite ya los excluye.
 */
export function measure(part: string, profile: OcrProfile, dir: string, drivenOnly = false): Agg {
  const route = loadRoute(part, routesFor(part));
  const tr = JSON.parse(readFileSync(join(dir, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
  const a = zero();
  for (const seg of route.segments) {
    const lines = tr[seg.id];
    if (!lines) continue;
    if (drivenOnly && lines.length === 0) continue;
    a.segs++;
    a.portLines += lines.length;
    const d = diffSegment(seg, lines, profile);
    a.comparable += d.comparable;
    a.matched += d.matched;
    a.covered += d.covered;
    a.ghost += d.ocrGhost;
    a.garbage += d.ocrGarbage;
    a.presentacion += d.presentacion;
    a.ocrPartial += d.ocrPartial;
    a.combat += d.combatRng;
    a.rosterTail += d.combatRosterTail;
    a.curated += d.combatCurated;
    a.salaDeferred += d.salaDeferred;
    a.blocks += d.blocks.length;
    for (const b of d.blocks) {
      if (b.verdict === "divergent") a.divergent++;
      else if (b.verdict === "pending") a.pending++;
      else if (b.verdict === "rng") a.rng++;
      else if (b.verdict === "overlay-channel") a.overlay++;
      else if (b.verdict === "known-gap" || b.verdict === "gap-cerrado") a.knownGap++;
    }
  }
  return a;
}

const pct = (a: Agg): string => (a.comparable ? ((a.matched / a.comparable) * 100).toFixed(1) + "%" : "—");
const line = (name: string, a: Agg): string =>
  `${name.padEnd(14)} conf=${pct(a).padStart(6)}  matched=${String(a.matched).padStart(5)}/${String(a.comparable).padEnd(5)} ` +
  `div=${String(a.divergent).padStart(5)} | covered=${a.covered} ghost=${a.ghost} garbage=${a.garbage} ` +
  `pending=${a.pending} rng=${a.rng} overlay=${a.overlay} known-gap=${a.knownGap} | ` +
  `combate=${a.combat} (cola-armas=${a.rosterTail} curado=${a.curated}) sala=${a.salaDeferred} | ` +
  `bloques=${a.blocks} segs=${a.segs} port-ln=${a.portLines}`;

function main(): void {
  const argv = process.argv.slice(2);
  let dir = DEFAULT_DIR;
  let drivenOnly = false;
  const parts: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i]!;
    else if (argv[i] === "--driven-only") drivenOnly = true;
    else parts.push(argv[i]!);
  }
  const list = parts.length
    ? parts
    : readdirSync(dir).filter((f) => f.endsWith(".transcript.json")).map((f) => f.replace(".transcript.json", "")).sort();
  if (!list.length) {
    console.error(`sin transcripts en ${dir} (corre la suite con ESPEJO_DUMP=1)`);
    process.exit(2);
  }
  const profiles: Array<[string, OcrProfile]> = [
    ["lp1 (histórico)", LP1_PROFILE],
    ["ANTES (ad-3b)", AD_PRE3C_PROFILE],
    ["DESPUES (ad-3c)", AD_PROFILE],
  ];
  const extra = process.env.ESPEJO_OCR_EXTRA;
  if (extra) profiles.push([`extra (${extra})`, profileFor(extra)]);
  const totals = new Map<string, Agg>(profiles.map(([n]) => [n, zero()]));
  for (const part of list) {
    if (!existsSync(join(dir, `${part}.transcript.json`))) {
      console.error(`  (sin transcript: ${part})`);
      continue;
    }
    console.log(`\n===== ${part} =====`);
    for (const [name, prof] of profiles) {
      const a = measure(part, prof, dir, drivenOnly);
      console.log(line(name, a));
      const t = totals.get(name)!;
      for (const k of Object.keys(t) as Array<keyof Agg>) t[k] += a[k];
    }
  }
  console.log(`\n===== TOTAL (${list.length} partes) =====`);
  for (const [name] of profiles) console.log(line(name, totals.get(name)!));
  if (process.env.ESPEJO_CALIB_HIST === "1") histogram(list, dir);
}

/**
 * HISTOGRAMA DE COBERTURA de los bloques que quedan DIVERGENTES con el perfil AD: dice si el
 * umbral de `coverage` está bien puesto (¿hay un racimo justo por debajo que sería match a la
 * baja, o los divergentes están de verdad a cobertura ~0 porque el port CALLÓ?). Es la perilla
 * que separa «el comparador no reconoce» de «el port no respondió».
 */
function histogram(list: string[], dir: string): void {
  const cov = AD_PROFILE.coverage!;
  const buckets = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 1.01];
  const counts = new Array(buckets.length - 1).fill(0);
  let n = 0;
  for (const part of list) {
    const route = loadRoute(part, routesFor(part));
    const tr = JSON.parse(readFileSync(join(dir, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
    for (const seg of route.segments) {
      const lines = tr[seg.id];
      if (!lines) continue;
      const d = diffSegment(seg, lines, AD_PROFILE);
      const T = lines.map((l) => collapseWith(l.replace(/^[>›]\s*/, ""), AD_PROFILE)).join("");
      for (const b of d.blocks) {
        if (b.verdict !== "divergent") continue;
        const src = seg.expect.find((e) => e.ocrLn === b.ocrLn);
        if (!src) continue;
        const cb = collapseWith(stripGhostPass(src.text).replace(/\d+/g, ""), AD_PROFILE);
        if (cb.length < cov.minLen) continue;
        const r = coverageRatio(cb, T, cov.minTile);
        n++;
        for (let i = 0; i < counts.length; i++) if (r >= buckets[i]! && r < buckets[i + 1]!) counts[i]++;
      }
    }
  }
  console.log(`\n===== COBERTURA de los ${n} divergentes con largo ≥${cov.minLen} (umbral actual ${cov.threshold}) =====`);
  counts.forEach((c, i) =>
    console.log(`  [${buckets[i]!.toFixed(2)}–${buckets[i + 1]!.toFixed(2)}) ${String(c).padStart(5)}  ${"█".repeat(Math.round((c / Math.max(1, n)) * 60))}`),
  );
}

main();
