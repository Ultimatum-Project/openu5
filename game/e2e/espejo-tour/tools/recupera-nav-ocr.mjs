/**
 * RECUPERA-NAV-OCR — rescata ops de MOVIMIENTO que el segmentador dio por perdidas porque
 * el OCR le rompió el VERBO.
 *
 *   node e2e/espejo-tour/tools/recupera-nav-ocr.mjs <parte> [--routes routes-ad] [--dry]
 *
 * ★ POR QUÉ EXISTE. `segment.mjs` casa el eco de input contra el vocabulario de movimiento
 * por IGUALDAD, así que un `Head Eust` o un `5outh` (OCR degradado: `u/a`, `5/S`, `l/1/i`)
 * no se reconoce y cae a `todo` — texto que el runner no pulsa. En `ad19` eso son **67 ops
 * de movimiento** en segmentos vivos que SÍ son recuperables.
 *
 * ★★ Y NO ES UNA CONJETURA: el A/B está MEDIDO, ×2 réplicas, en `re/notes/denominador-10-acta.md` §6.2.
 *   BASE 21/276 (7,6 %) · VARIANTE 26/276 (9,4 %) · **Δ +5 matched**, denominador INTACTO,
 *   anclas intactas (1✓/0✗), y los 5 bloques van TODOS de `divergent` a `matched`.
 *   Las dos réplicas dan 21/21 y 26/26 ⇒ **determinista, no es un billete de lotería.**
 *
 * 🔴 ALCANCE: se aplica A UNA PARTE, a mano y con medición. **NO** está cableado al pipeline
 * de `curate`/`segment` y NO se ha corrido sobre las otras 48: el mismo cambio metido en la
 * derivación COMPARTIDA regeneraría las 49 rutas y podría mover los 5 deltas SELLADOS. Quien
 * quiera generalizarlo mide primero, parte por parte. [[fix-localizado-pero-inerte]]
 *
 * CONSERVADOR por diseño:
 *   · sólo `todo` de ≤14 caracteres (un eco suelto, nunca una concatenación de varios);
 *   · sólo en segmentos VIVOS (en uno con `skip` el runner no ejecutaría nada: 21 de las 88
 *     coincidencias de `ad19` caen ahí y se DESCARTAN a propósito);
 *   · umbral de distancia 0,84 sobre alfabeto plegado — el mismo criterio que ya usa
 *     `derive-dungeon-ops.mjs` para el pasillo 3D;
 *   · `n: 1` siempre (un eco = un paso; el RLE no se inventa);
 *   · marca `src: "ocr-fuzzy"` y conserva el `ocrLn`, que es la procedencia REAL (apunta a
 *     la línea exacta del transcript, mejor que copiar el texto corrupto).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOUR = join(HERE, "..");

/** Confusiones OCR observadas en los corpus de los dos let's-play. */
const FOLD = { 1: "l", i: "l", "!": "l", u: "a", 5: "s", 0: "o", 9: "g", 6: "b", "|": "l" };
const fold = (s) =>
  s
    .toLowerCase()
    .split("")
    .map((c) => FOLD[c] ?? c)
    .join("");

const DIRS = ["north", "south", "east", "west"];
/** Vocabulario CERRADO de movimiento: `>North` (walk) y los verbos con modo. */
const VOCAB = [
  ...DIRS.map((d) => ({ t: d, v: "walk", m: d })),
  ...["head", "ride", "fly"].flatMap((v) => DIRS.map((d) => ({ t: `${v} ${d}`, v, m: d }))),
].map((e) => ({ ...e, f: fold(e.t) }));

/** Similitud de Dice sobre bigramas — misma familia que el comparador del arnés. */
function ratio(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bg = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const A = bg(a), B = bg(b);
  let inter = 0;
  for (const [k, n] of A) inter += Math.min(n, B.get(k) ?? 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

/**
 * Umbral de Dice. ★ HEREDADO de la casa y SIN CONTROL DE PRECISIÓN cuando se eligió — el
 * censo que lo mide es `re/tools/precision_matcher.mjs` (acta `precision-084`).
 */
const UMBRAL = 0.84;

/**
 * Devuelve {v,m} si el texto es un eco de movimiento recuperable, o null.
 *
 * `umbral` es un parámetro SÓLO para que la sonda de precisión pueda barrer la curva sin
 * duplicar el predicado — una copia del matcher divergiría y mediría otra cosa
 * ([[replica-del-test-no-es-el-test-la-fase]]). El default es el de producción: NADA cambia
 * para quien lo llama con un argumento.
 */
export function recuperaMovimiento(texto, umbral = UMBRAL) {
  const t = (texto ?? "").trim();
  if (!t || t.length > 14) return null;
  const f = fold(t);
  let best = { r: 0 };
  for (const e of VOCAB) {
    const r = ratio(f, e.f);
    if (r > best.r) best = { r, v: e.v, m: e.m };
  }
  return best.r >= umbral ? { v: best.v, m: best.m } : null;
}

function main() {
  const args = process.argv.slice(2);
  const parte = args.find((a) => !a.startsWith("--"));
  const dry = args.includes("--dry");
  const i = args.indexOf("--routes");
  const sub = i >= 0 ? args[i + 1] : "routes";
  if (!parte) {
    console.error("uso: recupera-nav-ocr.mjs <parte> [--routes routes-ad] [--dry]");
    process.exit(2);
  }

  const ruta = join(TOUR, sub, `${parte}.route.json`);
  const doc = JSON.parse(readFileSync(ruta, "utf8"));
  let conv = 0, enSkip = 0;
  const porSeg = {};

  for (const seg of doc.segments ?? []) {
    const script = seg.script ?? [];
    const out = [];
    for (const op of script) {
      const texto = op.todo ?? op.todoKeep;
      const mov = texto === undefined ? null : recuperaMovimiento(texto);
      if (mov && seg.skip) { enSkip++; out.push(op); continue; }
      if (!mov) { out.push(op); continue; }
      const nuevo = { nav: [{ m: mov.m, v: mov.v, n: 1 }], src: "ocr-fuzzy" };
      if (op.ocrLn !== undefined) nuevo.ocrLn = op.ocrLn;
      out.push(nuevo);
      conv++;
      porSeg[seg.id] = (porSeg[seg.id] ?? 0) + 1;
    }
    seg.script = out;
  }

  console.log(`${parte}: ${conv} ops de movimiento RECUPERADAS` +
    ` · ${enSkip} descartadas por vivir en segmento con \`skip\``);
  console.log(`   por segmento: ${JSON.stringify(porSeg)}`);
  if (dry) { console.log("   (--dry: no se escribe)"); return; }
  // 🔴 INDENT 2, como el resto del corpus. Escribirlo con otro sangrado REFORMATEA el
  // fichero entero: la primera versión de esta herramienta usó 1 y produjo un diff de
  // 36 060 inserciones / 35 857 borrados para cambiar 29 ops — el cambio real se vuelve
  // invisible y la revisión, imposible. El formato lo fija `curate.mjs`, no yo.
  writeFileSync(ruta, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`   escrito: ${ruta}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
