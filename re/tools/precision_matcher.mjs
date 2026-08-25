/**
 * PRECISIÓN Y RECALL DEL MATCHER DE MOVIMIENTO — la curva del umbral.
 *
 *   node re/tools/precision_matcher.mjs [--umbral=0.84] [--curva]
 *
 * POR QUÉ EXISTE: `recupera-nav-ocr.mjs` casa ecos de movimiento degradados por OCR con
 * **Dice ≥ 0,84**, umbral HEREDADO y del que **nadie había medido la precisión**. Una
 * conversión falsa **inserta un movimiento que el LP no hizo** — peor que no moverse. Con ese
 * umbral se convirtieron 29 ops de `ad19` que ya están en main.
 * Pre-registro: `re/notes/precision-084-preregistro.md`.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA VERDAD DE REFERENCIA NO SALE DE MÍ — y ésa es la condición que hace válido el experimento
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * Si la etiqueta la pusiera mi criterio de «esto se parece a un North», el experimento mediría
 * mi punto ciego dos veces y saldría verde. Sale del corpus **RE-CALIBRADO**
 * (`full-part-logs-recal/`), que es una SEGUNDA pasada de OCR sobre el mismo vídeo, producida
 * por otro proceso. Reglas mecánicas, sin juicio:
 *
 *   · POSITIVO — la línea casa EXACTAMENTE `>North|>Head East|…`. La verdad es lo que pone
 *     literalmente, y el `>` es el marcador de eco de input DEL JUEGO, no una marca mía.
 *   · NEGATIVO — la línea NO empieza por `>` ⇒ es salida del juego. En texto limpio,
 *     inequívoco. **Cualquier conversión aquí es un FALSO POSITIVO sin discusión.**
 *
 * ★ El matcher se IMPORTA de `recupera-nav-ocr.mjs` — no se reimplementa. Una copia del
 * predicado divergiría y mediríamos otra cosa. [[replica-del-test-no-es-el-test-la-fase]]
 *
 * 🔴 LÍMITE DECLARADO (pre-registro §5): los FP se miden sobre texto **LIMPIO**, no degradado.
 * En un log degradado el propio `>` está corrompido, así que la etiqueta volvería a depender de
 * mi criterio; y los dos corpus están pareados por VÍDEO, no línea a línea. ⇒ **la cifra de FP
 * es una COTA INFERIOR del riesgo real**, y así hay que leerla.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { recuperaMovimiento } from "../../game/e2e/espejo-tour/tools/recupera-nav-ocr.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RECAL = join(HERE, "..", "..", "original", "av-referencia", "yt", "clips", "full-part-logs-recal");

const DIRS = ["North", "South", "East", "West"];
/** POSITIVO: eco de movimiento LIMPIO. La verdad = el literal. */
const POS = new RegExp(`^>(?:(${DIRS.join("|")})|(Head|Ride|Fly) (${DIRS.join("|")}))$`);

/** Carga las dos poblaciones del corpus re-calibrado. */
export function poblaciones() {
  if (!existsSync(RECAL)) throw new Error(`no existe el corpus recal: ${RECAL}`);
  const positivos = [];   // {texto, v, m}
  const negativos = [];   // texto
  const ficheros = readdirSync(RECAL).filter((f) => f.endsWith(".ocrlog.txt")).sort();
  for (const f of ficheros) {
    for (const raw of readFileSync(join(RECAL, f), "utf8").split("\n")) {
      const l = raw.replace(/\r$/, "");
      const m = POS.exec(l);
      if (m) {
        positivos.push({ texto: l.slice(1), v: (m[2] ?? "walk").toLowerCase(), m: (m[1] ?? m[3]).toLowerCase() });
      } else if (l.trim() && !l.startsWith(">")) {
        negativos.push(l);
      }
    }
  }
  return { positivos, negativos, ficheros: ficheros.length };
}

/** Evalúa el matcher a un umbral dado. `recuperaMovimiento` usa 0,84 fijo, así que para
 *  barrer la curva se le pasa el umbral por parámetro (ver `--umbral` de la herramienta). */
export function evalua(pos, neg, umbral) {
  let convertidos = 0, aciertoDir = 0, aciertoModo = 0, aciertoAmbos = 0;
  for (const p of pos) {
    const r = recuperaMovimiento(p.texto, umbral);
    if (!r) continue;
    convertidos++;
    const okD = r.m === p.m, okV = r.v === p.v;
    if (okD) aciertoDir++;
    if (okV) aciertoModo++;
    if (okD && okV) aciertoAmbos++;
  }
  let fp = 0;
  const ejemplos = [];
  for (const t of neg) {
    const r = recuperaMovimiento(t, umbral);
    if (r) { fp++; if (ejemplos.length < 8) ejemplos.push(`${JSON.stringify(t)} → ${r.v} ${r.m}`); }
  }
  return {
    umbral,
    recall: convertidos / pos.length,
    aciertoAmbos: convertidos ? aciertoAmbos / convertidos : 0,
    aciertoDir: convertidos ? aciertoDir / convertidos : 0,
    convertidos, fp, tasaFP: fp / neg.length, ejemplos,
  };
}

function main() {
  const args = process.argv.slice(2);
  const curva = args.includes("--curva");
  const u = Number(args.find((a) => a.startsWith("--umbral="))?.split("=")[1] ?? 0.84);

  const { positivos, negativos, ficheros } = poblaciones();
  console.log(`# corpus RE-CALIBRADO: ${ficheros} ficheros`);
  console.log(`# POSITIVOS (comando limpio, verdad = el literal): ${positivos.length}`);
  console.log(`# NEGATIVOS (no empieza por '>', = salida del juego): ${negativos.length}`);
  if (!positivos.length || !negativos.length) { console.log("⚠ población vacía: el censo no mide nada"); process.exit(2); }

  const umbrales = curva
    ? [0.70, 0.74, 0.78, 0.80, 0.82, 0.84, 0.86, 0.88, 0.90, 0.92, 0.95]
    : [u];
  console.log(`\n${"umbral".padStart(7)} ${"recall".padStart(8)} ${"dir+modo OK".padStart(12)} ${"FP".padStart(7)} ${"tasa FP".padStart(9)}`);
  const filas = umbrales.map((t) => evalua(positivos, negativos, t));
  for (const r of filas) {
    console.log(
      `${r.umbral.toFixed(2).padStart(7)} ${(100 * r.recall).toFixed(1).padStart(7)}% ` +
      `${(100 * r.aciertoAmbos).toFixed(1).padStart(11)}% ${String(r.fp).padStart(7)} ${(100 * r.tasaFP).toFixed(3).padStart(8)}%`,
    );
  }
  const base = filas.find((r) => Math.abs(r.umbral - 0.84) < 1e-9);
  if (base?.ejemplos.length) {
    console.log(`\n# FALSOS POSITIVOS a 0,84 — muestra (líneas que NO son comandos y aun así convierte):`);
    for (const e of base.ejemplos) console.log(`   ${e}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
