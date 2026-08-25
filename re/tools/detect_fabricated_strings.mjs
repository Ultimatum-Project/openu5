/**
 * #147 — CENSO DE FABRICACIÓN: mensajes user-facing del port que NO EXISTEN en
 * ninguna fuente del juego.
 *
 * MOTIVO (carril enjoy-146): `"Here thou art!"` se usa como mensaje de éxito en TRES
 * tiendas (`shops.ts` buyReagent/buyGuildItem/buyWine) y NO aparece en DATA.OVL, ni en
 * ningún fichero de `original/u5/`, ni en `game/assets/`. Lo único parecido es
 * `"Here thou art... "` — otra cadena, de otro flujo (TLK). Además está catalogada y
 * TRADUCIDA en `es.json`, así que el corpus la blanquea como si fuera del juego.
 *
 * NUMERADOR: el extractor PROPIO del proyecto (`game/tools/extract-user-strings.mjs`),
 *   el mismo que alimentan la guarda y el manifiesto. Hereda sus límites declarados
 *   (sin indirección cross-módulo, sin construcción dinámica) y el punto ciego de #132
 *   (`t("…")`), que aquí juegan A FAVOR: menos numerador = menos falsos positivos.
 *
 * DENOMINADOR (una cadena EXISTE si aparece en cualquiera de):
 *   (a) los binarios y datos originales: TODA tira imprimible de TODO fichero de
 *       `original/u5/ultima5/` (DATA.OVL, los .OVL, ULTIMA.EXE, .DAT, .TLK…).
 *   (b) los assets extraídos: TODO string de `game/assets/**\/*.json` (TLK decodificado,
 *       shoppe, look2, signs, endgame, story…).
 * Los .TLK van comprimidos por sustitución de palabras, así que (a) NO los cubre de
 * verdad: por eso (b) es imprescindible y no un lujo.
 *
 * NORMALIZACIÓN: se compara sobre texto plegado (minúsculas, espacios/saltos
 * colapsados, `{}` de plantilla fuera) y por SUBCADENA — deliberadamente GENEROSA:
 * cualquier duda cuenta como EXISTE. El censo prefiere el falso negativo al falso
 * positivo; lo que salga está acotado por abajo.
 *
 * CONTROL POSITIVO: `Here thou art!` DEBE salir en la lista. Si no sale, el barrido
 * está roto y no se debe leer su resultado (lo verifica el propio script y sale != 0).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractUserStrings, shellFiles, isTechnical } from "../../game/tools/extract-user-strings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const ORIG = join(ROOT, "original", "u5", "ultima5");
const ASSETS = join(ROOT, "game", "assets");
const CORE = join(ROOT, "game", "src", "core");
const SRC = join(ROOT, "game", "src");

/** Control positivo: sin esto en la salida, el instrumento no vale. */
/**
 * CONTROLES — el pre-registrado falló y se RE-DERIVA en vez de ablandar el criterio.
 * «Here thou art!» no existe BYTE A BYTE en ninguna fuente (política ESTRICTA: sí sale),
 * pero su FRASE sí existe: el TLK trae «Here thou art... ». Bajo la política LAXA
 * (puntuación = separador) queda absorbida, y eso es CORRECTO — de ahí que el control
 * tenga que ser distinto en cada política. Un control que pasa en las dos sería un
 * control que no discrimina.
 */
const CONTROL_ESTRICTO = "Here thou art!";   // debe SALIR con puntuación significativa
const CONTROL_LAXO = "Here thou art!";       // debe QUEDAR ABSORBIDO al ignorar puntuación

/**
 * Pliega para comparar: minusculas, sin plantillas, sin COMILLAS y con la puntuacion
 * tratada como separador. Quitar comillas y puntuacion es DELIBERADO: #147 pregunta si
 * la FRASE existe en el juego, no como la puntua el port (de eso va #142). Sin esto un
 * `"` pegado a la primera palabra (`"pride`) rompe la comparacion entera Y la de
 * prefijos, y frases que SI estan en el juego («Pride is a vice...», verificada a mano
 * contra los binarios) caian en la clase de fabricacion: fue el 1er falso positivo medido.
 */
function fold(s, laxa) {
  const sinComillas = s.replace(/\{\}/g, " ").replace(/["'`$]/g, " ").toLowerCase();
  return (laxa
    ? sinComillas.replace(/[\s.,!?;:\u2014\u2013\-]+/g, " ")
    : sinComillas.replace(/[\s\u2014\u2013]+/g, " ")
  ).trim();
}

/** Tiras imprimibles (>=4) de un buffer binario. */
function printableRuns(buf) {
  const out = [];
  let cur = [];
  for (const b of buf) {
    if (b >= 0x20 && b < 0x7f) cur.push(String.fromCharCode(b));
    else {
      if (cur.length >= 4) out.push(cur.join(""));
      cur = [];
    }
  }
  if (cur.length >= 4) out.push(cur.join(""));
  return out;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Todo string dentro de un JSON, recursivo. */
function jsonStrings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) jsonStrings(x, out);
  else if (v && typeof v === "object") {
    for (const k of Object.keys(v)) {
      out.push(k);
      jsonStrings(v[k], out);
    }
  }
  return out;
}

function buildHaystack() {
  const parts = [];
  let nOrig = 0, nAssets = 0;
  for (const p of walk(ORIG)) {
    try {
      const runs = printableRuns(readFileSync(p));
      nOrig += runs.length;
      parts.push(runs.join("\n"));
    } catch { /* ignora ilegibles */ }
  }
  for (const p of walk(ASSETS)) {
    if (!p.endsWith(".json")) continue;
    try {
      const ss = jsonStrings(JSON.parse(readFileSync(p, "utf8")));
      nAssets += ss.length;
      parts.push(ss.join("\n"));
    } catch { /* json no parseable: se ignora, declarado */ }
  }
  return { crudo: parts.join("\n"), nOrig, nAssets };
}

/** Corre el censo entero bajo una politica de puntuacion. */
function censo(laxa) {
  const hay = fold(HAY_CRUDO, laxa);
  const prefijoMasLargo = (f) => {
    const w = f.split(" ").filter(Boolean);
    for (let n = w.length; n > 0; n--) {
      const pr = w.slice(0, n).join(" ");
      if (pr.length >= 4 && hay.includes(pr)) return { n, p: pr };
    }
    return { n: 0, p: "" };
  };
  const A = [], B = [];
  for (const [str, loc] of entradas) {
    if (isTechnical(str)) continue;
    const f = fold(str, laxa);
    if (f.length < 4 || hay.includes(f)) continue;
    const { n, p } = prefijoMasLargo(f);
    (n >= MIN_PREFIJO ? B : A).push([str, loc, n, p]);
  }
  return { A, B };
}

const MIN_PREFIJO = 3;
const { hay: _h, nOrig, nAssets, crudo: HAY_CRUDO } = buildHaystack();
const live = extractUserStrings(CORE, shellFiles(SRC));
const entradas = [...live.entries()];

const estricta = censo(false);
const laxa = censo(true);

// ROBUSTOS = clase A bajo AMBAS politicas: ausentes se mire como se mire.
const setLaxa = new Set(laxa.A.map(([s]) => s));
const robustos = estricta.A.filter(([s]) => setLaxa.has(s));

console.log(`fuentes: ${nOrig} tiras de original/u5/ultima5 + ${nAssets} strings de game/assets`);
console.log(`numerador: ${entradas.length} strings user-facing del extractor propio\n`);
console.log(`politica ESTRICTA (la puntuacion cuenta):  A=${estricta.A.length}  B=${estricta.B.length}`);
console.log(`politica LAXA (puntuacion = separador):    A=${laxa.A.length}  B=${laxa.B.length}`);
console.log(`\n★ ROBUSTOS (clase A en AMBAS): ${robustos.length} — ausentes se mire como se mire\n`);
for (const [s, loc] of robustos.sort((a, b) => b[0].length - a[0].length)) {
  console.log(`${JSON.stringify(s)}\t${loc}`);
}

const okE = estricta.A.some(([s]) => s.includes(CONTROL_ESTRICTO));
const okL = !laxa.A.some(([s]) => s.includes(CONTROL_LAXO));
console.log(`\ncontrol ESTRICTO (${JSON.stringify(CONTROL_ESTRICTO)} debe SALIR):     ${okE ? "OK" : "FALLA"}`);
console.log(`control LAXO (misma frase debe quedar ABSORBIDA por el TLK): ${okL ? "OK" : "FALLA"}`);
process.exit(okE && okL ? 0 : 1);
