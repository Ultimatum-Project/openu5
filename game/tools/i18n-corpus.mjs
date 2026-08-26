/**
 * i18n — CORPUS CANÓNICO de strings INGLESES del juego (base anti-fabricación).
 *
 * Reúne en un solo Set TODO string inglés que existe realmente en el canon del
 * port, desde los MISMOS orígenes que cuenta `docs/i18n/count.mjs` (assets
 * extraídos del binario) MÁS el manifiesto del core (`approved-strings.json`) y
 * el barrido AST de literales user-facing del core (`extract-user-strings.mjs`).
 *
 * PARA QUÉ. La capa de idioma (`src/i18n/`) es una tabla `inglés → traducción`.
 * El guard `tests/i18n-manifest.test.ts` exige que CADA key de un `<lang>.json`
 * case con un string de este corpus: es IMPOSIBLE «inventar» diálogo que no
 * exista en el original (mismo principio que la guarda de `approved-strings`,
 * §2.4 de `docs/i18n/analisis.md`), sólo que ahora cubre TAMBIÉN los ~5.000
 * strings de datos que `approved-strings` no toca (§2.5).
 *
 * Es un corpus MAXIMALISTA a propósito: incluye texto libre Y tokens de mecánica
 * (keywords, sílabas, mantras) — todos son strings ingleses REALES; la política
 * de qué se traduce y cómo (§3 del análisis) es de las fases de contenido, no de
 * esta guarda. Aquí sólo respondemos «¿existe este inglés en el canon?».
 *
 * PURO / sin build: lee los JSON de assets por fs (como el resto de la suite) y
 * el core por AST. Reutilizable desde tests y tooling.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractUserStrings, shellFiles } from "./extract-user-strings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = join(HERE, ".."); // game/
const ASSETS = join(GAME, "assets");
const CORE = join(GAME, "src", "core");
const SHELL = shellFiles(join(GAME, "src")); // main.ts + conductores ui/ (F0b hueco b + TRAMO 1)
const APPROVED = join(GAME, "tests", "fixtures", "approved-strings.json");
const DERIVED_PRESENTATION = join(GAME, "tests", "fixtures", "derived-presentation.json");

const hasLetter = (s) => typeof s === "string" && /[A-Za-z]/.test(s);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const words = (s) => (typeof s === "string" ? s.split(/\s+/).filter(Boolean).length : 0);

/** Recolecta como ARRAY todo string (con ≥1 letra) anidado en `value`. */
function collectStrings(value) {
  const out = [];
  JSON.stringify(value, (_k, v) => {
    if (hasLetter(v)) out.push(v);
    return v;
  });
  return out;
}

/**
 * HASH de contenido de una superficie (detector de deriva del manifiesto F0a).
 * NORMALIZACIÓN EXACTA (reproducible a mano — data-strings-manifest.md §hash):
 *   1. filtra a strings con ≥1 letra (predicado del corpus);
 *   2. Unicode NFC;
 *   3. NO recorta (los `\n` finales/internos son semánticos y cuentan);
 *   4. dedup (Set) y ORDENA lexicográficamente por unidad de código (Array.sort);
 *   5. `JSON.stringify` del array ordenado (comillas/escapes canónicos de JS);
 *   6. sha256 hex.
 * Devuelve `sha256:<hex>`.
 */
export function surfaceHash(strings) {
  const norm = [...new Set(strings.filter(hasLetter).map((s) => s.normalize("NFC")))].sort();
  return "sha256:" + createHash("sha256").update(JSON.stringify(norm)).digest("hex");
}

/**
 * Descompone el corpus de ASSETS extraídos en SUPERFICIES con procedencia (F0a).
 * Cada superficie = `{ id, cube, strings }` donde `cube` ∈ L (traducible libre) /
 * M (mecánica, entra como input) / X (técnico, no se traduce). `data.json` se parte
 * POR POOL y por bloque display/mecánica porque mezcla cubos en un mismo fichero.
 * Las TLK se parten en texto (L) y keywords (M). PURO; lee assets por fs.
 *
 * NO incluye el core (approved-strings + literales AST) — ese tiene su propio
 * manifiesto (`approved-strings.json`). Aquí sólo los ~5.130 strings de datos.
 */
export function buildCorpusBySurface({ assetsDir = ASSETS } = {}) {
  const A = (f) => join(assetsDir, f);
  const surfaces = [];
  const surface = (id, cube, strings) => surfaces.push({ id, cube, strings });

  // TLK: texto de diálogo (L) vs keywords tecleadas (M), por fichero maestro.
  for (const f of ["towne", "castle", "keep", "dwelling"]) {
    const npcs = readJson(A(`talk/${f}.json`));
    const text = [];
    const kw = [];
    const pull = (segs) => {
      for (const s of segs || []) if (s.kind === "text") text.push(s.text);
    };
    const pullQa = (qa) => {
      for (const q of qa || []) {
        for (const k of q.keywords || []) kw.push(k);
        for (const ans of q.answer || []) pull(ans);
      }
    };
    for (const n of npcs) {
      pull(n.name);
      pull(n.description);
      pull(n.greeting);
      pull(n.job);
      pull(n.bye);
      pullQa(n.qa);
      // Árboles de diálogo por LABEL (ramas alcanzadas por keyword): su texto
      // —initialLine, defaultAnswers, qa anidado— es tan user-facing como el resto
      // y debe entrar al corpus (si no, traducirlo sería «huérfano»). Antes se
      // escapaba: cerraba el matcher a las ramas ramificadas de NPCs grandes (Yew).
      for (const L of n.labels || []) {
        pull(L.initialLine);
        for (const ans of L.defaultAnswers || []) pull(ans);
        pullQa(L.qa);
      }
    }
    surface(`talk/${f}.json#text`, "L", text.filter(hasLetter));
    surface(`talk/${f}.json#keywords`, "M", kw.filter(hasLetter));
  }

  // Superficies de fichero completo (texto libre; questions mezcla L+M).
  const CUBE_FILE = {
    "story.json": "L",
    "signs.json": "L",
    "shoppe.json": "L",
    "look2.json": "L",
    "intro-scenes.json": "L",
    "questions.json": "L+M",
    // Superficie del ENDGAME (ENDMSG.DAT → endgame.json: scene/narration/dialogue).
    // Cierra el blind-spot estructural `i18n-corpus-sin-endgame` (diff-ocr-masivo §1):
    // era el único .DAT de texto sin superficie — el diálogo final de LB («Didst thou
    // bring my box?»…, part24:1643-1673) quedaba fuera de la guarda anti-fabricación.
    "endgame.json": "L",
    // Superficie de los MENSAJES DEL BÚFER DS 0xB21E (KARMA/MISCMSG/ENDMSG.DAT →
    // ds-strings.json, FICHA β). Entra en el MISMO commit en que los literales salen de
    // `game/src`: hasta el 25-08 estos parlamentos llegaban al corpus por sus claves de
    // `approved-strings.json`, y al retirarse esas 31 claves el inglés de es.json se
    // habría quedado HUÉRFANO (medido: `i18n-manifest` en rojo con la traducción de la
    // traición). El texto no ha desaparecido: ha cambiado de vehículo, y el corpus lo
    // sigue por el vehículo nuevo.
  };
  for (const [f, cube] of Object.entries(CUBE_FILE)) surface(f, cube, collectStrings(readJson(A(f))));

  // ds-strings.json (KARMA/MISCMSG/ENDMSG.DAT → búfer DS 0xB21E, FICHA β): los records
  // CRUDOS y, además, las formas COMPUESTAS que el motor imprime de verdad.
  //
  // 🔴 POR QUÉ HACEN FALTA LAS DOS, y no basta con los records: la clave de `es.json` es
  // la huella del string que recibe `t()`, y el motor no imprime el record pelado — lo
  // ENVUELVE (el original imprime la comilla y el `\n\n` con putchar/DS aparte del
  // record). Hasta el 25-08 esas formas compuestas llegaban al corpus por sus claves de
  // `approved-strings.json`; al salir los literales de `game/src` esas 31 claves se
  // retiraron y 19 traducciones de es.json se quedaron HUÉRFANAS (medido, no previsto:
  // `i18n-manifest` en rojo). Se emiten aquí para que el corpus siga cubriendo lo que el
  // motor emite.
  //
  // ⚠ ESTA TABLA ES UN ESPEJO DE LA COMPOSICIÓN DEL PORT, y dos implementaciones
  // divergen. No se deja al cuidado de nadie: `game/tests/ds-strings-compuestas.test.ts`
  // CAREA las formas de aquí contra las que emiten de verdad `game.ts`, `camp.ts`,
  // `shrine-ceremonies.ts` y `blackthorn-capture.ts`, y enrojece si el port cambia una
  // decoración sin tocar esta tabla.
  const ds = readJson(A("ds-strings.json"));
  const dsCrudos = Object.values(ds).flat().filter(hasLetter);
  const K = ds["KARMA.DAT"] ?? [];
  const M = ds["MISCMSG.DAT"] ?? [];
  const E = ds["ENDMSG.DAT"] ?? [];
  const dsCompuestas = [
    // Discursos de resurrección/aparición: `"` + record + `"` (game.ts / camp.ts).
    ...K.map((r) => `"${r}"`),
    // Lecciones largas del Codex (recs 20-27): `"` + record + `"\n\n` (shrine-ceremonies.ts).
    ...M.slice(20, 28).map((r) => `"${r}"\n\n`),
    // Preguntas del interrogatorio (recs 0-2): record + virtud + `?"` (blackthorn-capture.ts).
    ...M.slice(0, 3).map((r) => `${r}{}?"`),
    // Amenaza del reloj de arena (rec8): record + nombre + ` die!" ` (blackthorn-capture.ts).
    ...(M[8] === undefined ? [] : [`${M[8]}{} die!" \n\n`]),
    // Escena del Códice (ENDMSG rec9): el port recorta el `\n` final (quest/lordbritish.ts).
    ...(E[9] === undefined ? [] : [E[9].replace(/\n+$/, "")]),
  ].filter(hasLetter);
  surface("ds-strings.json#records", "L", dsCrudos);
  surface("ds-strings.json#composed", "L", dsCompuestas);

  // demo-scene.json (MISCMAPS.DAT): los TÍTULOS de capítulo del attract-demo
  // («The Summoning»…) son texto user-facing real del binario; el resto del
  // fichero son mapas/bytecode del guion (números, sin texto).
  surface("demo-scene.json#titles", "L", (readJson(A("demo-scene.json")).titles ?? []).filter(hasLetter));

  // data.json: display-nouns (L) · tokens de mecánica (M) · diccionario (X) · pools.
  const d = readJson(A("data.json"));
  const flat = (v) => (Array.isArray(v) ? v.flat(Infinity).filter((x) => typeof x === "string") : []);
  const DISPLAY = [
    "longArmour", "weaponNames", "ringsAmulets", "monsterNamesMixed", "monsterNamesUpper",
    "specialItemNames", "shards", "specialItemNames2", "shortArmour", "potions", "reagents",
    "spells", "locationNames", "virtues", "storeNames", "shoppeKeeperNames", "searchObjects",
  ];
  surface("data.json#display-nouns", "L", DISPLAY.flatMap((k) => flat(d[k])).filter(hasLetter));
  surface("data.json#spellRunes", "M", flat(d.spellRunes).filter(hasLetter));
  surface("data.json#mantras", "M", flat(d.mantras).filter(hasLetter));
  surface("data.json#wordsOfPower", "M", flat(d.wordsOfPower).filter(hasLetter));
  surface("data.json#talkCompressedWords", "X", flat(d.talkCompressedWords).filter(hasLetter));
  // stringPools: técnicos (nombres de fichero/códigos/basura binaria) vs texto runtime.
  const TECH_POOLS = new Set([
    "scrollSpellCodes", "parenDigitStrings", "spellMnemonicCodes", "assetFilenames1",
    "mapFilesDungeonNames", "introMenuU4Transfer", "mapDataFilenames", "scrollShortforms",
  ]);
  for (const p of d.stringPools || []) {
    surface(`data.json#pool/${p.name}`, TECH_POOLS.has(p.name) ? "X" : "L", (p.strings || []).filter(hasLetter));
  }

  return surfaces;
}

/**
 * INVENTARIO DE MUNDO-CERRADO de assets (auditoría G8). Todo `.json` bajo
 * assets/ debe estar en UNA de las dos listas: CUBIERTO por una superficie del
 * corpus, o EXCLUIDO con razón explícita. Un asset nuevo sin clasificar pone
 * ROJO el test de inventario (tests/i18n-corpus-inventory.test.ts) — antes
 * nacía invisible para la guarda anti-fabricación (así quedó fuera endgame.json
 * hasta el carril diff-ocr-masivo).
 */
export const COVERED_ASSET_FILES = [
  "talk/towne.json",
  "talk/castle.json",
  "talk/keep.json",
  "talk/dwelling.json",
  "story.json",
  "signs.json",
  "shoppe.json",
  "look2.json",
  "intro-scenes.json",
  "questions.json",
  "endgame.json",
  "ds-strings.json",
  "demo-scene.json",
  "data.json",
];

/** Excluidos del corpus CON RAZÓN: sin texto user-facing traducible. */
export const EXCLUDED_ASSET_FILES = {
  "british-path.json": "ruta de patrulla de LB: coordenadas puras, sin strings",
  "dungeon-feat.json": "atlas de features 3D (ITEMS.16): metadatos de sprite, ids técnicos",
  "dungeon-mon.json": "atlas del monstruo errante 3D (MON0-7.16): metadatos de sprite, ids técnicos",
  "dungeon-persp.json": "atlas de rodajas 3D (DNG*.16): metadatos de sprite, ids técnicos",
  "endgame-scenes.json": "atlas de láminas del endgame: frames 'endN:M', ids técnicos",
  "font-proport-hd.json": "glifos de fuente HD: bitmaps, sin texto",
  "proport-font.json": "glifos de la fuente proporcional: bitmaps, sin texto",
  "initial-state.json": "INIT.GAM parseado: estado binario de save (nombres propios de roster = datos, no superficie de traducción)",
  "intro-pics.json": "láminas de la intro: frames 'create:N', ids técnicos",
  "manifest.json": "manifiesto de assets: hashes de procedencia",
  "npcs.json": "colocación/horarios de NPC: numérico, sin strings",
  "shrine-scene.json":
    "rejillas de santuario/Codex de MISCMAPS.DAT (#277): tiles + 'source' técnico, sin strings user-facing",
  "water-xbrz.json": "tiles de agua precomputados (xBRZ): píxeles + crédito técnico",
  "maps/overworld.json": "mapa BRIT.DAT: matriz de tiles, sin strings",
  "maps/underworld.json": "mapa UNDER.DAT: matriz de tiles, sin strings",
  "maps/smallmaps.json": "mapas de pueblo/castillo (*.DAT): tiles, sin strings",
  "maps/dungeons.json": "mazmorras DUNGEON.CBT/DNG: celdas, sin strings",
  "maps/combatmaps.json": "arenas de combate (.CBT): tiles/formaciones, sin strings",
};

/**
 * Huecos del inventario contra el DISCO: `.json` reales bajo `assetsDir` que no
 * están ni cubiertos ni excluidos (`unclassified`), y entradas de las listas que
 * ya no existen en disco (`stale`). Ambos deben ser [] (test de inventario).
 */
export function assetInventoryGaps({ assetsDir = ASSETS } = {}) {
  const onDisk = [];
  const walkDir = (dir, prefix) => {
    for (const ent of readdirSync(join(assetsDir, dir), { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      // #235: Dirent.isDirectory() NO sigue symlinks — un subdir ENLAZADO (worktrees
      // que enlazan assets por entradas) se saltaba entero y sus .json clasificados
      // salían como «stale» en falso. statSync sí sigue el enlace.
      const isDir = ent.isDirectory() ||
        (ent.isSymbolicLink() && statSync(join(assetsDir, dir, ent.name)).isDirectory());
      if (isDir) walkDir(join(dir, ent.name), rel);
      else if (ent.name.endsWith(".json")) onDisk.push(rel);
    }
  };
  walkDir("", "");
  const classified = new Set([...COVERED_ASSET_FILES, ...Object.keys(EXCLUDED_ASSET_FILES)]);
  return {
    unclassified: onDisk.filter((f) => !classified.has(f)).sort(),
    stale: [...classified].filter((f) => !onDisk.includes(f)).sort(),
  };
}
/**
 * Construye el corpus. Devuelve `{ corpus: Set<string>, sources: {...counts} }`.
 * `assetsDir`/`coreDir` parametrizables para tests; por defecto los del repo.
 */
export function buildCorpus({ assetsDir = ASSETS, coreDir = CORE, approvedPath = APPROVED } = {}) {
  const corpus = new Set();
  const sources = {};
  const before = () => corpus.size;

  // (1) Manifiesto del core (approved-strings.json): keys inglesas ya citadas.
  let n = before();
  // SIN filtro hasLetter aquí: una key de approved-strings está POR DEFINICIÓN citada
  // contra el binario (su propio guard lo exige), letras o no — p.ej. la comilla de
  // apertura del saludo/despedida de tienda (`"`, `\n\n"`, putchar 0x22 / DS 0x7854),
  // que en ES se traduce a «. Los demás orígenes conservan el filtro (son barridos
  // masivos de datos, no literales citados uno a uno). Carril i18n-restos.
  for (const k of Object.keys(readJson(approvedPath))) corpus.add(k);
  sources.approvedStrings = corpus.size - n;

  // (2) Barrido AST de literales user-facing del core + shell (mismo extractor del guard).
  n = before();
  for (const text of extractUserStrings(coreDir, SHELL).keys()) if (hasLetter(text)) corpus.add(text);
  sources.coreLiterals = corpus.size - n;

  // (3) Assets extraídos del binario, por superficie (mismo origen que count.mjs).
  n = before();
  for (const { strings } of buildCorpusBySurface({ assetsDir })) {
    for (const s of strings) corpus.add(s);
  }
  sources.assets = corpus.size - n;

  // (4) PRESENTACIÓN DERIVADA (lista auditada): palabras-label sueltas cuya forma
  // canónica vive dentro de una frase-madre del corpus (p.ej. "Keys" ← «Buy Keys,
  // Gems, or Torches?»), renderizadas envueltas en un compuesto que el choke t() no
  // alcanza → se traducen con t() en código. Cada key cita su frase-origen + DS en
  // el propio fichero. Las keys `_*` son documentación, no corpus. Ver
  // docs/i18n/censo-blindspot-property-access.md y derived-presentation.json.
  n = before();
  for (const k of Object.keys(readJson(DERIVED_PRESENTATION))) if (!k.startsWith("_") && hasLetter(k)) corpus.add(k);
  sources.derivedPresentation = corpus.size - n;

  return { corpus, sources };
}

/** Palabras (tokens separados por espacio) de un array de strings. */
export function wordCount(strings) {
  return strings.reduce((a, s) => a + words(s), 0);
}

// CLI: `--check <lang.json>` valida keys ⊆ corpus · `--surfaces` emite las
// superficies computadas (id/cube/strings/words/hash) para (re)generar el manifiesto.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--wrap-candidates")) {
    // Hueco (c): source-strings con \n INTERIOR suelto (wrap inglés de 16-col). Son
    // los que F3 debe re-clasificar (wrap vs. párrafo) al traducir; jamás portar su \n.
    const wrap = /(?<=[^\n])\n(?=[^\n])/;
    const { corpus } = buildCorpus();
    const cands = [...corpus].filter((s) => wrap.test(s));
    console.log(`${cands.length} source-strings con \\n interior (candidatos wrap para F3):\n`);
    for (const s of cands) console.log("  " + JSON.stringify(s.length > 70 ? s.slice(0, 70) + "…" : s));
    process.exit(0);
  }
  if (process.argv.includes("--surfaces")) {
    const rows = buildCorpusBySurface().map((s) => ({
      id: s.id,
      cube: s.cube,
      strings: new Set(s.strings.map((x) => x.normalize("NFC"))).size,
      words: wordCount([...new Set(s.strings)]),
      hash: surfaceHash(s.strings),
    }));
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    process.exit(0);
  }
  const { corpus, sources } = buildCorpus();
  const checkIdx = process.argv.indexOf("--check");
  if (checkIdx >= 0 && process.argv[checkIdx + 1]) {
    const table = readJson(process.argv[checkIdx + 1]);
    const strings = table.strings ?? table;
    const orphans = Object.keys(strings).filter((k) => !corpus.has(k));
    console.log(`corpus: ${corpus.size} strings`, sources);
    if (orphans.length) {
      console.log(`\n${orphans.length} KEY(S) HUÉRFANA(S) (no existen en el canon inglés):`);
      for (const o of orphans) console.log("  " + JSON.stringify(o));
      process.exit(1);
    }
    console.log(`\nOK — las ${Object.keys(strings).length} keys casan con el corpus.`);
  } else {
    console.log(`corpus: ${corpus.size} strings`, sources);
  }
}
