/**
 * HERRAMIENTA DE MANTENIMIENTO de las tablas de idioma con clave-huella (#380).
 *
 * ── EL PROBLEMA QUE RESUELVE ───────────────────────────────────────────────────
 * Desde #380 las claves de `src/i18n/<lang>.json` son HUELLAS opacas
 * (`sha256(inglés)` truncado a 12 caracteres base64url — ver `src/i18n/huella.ts`),
 * no el texto inglés de EA. Eso saca la prosa del juego del árbol que publicamos,
 * pero un fichero de huellas es ilegible para una persona: nadie puede traducir
 * «hLxNGWpsy2Ec» sin saber qué frase es.
 *
 * La salida es que el inglés NO hace falta guardarlo: está en los ficheros del
 * juego DEL PROPIO USUARIO (`game/assets/`, extraídos de su copia, gitignored y
 * fuera del índice). Esta herramienta lo lee de ahí y RECONSTRUYE la vista legible
 * — en local, para el traductor — y vuelve a plegarla a huellas para commitear.
 *
 *   decode   huellas  → inglés   (vista de trabajo; NUNCA se commitea)
 *   encode   inglés   → huellas  (lo que sí se commitea)
 *   check    audita una tabla ya plegada
 *
 * ── LO QUE NO SE PIERDE ────────────────────────────────────────────────────────
 * El plegado es reversible para cualquiera que tenga su copia del juego: medido el
 * 25-08, las 3.998 claves de `es.json` están las 3.998 en el corpus local (CERO
 * huérfanas), así que `decode` las recupera todas. `encode` se niega a plegar una
 * clave que no esté en el corpus: sin eso, un typo del traductor se convertiría en
 * una huella irrecuperable y la traducción quedaría muerta para siempre sin avisar.
 *
 * ── USO ────────────────────────────────────────────────────────────────────────
 *   node game/tools/i18n-huella.mjs decode              # es.json → es.claro.json (legible)
 *   node game/tools/i18n-huella.mjs encode es.claro.json # vuelve a huellas, sobre es.json
 *   node game/tools/i18n-huella.mjs check               # audita es.json
 *
 * 🔴 `es.claro.json` LLEVA EL TEXTO DE EA: es material de trabajo local, está
 * gitignorado y no se commitea jamás (REGLA 4). Es exactamente el fichero que este
 * cambio existe para sacar del índice.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { buildCorpus } from "./i18n-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = join(HERE, "..");

/** Debe coincidir con `HUELLA_LEN` de `src/i18n/huella.ts` (careado por tests/i18n-huella.test.ts). */
export const HUELLA_LEN = 12;

/**
 * HUELLA canónica, por la biblioteca auditada de node. La implementación portable
 * del navegador (`src/i18n/huella.ts`) debe dar EXACTAMENTE esto; que lo haga no se
 * supone, lo carea `tests/i18n-huella.test.ts` sobre el dominio completo.
 */
export function huella(str) {
  return createHash("sha256").update(str, "utf8").digest("base64url").slice(0, HUELLA_LEN);
}

/** ¿`k` tiene forma de huella? Espejo de `esHuella()` del runtime. */
export function esHuella(k) {
  return typeof k === "string" && k.length === HUELLA_LEN && /^[A-Za-z0-9_-]+$/.test(k);
}

/**
 * Índice huella → inglés del corpus local. Es el que permite `decode`. Si dos
 * cadenas del corpus compartiesen huella la tabla sería ambigua, así que se ABORTA
 * en vez de elegir una (con N=12 no ocurre; el aborto es la red, no la expectativa).
 */
export function indiceCorpus({ corpus } = buildCorpus()) {
  const idx = new Map();
  for (const s of corpus) {
    const h = huella(s);
    const previo = idx.get(h);
    if (previo !== undefined && previo !== s) {
      throw new Error(
        `COLISIÓN de huella ${h} en el corpus entre ${JSON.stringify(previo.slice(0, 40))} y ` +
          `${JSON.stringify(s.slice(0, 40))} — sube HUELLA_LEN antes de seguir`,
      );
    }
    idx.set(h, s);
  }
  return idx;
}

/** Pliega una tabla de claves INGLESAS a claves-huella. Aborta si alguna no está en el corpus. */
export function encode(tabla, corpus) {
  const huerfanas = [];
  const strings = {};
  for (const [ingles, entrada] of Object.entries(tabla.strings)) {
    // 🔴 EL ORDEN DE ESTAS DOS PREGUNTAS ES EL ARREGLO DE UN FALLO MEDIDO (25-08).
    // «¿ya está plegada?» NO se puede responder por la FORMA de la clave: una huella
    // es 12 caracteres de [A-Za-z0-9_-], y hay inglés del juego que encaja en esa
    // forma — `Spirituality` e `Intelligence` tienen EXACTAMENTE 12 letras. Con la
    // pregunta de forma primero, esas dos claves se tomaban por huellas, se copiaban
    // en claro, y `t()` dejaba de encontrarlas: dos atributos del Ztats volvían al
    // inglés SIN error, sin aviso y sin diff sospechoso (lo cazó el careo total
    // contra el testigo, no una muestra). El CORPUS es el discriminante correcto:
    // si la clave es inglés del juego, se pliega; sólo si NO lo es se considera la
    // forma. Cualquier heurística de forma sobre texto es ambigua por construcción.
    if (corpus.has(ingles)) {
      strings[huella(ingles)] = entrada;
      continue;
    }
    if (esHuella(ingles)) {
      // No está en el corpus y tiene forma de huella ⇒ ya plegada. Permite re-encode
      // idempotente de una tabla mixta (media plegada, media recién traducida).
      strings[ingles] = entrada;
      continue;
    }
    huerfanas.push(ingles);
  }
  // ORDEN CANÓNICO por huella: el fichero plegado es el que se commitea y se fusiona
  // (`tools-lead/merge-i18n.sh` hace unión de claves), así que su orden no puede
  // depender de en qué orden llegó la vista de trabajo — si no, cada traductor
  // produciría un diff distinto para el mismo contenido.
  const ordenadas = Object.fromEntries(Object.entries(strings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  if (huerfanas.length) {
    throw new Error(
      `${huerfanas.length} clave(s) NO están en el corpus inglés — plegarlas las haría ` +
        `irrecuperables. Corrige o retira:\n  ` +
        huerfanas.slice(0, 12).map((k) => JSON.stringify(k.slice(0, 60))).join("\n  "),
    );
  }
  return { ...tabla, strings: ordenadas };
}

/** Despliega una tabla de huellas a claves inglesas legibles, usando el corpus local. */
export function decode(tabla, idx) {
  const perdidas = [];
  const strings = {};
  for (const [k, entrada] of Object.entries(tabla.strings)) {
    if (!esHuella(k)) {
      strings[k] = entrada; // ya legible
      continue;
    }
    const ingles = idx.get(k);
    if (ingles === undefined) {
      perdidas.push(k);
      strings[k] = entrada; // se conserva la huella: perder la traducción sería peor
      continue;
    }
    strings[ingles] = entrada;
  }
  // La vista de trabajo se ordena por el INGLÉS: es la que lee una persona, y el
  // orden por huella (canónico en el fichero plegado) es ruido para ella.
  const ordenadas = Object.fromEntries(Object.entries(strings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { tabla: { ...tabla, strings: ordenadas }, perdidas };
}

/**
 * Audita una tabla plegada: toda clave es huella y toda huella existe en el corpus.
 *
 * 🔴 «En claro» NO es `!esHuella(k)`. Ésa es la misma trampa de forma que arruinó a
 * `encode` (ver allí): `Spirituality` tiene 12 letras y pasa por huella. Una clave
 * está EN CLARO si es una cadena del CORPUS inglés — ese es el predicado que importa,
 * porque lo que se vigila es que no viaje texto de EA, no que las claves sean bonitas.
 * Con el predicado de forma, la guarda habría dado verde sobre las dos claves que el
 * bug dejó en inglés.
 */
export function check(tabla, corpus, idx) {
  const claves = Object.keys(tabla.strings);
  const claras = claves.filter((k) => corpus.has(k) || !esHuella(k));
  const fantasmas = claves.filter((k) => !corpus.has(k) && esHuella(k) && !idx.has(k));
  return { claras, fantasmas, total: claves.length };
}

// ── CLI ────────────────────────────────────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const [modo, arg] = process.argv.slice(2);
  const TABLA = join(GAME, "src", "i18n", "es.json");
  const CLARO = join(GAME, "src", "i18n", "es.claro.json");
  const leer = (p) => JSON.parse(readFileSync(p, "utf8"));
  const escribir = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + "\n");
  const { corpus } = buildCorpus();
  const idx = indiceCorpus({ corpus });

  if (modo === "decode") {
    const { tabla, perdidas } = decode(leer(TABLA), idx);
    escribir(CLARO, tabla);
    console.log(`es.claro.json escrito (${Object.keys(tabla.strings).length} entradas).`);
    if (perdidas.length) console.log(`⚠ ${perdidas.length} huella(s) sin inglés en tu corpus: ${perdidas.slice(0, 5).join(", ")}`);
    console.log("🔴 es.claro.json lleva texto de EA: es local, gitignorado, NO se commitea.");
  } else if (modo === "encode") {
    const origen = arg ? resolve(arg) : CLARO;
    escribir(TABLA, encode(leer(origen), corpus));
    console.log(`es.json plegado a huellas desde ${origen}.`);
  } else if (modo === "index") {
    // Índice huella → inglés por stdout, para consumidores que no son de node (hoy
    // `re/tools/detect_orphan_strings.py`). Se sirve DESDE AQUÍ y no se reimplementa
    // en python a propósito: el corpus lo define `i18n-corpus.mjs` y dos definiciones
    // del corpus divergirían — el detector empezaría a ver huérfanas que no lo son.
    process.stdout.write(JSON.stringify(Object.fromEntries(idx)));
  } else if (modo === "check") {
    const { claras, fantasmas, total } = check(leer(TABLA), corpus, idx);
    console.log(`es.json: ${total} entradas · claves en claro: ${claras.length} · huellas sin corpus: ${fantasmas.length}`);
    if (claras.length) console.log("  en claro:", claras.slice(0, 5).map((k) => JSON.stringify(k.slice(0, 50))).join(", "));
    if (fantasmas.length) console.log("  fantasmas:", fantasmas.slice(0, 8).join(", "));
    process.exit(claras.length || fantasmas.length ? 1 : 0);
  } else {
    console.error("uso: i18n-huella.mjs decode|encode [fichero]|check");
    process.exit(2);
  }
}
