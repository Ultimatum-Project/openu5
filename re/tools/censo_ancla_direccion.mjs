#!/usr/bin/env node
/**
 * CENSO DE ANCLAS DE NPC CUYA **DIRECCIÓN ESTÁ EN EL GUION** — ficha **F-A3**.
 *
 * ★ EL MECANISMO. `resyncToNpcAnchor` planta la party en UNA celda adyacente al NPC y **deriva
 * la dirección del (T)alk de esa colocación**. Pero el guion del corpus **YA TRAE la dirección
 * que usó el LP**: el `{"key":"t", anchor:{…}}` va seguido de un `{"key":"ArrowXxx"}` con el
 * mismo `ocrLn`, que es la tecla que el humano pulsó. El arnés **descarta ese dato** y elige la
 * celda por su cuenta, así que puede plantar la party en un lado distinto del que estuvo el LP.
 *
 * Caso que abre la ficha (`ad10-g21`, Minoc): el guion trae `t` + **`ArrowDown`** (sur) — y el
 * LP dice literalmente `>Talk-South` en la línea 3660 del OCR. El arnés plantó la party al
 * OESTE y habló al ESTE. La tienda se abre igual (el (T)alk alcanza al NPC), pero **la party
 * queda en una celda distinta de la del LP**, y las ~30 órdenes de movimiento que el LP encadena
 * después (`>Fly South`, `>Open-East`…) se ejecutan desde otro punto ⇒ divergen.
 *
 * ESTE CENSO NO ADJUDICA: cuenta la POBLACIÓN. Dos preguntas, dos vistas:
 *   (1) OFFLINE, sobre el corpus: ¿cuántas anclas de NPC traen dirección en el guion?
 *   (2) EN CORRIDA, sobre reports: ¿en cuántas la dirección EJECUTADA (`NPC-TALK … t+<dir>`)
 *       difiere de la del guion? Ésa es la población REALMENTE afectada.
 *
 *   node re/tools/censo_ancla_direccion.mjs [--reports <dir>[,<dir>…]] [--desde <ISO>]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** La tecla del guion → el nombre de dirección que usa el log del runner (`t+south`…). */
const TECLA_A_DIR = {
  ArrowUp: "north",
  ArrowDown: "south",
  ArrowLeft: "west",
  ArrowRight: "east",
};

function rutas() {
  const out = [];
  for (const [corpus, dir] of [["AD", "routes-ad"], ["LP1", "routes"]]) {
    const d = join(REPO, "game/e2e/espejo-tour", dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((f) => f.endsWith(".route.json")).sort()) {
      out.push({ corpus, parte: f.replace(".route.json", ""), json: JSON.parse(readFileSync(join(d, f), "utf8")) });
    }
  }
  return out;
}

/** POBLACIÓN OFFLINE: anclas de NPC, y cuáles traen dirección en el guion. */
export function censoOffline() {
  const filas = [];
  for (const { corpus, parte, json } of rutas()) {
    for (const seg of json.segments ?? json.groups ?? []) {
      const script = seg.script ?? [];
      for (let i = 0; i < script.length; i++) {
        const op = script[i];
        if (op?.anchor?.kind !== "npc") continue;
        // la dirección del LP es la tecla de flecha INMEDIATAMENTE posterior con el mismo ocrLn
        const sig = script[i + 1];
        const dir = sig && TECLA_A_DIR[sig.key] && (sig.ocrLn === op.ocrLn || sig.ocrLn == null)
          ? TECLA_A_DIR[sig.key] : null;
        filas.push({ corpus, parte, seg: seg.id, match: op.anchor.match, ocrLn: op.ocrLn, dirGuion: dir, skip: !!seg.skip });
      }
    }
  }
  return filas;
}

/** EN CORRIDA: la dirección que el runner EJECUTÓ, leída de `NPC-TALK '<match>' t+<dir>`. */
function dirsEjecutadas(dirReports, desde) {
  const out = new Map(); // "parte#seg#match" → dir
  for (const d of dirReports) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((f) => f.endsWith(".report.json"))) {
      const rep = JSON.parse(readFileSync(join(d, f), "utf8"));
      if (desde && (!rep.when || new Date(rep.when) < desde)) continue; // guarda de procedencia
      for (const s of rep.segments ?? []) {
        for (const r of s.resyncs ?? []) {
          const m = r.match(/^NPC-TALK '([^']+)' t\+(\w+)/);
          if (m) out.set(`${rep.part}#${s.id}#${m[1]}`, m[2]);
        }
      }
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const reportsArg = args[args.indexOf("--reports") + 1];
  const dirs = args.includes("--reports") ? reportsArg.split(",").filter(Boolean) : [];
  const desdeArg = args.includes("--desde") ? args[args.indexOf("--desde") + 1] : null;
  const desde = desdeArg ? new Date(desdeArg) : null;

  const filas = censoOffline();
  const conDir = filas.filter((f) => f.dirGuion);
  const vivas = filas.filter((f) => !f.skip);
  const conDirVivas = conDir.filter((f) => !f.skip);

  console.log(`═══ (1) POBLACIÓN OFFLINE — anclas de NPC en el corpus ═══`);
  for (const c of ["AD", "LP1"]) {
    const t = filas.filter((f) => f.corpus === c);
    const d = t.filter((f) => f.dirGuion);
    const dv = d.filter((f) => !f.skip);
    console.log(`  ${c.padEnd(4)} anclas=${String(t.length).padStart(4)}  con dirección en el guion=${String(d.length).padStart(4)}  (vivas, sin skip: ${dv.length})`);
  }
  console.log(`  TOTAL anclas=${filas.length} · con dirección=${conDir.length} · vivas con dirección=${conDirVivas.length}`);

  if (!dirs.length) {
    console.log(`\n(sin --reports no se puede medir la vista EN CORRIDA)`);
    return;
  }

  const ejec = dirsEjecutadas(dirs, desde);
  console.log(`\n═══ (2) EN CORRIDA — dirección EJECUTADA vs dirección DEL GUION ═══`);
  console.log(`  (${ejec.size} anclas con NPC-TALK ejecutado en los reports leídos)`);
  let casan = 0, diverge = 0, sinDato = 0;
  const lista = [];
  for (const f of conDir) {
    const dirEj = ejec.get(`${f.parte}#${f.seg}#${f.match}`);
    if (!dirEj) { sinDato++; continue; }
    if (dirEj === f.dirGuion) casan++;
    else { diverge++; lista.push({ ...f, dirEj }); }
  }
  console.log(`  coinciden con el guion : ${casan}`);
  console.log(`  🔴 DIFIEREN            : ${diverge}`);
  console.log(`  sin (T)alk ejecutado   : ${sinDato}  (segmento con skip, ancla no alcanzada o parte no corrida)`);
  if (lista.length) {
    console.log(`\n  las que DIFIEREN — la party se planta en otro lado del que estuvo el LP:`);
    console.log(`    parte    segmento      ancla                    guion → ejecutado`);
    for (const f of lista.sort((a, b) => a.parte.localeCompare(b.parte))) {
      console.log(`    ${f.parte.padEnd(8)} ${f.seg.padEnd(13)} ${String(f.match).padEnd(24)} ${f.dirGuion} → ${f.dirEj}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
