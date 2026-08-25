/**
 * CENSO DEL DENOMINADOR DEL ESPEJO — las 49 partes de los dos let's-play.
 *
 *   node re/tools/censo_denominador.mjs --reports=<dir> --sha=<sha8> [--desde=<ISO>]
 *   node re/tools/censo_denominador.mjs --estatico          (sin reports: sólo lo que sale del árbol)
 *
 * POR QUÉ EXISTE: la conclusión «no hay banda patológica, hay UNA parte desamparada y una
 * magnitud que no discrimina» estaba DICHA y no ATERRIZADA — sin censo reproducible ni
 * guarda. Una cifra de censo sin sonda commiteada es irreproducible.
 * [[cifra-censo-sin-sha-es-foto]] · [[cifra-sin-sonda-commiteada]]
 *
 * ★ LAS DOS MITADES DEL CENSO, Y POR QUÉ SE SEPARAN.
 *   · ESTÁTICA  — ops, `todo`, `skip`, PASOS DE NAV, nota de corpus. Sale del `route.json`
 *     COMMITEADO: reproducible en cualquier árbol, sin correr nada, sin corpus gitignored.
 *   · DINÁMICA  — `matched` / `comparable` / `% no conducido`. Exige una corrida del espejo
 *     (49 partes × ~30 min). Se INGIERE de un dir de reports; NO se re-corre aquí.
 * Mezclarlas sin decirlo es cómo una FOTO se lee como una propiedad del árbol de hoy.
 *
 * 🔴 GUARDA DE PROCEDENCIA. Los dirs de reports viven en scratchpads COMPARTIDOS por la
 * flota. `presencia no es procedencia`: un dir con los 49 ficheros puede ser de otro carril
 * y otro sha. `--sha` es OBLIGATORIO con `--reports` y se estampa en cada línea de salida;
 * `--desde` descarta por `when` y NOMBRA lo descartado en vez de promediarlo en silencio.
 * La identidad del brazo se adjudica CAREANDO contra una tabla commiteada — ver
 * `re/notes/denominador-10-acta.md` §1 (31/31 celdas).
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOUR = join(HERE, "..", "..", "game", "e2e", "espejo-tour");

/** Ops que CONDUCEN el juego (pulsan algo). El resto es transcript sin tecla. */
const COND = new Set([
  "key", "nav", "typed", "typedMantra", "use", "dng", "dismiss",
  "recruit", "enterLoc", "exitOverworld", "wait",
]);

/**
 * `entry.note` lo GENERA `mkoverlay-*.mjs`. Esto RETIRA el molde generado y devuelve lo que
 * queda: si queda algo, un humano lo escribió.
 *
 * 🔴 LA TRAMPA QUE ESTE PREDICADO YA SE COMIÓ, y por eso está anclado al FINAL.
 * La primera versión preguntaba «¿EMPIEZA por boilerplate?» y clasificaba `ad02` como
 * generada — justo la ÚNICA nota del corpus que documenta una patología («el input-log de
 * movimiento es IRRECUPERABLE (0 pasos nav)»), porque ese aviso va APPENDEADO detrás del
 * molde, en la MISMA cadena. Un detector de prefijo declara boilerplate la nota más
 * importante que hay. [[testigo-sin-el-termino-no-es-testigo]]
 *
 * ★ Y ese accidente es a la vez EL ARGUMENTO: como el molde generado y el aviso humano
 * conviven en un solo string, «¿esta parte trae nota de corpus?» no se puede contestar sin
 * parsear prosa. Por eso el guarda del denominador NO se apoya en la nota, sino en los
 * PASOS DE NAV, que son mecánicos. Ver `tests/espejo-denominador.test.ts`.
 */
const MOLDE = [
  /^Encadena del checkpoint (de|exportado por) [^.(]*\./i,
  /^Hora can[oó]nica de arneses 10:00\.?/i,
  /^Generado offline \([^)]*\)\.?/i,
  /^\d+ segmentos \[SKIP:[^\]]*\][^.]*\./i,
  /^\d+ combates policy:auto\.?/i,
];

/** Devuelve la prosa HUMANA de la nota (cadena vacía si es sólo molde). */
export function prosaPropia(note) {
  let s = (note ?? "").trim();
  let cambio = true;
  while (cambio) {
    cambio = false;
    s = s.replace(/^[\s;,.]+/, "");
    for (const re of MOLDE) {
      const m = s.match(re);
      if (m) { s = s.slice(m[0].length); cambio = true; }
    }
  }
  return s.trim();
}

function esBoilerplate(note) {
  return prosaPropia(note) === "";
}

/** Censo ESTÁTICO de una ruta commiteada. */
export function censoEstatico(rutaJson) {
  const d = JSON.parse(readFileSync(rutaJson, "utf8"));
  let ops = 0, cond = 0, todo = 0, nav = 0, opsEnSkip = 0, segSkip = 0;
  for (const seg of d.segments ?? []) {
    const script = seg.script ?? [];
    if (seg.skip) { segSkip++; opsEnSkip += script.length; }
    for (const op of script) {
      ops++;
      if ("todo" in op || "todoKeep" in op) todo++;
      else if (Object.keys(op).some((k) => COND.has(k))) cond++;
      if (op.nav) for (const t of op.nav) nav += t.n ?? 1;
    }
  }
  return {
    part: d.part,
    source: d.source,
    segmentos: (d.segments ?? []).length,
    segSkip,
    ops, cond, todo, opsEnSkip,
    pasosNav: nav,
    notaPropia: !esBoilerplate(d.entry?.note),
  };
}

/** Ingesta de un report, con la guarda de procedencia. */
function cargarReports(dir, desde) {
  if (!existsSync(dir)) throw new Error(`no existe el dir de reports: ${dir}`);
  const out = new Map();
  const rancios = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".report.json")).sort()) {
    const rep = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const parte = basename(f).replace(".report.json", "");
    if (desde) {
      if (!rep.when) { rancios.push(`${parte}(sin 'when')`); continue; }
      if (new Date(rep.when) < desde) { rancios.push(`${parte}@${rep.when}`); continue; }
    }
    out.set(parte, rep);
  }
  if (rancios.length) {
    console.log(`⚠ ${rancios.length} report(s) FUERA DE VENTANA, EXCLUIDOS: ${rancios.join(" ")}`);
  }
  return out;
}

/** La magnitud del encargo: fracción NO conducida. Es de RUNTIME, no del route.
 *  🔴 Calcularla estáticamente sobre los `todo` da otro número (ad19: 38% en vez de 88,5%)
 *  y NO es el instrumento con el que se dijeron las cifras de este arco. */
function fraccionNoConducida(rep, ops) {
  const sk = (rep.segments ?? []).reduce(
    (a, s) => a + (s.todosSkipped ?? 0) + (s.salaOpsSkipped ?? 0), 0);
  return ops ? (100 * sk) / ops : 0;
}

function main() {
  const args = process.argv.slice(2);
  const get = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  const estatico = args.includes("--estatico");
  const dir = get("reports");
  const sha = get("sha");
  const desde = get("desde") ? new Date(get("desde")) : null;

  if (!estatico && !dir) {
    console.error("uso: --reports=<dir> --sha=<sha8> [--desde=<ISO>]   |   --estatico");
    process.exit(2);
  }
  if (dir && !sha) {
    console.error("🔴 --sha es OBLIGATORIO con --reports: una cifra dinámica sin sha es una foto sin fecha.");
    process.exit(2);
  }

  const filas = [];
  for (const sub of ["routes", "routes-ad"]) {
    const d = join(TOUR, sub);
    for (const f of readdirSync(d).filter((f) => f.endsWith(".route.json")).sort()) {
      filas.push(censoEstatico(join(d, f)));
    }
  }
  // Denominador del propio censo: si esto no es 49, el censo no cubre el corpus.
  console.log(`# CENSO DEL DENOMINADOR — ${filas.length} rutas commiteadas` +
    (sha ? ` · dinámica del árbol ${sha}` : " · sólo ESTÁTICA"));
  if (filas.length !== 49) console.log(`⚠ se esperaban 49 rutas, se censaron ${filas.length}`);

  const reps = dir ? cargarReports(dir, desde) : new Map();
  const falta = dir ? filas.filter((r) => !reps.has(r.part)).map((r) => r.part) : [];
  if (falta.length) console.log(`⚠ SIN REPORT (excluidas de las columnas dinámicas): ${falta.join(" ")}`);

  const H = ["parte", "seg", "skip", "ops", "%cond", "nav", "notaP", "matched", "compar", "%conf", "%noCond"];
  console.log(H.map((h, i) => h.padStart(i === 0 ? 8 : 8)).join(" "));
  let TM = 0, TC = 0;
  for (const r of filas) {
    const rep = reps.get(r.part);
    const m = rep?.matched ?? null, c = rep?.comparable ?? null;
    if (rep) { TM += m; TC += c; }
    console.log([
      r.part.padStart(8),
      String(r.segmentos).padStart(8),
      String(r.segSkip).padStart(8),
      String(r.ops).padStart(8),
      `${((100 * r.cond) / (r.ops || 1)).toFixed(1)}%`.padStart(8),
      String(r.pasosNav).padStart(8),
      (r.notaPropia ? "propia" : "boiler").padStart(8),
      (m === null ? "—" : String(m)).padStart(8),
      (c === null ? "—" : String(c)).padStart(8),
      (c ? `${((100 * m) / c).toFixed(1)}%` : "—").padStart(8),
      (rep ? `${fraccionNoConducida(rep, r.ops).toFixed(1)}%` : "—").padStart(8),
    ].join(" "));
  }

  console.log(`\n# ESTÁTICO: ${filas.length} rutas · ${filas.reduce((a, r) => a + r.segmentos, 0)} segmentos` +
    ` · ${filas.reduce((a, r) => a + r.segSkip, 0)} con skip` +
    ` · notas PROPIAS ${filas.filter((r) => r.notaPropia).length}/${filas.length}` +
    ` · rutas con 0 pasos de nav: ${filas.filter((r) => r.pasosNav === 0).map((r) => r.part).join(",") || "ninguna"}`);

  if (TC) {
    const mudas = new Set(filas.filter((r) => r.pasosNav === 0).map((r) => r.part));
    let sm = 0, sc = 0;
    for (const r of filas) {
      if (mudas.has(r.part)) continue;
      const rep = reps.get(r.part); if (!rep) continue;
      sm += rep.matched; sc += rep.comparable;
    }
    console.log(`# DINÁMICO (${sha}): CON todo   ${TM}/${TC} = ${((100 * TM) / TC).toFixed(2)}%`);
    console.log(`#                    SIN desamparadas (${[...mudas].join(",")}) ${sm}/${sc} = ${((100 * sm) / sc).toFixed(2)}%`);
    console.log(`# ★ Las DOS cifras se publican juntas. Excluir sin declarar convierte un artefacto de ruta en una mejora aparente.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
