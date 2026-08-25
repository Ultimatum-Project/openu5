#!/usr/bin/env node
/**
 * WALKTHROUGH-ESPEJO — derive-anchors.mjs (Fase C, paso OFFLINE).
 *
 * Enriquece un `routes/partNN.route.json` con ANCLAS DE POSICIÓN POR-INTERACCIÓN derivadas
 * del OCR ya committeado (los `expect` del guion) + la tabla LOOK2 (`assets/look2.json`).
 *
 * Deriva SÓLO lo invertible con certeza offline: los beats (L)ook-DIR cuyo resultado nombra
 * una FEATURE de tile («Look-East ...ves a hot stove»). Tanto la DIRECCIÓN como la feature
 * viven en el propio texto del `expect`, así que se deriva aunque el comando siga como `todo`
 * (OCR sin convertir a teclas): la feature se invierte a ids de tile por LOOK2 (la MISMA
 * fuente que `game.data.look2`) y esos ids viajan en el `anchor` del op de ese `ocrLn`. En
 * runtime, `anchors.ts` escanea el grid vivo por esos ids y resincroniza la posición a la
 * celda cuyo vecino-DIR casa (ver anchors.ts §Ancla de cara). Un ancla en un beat NO-conducido
 * (todo) sigue siendo útil: corrige la posición de la cadena para los ops CONDUCIDOS que
 * siguen (peajes/compras/Get), que es donde el ledger cobra vida.
 *
 * Se corre DESPUÉS de curate.mjs (curate regenera el route.json desde el overlay y borraría el
 * `anchor`; este paso es la última capa de enriquecimiento). Idempotente: re-escribe el
 * `anchor` de cada op derivable y PURGA los `anchor` viejos de ops que ya no derivan.
 *
 * La derivación es CONSERVADORA: si la dirección no consta (OCR partió «Look-2») o la feature
 * no invierte por LOOK2 (deseo del pozo «CORVETTE», resultado de (S)earch/(G)et), NO se ancla
 * — mejor sin ancla que con una falsa. La costura de entrada del segmento es el resync grueso.
 *
 *   node tools/derive-anchors.mjs part01            # una parte (escribe route.json)
 *   node tools/derive-anchors.mjs --all             # todas
 *   node tools/derive-anchors.mjs part01 --dry      # sólo reporta, no escribe
 *
 * ## ★★ CINTURÓN DE ESCRITURA — y por qué el de `curate.mjs` NO sirve aquí
 *
 * Este fichero escribe rutas versionadas y no llevaba cinturón. `curate-cablear-acta.md` §5.3 lo
 * fichó como «candidato barato: hoy sólo toca `op.anchor`, así que el aserto le saldría gratis».
 * El censo confirma el ALCANCE —una pasada sobre las 49 rutas commiteadas mueve 19 `op.anchor` y
 * **ni un solo campo de segmento**— pero desmiente el «gratis»: el cinturón de curate
 * (`camposPerdidos` + `clavesVigiladas`) sale gratis porque **no puede ver nada**.
 * `clavesVigiladas` EXCLUYE `script` por contrato, y el guion es lo ÚNICO que este fichero toca.
 *
 * MEDIDO, no argumentado: con `src:"overlay-timing"` en `part04-g03` (la etiqueta que curate
 * documenta en su §172), la pasada PURGÓ el ancla `expectDelta:+36` —una de las tres del
 * proyecto—, salió con **exit 0**, y `camposPerdidos(…, clavesVigiladas(…))` reportó **0**.
 * Un gate que no puede ponerse rojo no es un cinturón: es un aval.
 *
 * Así que se cablean LOS DOS, cada uno a su capa:
 * · `camposPerdidos`+`clavesVigiladas` — invariante compartido «esta pasada NO toca campos de
 *   segmento». Hoy es 0 POR CONSTRUCCIÓN; su valor es el día que alguien le añada a este fichero
 *   una escritura fuera del guion. Es un seguro declarado, no un hallazgo.
 * · `anclasPerdidas` — el canal CON DIENTES: un ancla de la ruta que la pasada no repone. Es la
 *   rama de purga, la única capacidad destructiva que este fichero tiene.
 *
 * Las dos se miden SIEMPRE, fuera de todo `if`, y ANTES del `writeFileSync`; lo que se condiciona
 * es la fatalidad. Con pérdidas: **exit 3 sin escribir**, nombrando cada una. `--allow-purga`
 * escribe a sabiendas y las ENUMERA (sin la enumeración la flag sería un `2>/dev/null`). `--dry`
 * informa y no rompe: no escribe, así que no hay daño donde poner la fatalidad (ruling #94).
 *
 * ⚠ ALCANCE HONESTO: aborta POR PARTE, no por lote — con varias partes en la línea, las
 * anteriores a la que aborta ya están escritas. No es una fuga: cada ruta pasa su propio cinturón
 * antes de su propia escritura.
 *
 * SEGUNDA FAMILIA — ANCLAS DE NPC (`kind:"npc"`, §Anclas de NPC al pie). Del ancla de NPC
 * cuelga el ledger entero de transacciones (runner.ts sólo lee `expectDelta` de un ancla de
 * NPC), y el corpus AD no tenía ninguna. Se derivan de los beats de (T)alk: el saludo del
 * mercader que el binario imprime NOMBRA su negocio y a sí mismo («welcome to Iolo's Bows!»,
 * «My name is Tika»), y esos dos nombres son POSICIONALMENTE invertibles al TIPO de tienda por
 * los propios assets del port (ShoppeKeeperMap.json × data.storeNames × data.shoppeKeeperNames,
 * el mismo emparejamiento de `shoppeKeeperAt`). Igual de conservador que la familia de cara: sin
 * location legible en el segmento, o con el nombre casando dos tipos, NO se ancla.
 *
 * La lógica PURA (`deriveSegmentAnchors`, `deriveSegmentNpcAnchors`, `parseLookExpect`,
 * `matchShoppeType`, `buildLook2Index`, `buildShoppeIndex`) se exporta para los unit tests
 * (tests/espejo-anchors.test.ts).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { camposPerdidos, clavesVigiladas, anclasPerdidas } from "./overlay-merge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOOK2_PATH = join(HERE, "..", "..", "..", "assets", "look2.json");
const DATA_PATH = join(HERE, "..", "..", "..", "assets", "data.json");
const SHOPPE_MAP_PATH = join(HERE, "..", "..", "..", "src", "core", "data", "ShoppeKeeperMap.json");

/** --routes <dir>: directorio de rutas alternativo (corpus paralelo, p.ej. routes-ad).
 *  Se resuelve en el CLI (main); las funciones puras no dependen de él. */
function resolveRoutesDir(args) {
  const i = args.indexOf("--routes");
  if (i === -1) return join(HERE, "..", "routes");
  const dir = args[i + 1];
  args.splice(i, 2);
  // `--routes` sin valor daba un TypeError de `undefined.startsWith` a media pasada. Un fallo de
  // uso tiene que salir por la puerta de uso, antes de leer nada.
  if (dir === undefined) {
    console.error("--routes necesita un directorio");
    process.exit(2);
  }
  return dir.startsWith("/") ? dir : join(HERE, "..", dir);
}

/**
 * ★ FLAGS DESCONOCIDAS = ERROR, Y ANTES DE ESCRIBIR NADA (puerta 4 del censo de
 * `curate-cablear-acta.md` §1, abierta también aquí).
 *
 * El filtro de part-ids es `args.filter((a) => !a.startsWith("--"))`: se tragaba en SILENCIO
 * cualquier `--loquesea` y hacía la pasada de ESCRITURA completa diciendo que todo bien. Aquí la
 * puerta es PEOR que en curate, porque la flag que se traga es la que APAGA la escritura:
 * `--dry-run` y `--dryrun` (los dos nombres naturales de `--dry`) no casaban el
 * `args.includes("--dry")` exacto, así que quien tecleaba un simulacro obtenía una pasada de
 * escritura sobre las 49 rutas versionadas, con exit 0.
 */
const FLAGS = new Set(["--dry", "--all", "--allow-purga"]);
function rechazaFlagsDesconocidas(args) {
  const malas = args.filter((a) => a.startsWith("--") && !FLAGS.has(a));
  if (!malas.length) return;
  console.error(`flag no reconocida: ${malas.join(" ")}`);
  console.error(`  conocidas: ${[...FLAGS].join(" ")} --routes <dir>  (no se ha tocado ninguna ruta)`);
  process.exit(1);
}

/** Tecla-flecha → dirección (espejo del ARROW map del runner / anchors.ts). */
export const ARROW_TO_DIR = {
  ArrowUp: "north",
  ArrowDown: "south",
  ArrowLeft: "west",
  ArrowRight: "east",
};

/** Ops que NO deben portar un ancla: resincronizar a mitad de un run de movimiento
 *  corrompería la costura de posición. Sólo se ancla en ops de comando/escena/todo. */
const isNavOp = (op) => Array.isArray(op?.nav);

/** Tiles de BANDA NOCTURNA (verja/puente de TOWN 0x0170 que sólo aparecen 20:00-4:59):
 *  0x99 = portcullis (verja cerrada). Una feature cuyo tile ∈ aquí es hora-dependiente →
 *  el ancla lleva hourBand:"night" y el runner reconcilia el reloj antes de resolver. */
const NIGHT_BAND_TILES = new Set([0x99]);

/** Features de OBJETO (viven en la capa de objetos/actores, NO en la rejilla de tiles estática).
 *  Un cofre de tesoro es un objeto móvil/abrible, no un tile: `faceCandidates` (anchors.ts)
 *  escanea SÓLO la rejilla base, así que un cofre SIEMPRE daría ANCHOR-MISS aunque esté presente
 *  (falso positivo de instrumento — medido en Cove part04-g01 «a chest» ×2). NO se ancla, igual
 *  que los resultados de (S)earch/(G)et. OJO: «a chest of drawers» (mueble) SÍ es tile estático →
 *  NO se excluye; sólo el cofre-objeto («a chest»/«a chest...?» normalizan ambos a "a chest"). */
const OBJECT_FEATURES = new Set(["a chest"]);

/** Sprites de ACTOR (NPCs con agenda: juglar 324+/aldeano 336+/mercader 340+/guardia 368+…,
 *  tiles ≥ 0x144). Una mirada a una PERSONA no es invertible: los actores viven en la capa
 *  NPC y SE MUEVEN (su celda en el replay ≠ la del LP) → sin ancla (medido en ad01-g03
 *  Britain: «a merchant»/«a minstrel» = ANCHOR-MISS de instrumento). La alfombra-objeto
 *  Carpet2 283 queda BAJO el corte y sigue anclable (capa de objetos del runner); los ítems
 *  de trama con phrase propia por encima del rango («the Amulet!» 439) NO se excluyen.
 *  320-323 = «a wizard» (medido ad04-g34 Moonglow). */
const ACTOR_TILE_MIN = 320;
const ACTOR_TILE_MAX = 383;

/** Tiles que NO existen en NINGÚN smallmap (barrido completo de maps/smallmaps.json): los
 *  Guardianes 94/95 son tiles de mapa de SHRINE («a Guardian!», medido ad04-g22), y los
 *  shrines no están en world.smallMaps → un ancla con ellos sólo puede dar MISS falso. */
const NON_SMALLMAP_TILES = new Set([94, 95]);

/**
 * Normaliza una frase para casar contra LOOK2, tolerando corrupción OCR ligera: minúsculas,
 * 0→o, colapso de espacios, y sin puntuación de borde. LOOK2 lleva el artículo incluido
 * («a hot stove», «an oaken barrel»), así que se compara la frase COMPLETA.
 */
export function normPhrase(s) {
  return String(s)
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[|]/g, "l")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Índice inverso frase-normalizada → [tileIds] desde el array LOOK2 (índice = tile id). */
export function buildLook2Index(look2) {
  const idx = new Map();
  look2.forEach((phrase, tileId) => {
    const n = normPhrase(phrase ?? "");
    if (!n) return;
    if (!idx.has(n)) idx.set(n, []);
    idx.get(n).push(tileId);
  });
  return idx;
}

/**
 * Quita el eco del comando y el marco de resultado de un texto de (L)ook, dejando la FEATURE:
 * «Look-East Thou dost see a hot stove» → «a hot stove». Devuelve "" si no queda resto.
 */
export function extractSees(text) {
  if (!text) return "";
  return String(text)
    .replace(/^\s*>?\s*look[-\s]*(?:north|south|east|west)?\b/i, "")
    .replace(/thou\s+dost\s+see/gi, " ")
    .replace(/\bplayer:\s*\w+\b!?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parsea un texto de expect como un beat de (L)ook-DIR: extrae la DIRECCIÓN (del token
 * «Look-<dir>») y la FEATURE (`extractSees`). Devuelve `{dir, sees}` o null si no es un look
 * con dirección legible (p.ej. «Look-2», eco partido por OCR — no invertible).
 */
export function parseLookExpect(text) {
  if (!text) return null;
  const m = /(?:^|\s|>)look[-\s]*(north|south|east|west)\b/i.exec(String(text));
  const dir = m?.[1]?.toLowerCase();
  if (!dir) return null;
  const sees = extractSees(text);
  if (!sees) return null;
  return { dir, sees };
}

/** Dirección del op-flecha que sigue a un op de comando (l) en el índice `i`, o null. */
function arrowDirAfter(script, i) {
  const next = script[i + 1];
  return next?.key ? (ARROW_TO_DIR[next.key] ?? null) : null;
}

/**
 * DERIVACIÓN PURA de las anclas de un segmento. Recorre los `expect`; para cada beat de
 * (L)ook-DIR con feature invertible por LOOK2, ancla el op del MISMO `ocrLn` (prefiere el op
 * de comando `l`; si sólo hay un `todo`, ancla ahí — el resync corrige el trail igual). La
 * dirección se toma del op-flecha cuando existe (más fiable que el OCR) o del texto. Fuente
 * única para CLI + units.
 *
 * @returns Array<{ opIndex, anchor:{kind:"face",cmd,dir,sees,tileIds,ocrLn} }> (dedupe por opIndex)
 */
export function deriveSegmentAnchors(seg, look2Index) {
  const script = seg.script ?? [];
  const byOpIndex = new Map();

  // índice ocrLn → primer op de comando `l`, y ocrLn → primer op anclable (no-nav)
  const cmdOpAt = new Map();
  const anyOpAt = new Map();
  script.forEach((op, i) => {
    if (op?.ocrLn == null || isNavOp(op)) return;
    if (!anyOpAt.has(op.ocrLn)) anyOpAt.set(op.ocrLn, i);
    if (String(op.key).toLowerCase() === "l" && !cmdOpAt.has(op.ocrLn)) cmdOpAt.set(op.ocrLn, i);
  });

  for (const b of seg.expect ?? []) {
    if (b?.ocrLn == null) continue;
    const parsed = parseLookExpect(b.text);
    if (!parsed) continue;
    const seesNorm = normPhrase(parsed.sees);
    if (OBJECT_FEATURES.has(seesNorm)) continue; // objeto (capa de objetos), no tile anclable → sin ancla
    const tileIds = look2Index.get(seesNorm);
    if (!tileIds || tileIds.length === 0) continue; // no es un look de tile (deseo/pozo/RNG)
    if (tileIds.every((t) => t >= ACTOR_TILE_MIN && t <= ACTOR_TILE_MAX)) continue; // mirada a un ACTOR (NPC móvil) → sin ancla
    if (tileIds.every((t) => NON_SMALLMAP_TILES.has(t))) continue; // tile de shrine (fuera de smallMaps) → sin ancla

    const opIndex = cmdOpAt.get(b.ocrLn) ?? anyOpAt.get(b.ocrLn);
    if (opIndex == null) continue; // beat sin op anclable (sólo movimiento) → sin resync
    if (byOpIndex.has(opIndex)) continue; // ya anclado (primer expect gana)

    const dir = arrowDirAfter(script, opIndex) ?? parsed.dir;
    // hourBand DERIVABLE del tile: una feature hora-dependiente (verja nocturna TOWN 0x0170,
    // portcullis 0x99) sólo se pinta en su banda; el id ya la implica. El runner reconcilia el
    // reloj a esa banda antes de leer el grid compuesto (evita el falso anchor-miss por reloj).
    const hourBand = tileIds.some((t) => NIGHT_BAND_TILES.has(t)) ? "night" : undefined;
    byOpIndex.set(opIndex, {
      kind: "face",
      cmd: "l",
      dir,
      sees: parsed.sees,
      tileIds: [...tileIds],
      ...(hourBand ? { hourBand } : {}),
      ocrLn: b.ocrLn,
    });
  }
  return [...byOpIndex.entries()].map(([opIndex, anchor]) => ({ opIndex, anchor }));
}

// ======================================================= ANCLAS DE NPC (mercader)
/**
 * Nº de location → clave `Location` de ShoppeKeeperMap.json. COPIA de `LOCATION_NAMES`
 * (src/core/shops/shops.ts): este fichero es .mjs y no puede importar el .ts. La copia NO
 * queda suelta — el unit test la PINCHA contra la del port (importa ambas), así que si el
 * port añade o renombra una location aquí salta rojo en vez de derivar en silencio.
 */
export const LOCATION_NAMES = {
  0: "Britannia_Underworld",
  1: "Moonglow",
  2: "Britain",
  3: "Jhelom",
  4: "Yew",
  5: "Minoc",
  6: "Trinsic",
  7: "Skara_Brae",
  8: "New_Magincia",
  17: "Lord_Britishs_Castle",
  18: "Palace_of_Blackthorn",
  19: "West_Britanny",
  20: "North_Britanny",
  21: "East_Britanny",
  22: "Paws",
  23: "Cove",
  24: "Buccaneers_Den",
  26: "Bordermarch",
  30: "Lycaeum",
  31: "Empath_Abbey",
  32: "Serpents_Hold",
};

/**
 * Censo de mercaderes del PORT, invertible por nombre. `ShoppeKeeperMap.json` (índice →
 * {Location, ShoppeKeeperType}) es POSICIONALMENTE paralelo a `data.storeNames` y a
 * `data.shoppeKeeperNames` — el mismo emparejamiento que hace `shoppeKeeperAt` (shops.ts),
 * incluida la eliminación del nombre basura "Simplon". Devuelve la tabla INVERSA que necesita
 * la derivación: dado el nombre del negocio o del mercader que el OCR del LP transcribe, el
 * TIPO de tienda (y la location donde vive, para la guarda).
 */
export function buildShoppeIndex(shoppeKeeperMap, storeNames, shoppeKeeperNames) {
  const keepers = shoppeKeeperNames.filter((n) => n !== "Simplon");
  return Object.entries(shoppeKeeperMap).map(([key, entry]) => {
    const index = Number(key);
    return {
      index,
      locName: entry.Location,
      type: entry.ShoppeKeeperType,
      store: storeNames[index] ?? "",
      keeper: keepers[index] ?? "",
    };
  });
}

/**
 * ¿Aparece `needle` en `hay` como PALABRA(S) completas? Ambos ya normalizados por `normPhrase`
 * (sólo [a-z ]). La frontera de palabra NO es cosmética: con substring pelado, el mercader
 * "Rob" (Lycaeum) casa dentro de «black **rob**es» y "Max" (castillo de LB) dentro de
 * «**Max**well» — MEDIDO, 4 falsos positivos en el corpus AD que la frontera elimina.
 */
export function hasWholeWords(hay, needle) {
  if (!needle) return false;
  return new RegExp(`(?:^| )${needle}(?:$| )`).test(hay);
}

/**
 * ¿Es este texto de expect un beat de (T)alk? El eco «Talk-<dir>» del LP encabeza la línea.
 * A diferencia de (L)ook NO se exige que la dirección sea legible: el ancla de NPC no lleva
 * dirección — el runner la calcula de la geometría party→NPC —, así que un «Talk-5outh» o un
 * «Talk-d» partido por el OCR sigue sirviendo.
 */
export function isTalkExpect(text) {
  return /(?:^|[\s>"])talk[-\s]/i.test(String(text ?? ""));
}

/**
 * Invierte un beat de (T)alk al TIPO de mercader del port, o null. Deriva por DOS canales
 * equivalentes y ambos textuales: el nombre del NEGOCIO («welcome to Iolo's Bows!») y el del
 * MERCADER («My name is Tika»), que el saludo del binario imprime literalmente.
 *
 * `locName` (de `seg.enter.loc`) es GUARDA, no pista: el mismo nombre puede repetirse y, sobre
 * todo, el ancla se resuelve contra los NPCs vivos de la location ACTUAL — anclar a
 * `shop:Blacksmith` por un saludo de Trinsic mientras la party está en Minoc engancharía al
 * herrero EQUIVOCADO y mediría una transacción que el LP no hizo. Sin location legible en el
 * segmento NO se ancla (conservador, como el resto del derivador).
 *
 * Devuelve null si el beat casa mercaderes de TIPOS distintos en la misma location (ambiguo:
 * se reporta como no-derivable, no se adivina).
 */
export function matchShoppeType(text, shoppeIndex, locName) {
  if (!isTalkExpect(text)) return null;
  if (!locName) return null;
  const n = normPhrase(text);
  const hits = shoppeIndex.filter(
    (s) =>
      s.locName === locName &&
      (hasWholeWords(n, normPhrase(s.keeper)) || hasWholeWords(n, normPhrase(s.store))),
  );
  const types = [...new Set(hits.map((s) => s.type))];
  return types.length === 1 ? types[0] : null;
}

/**
 * DERIVACIÓN PURA de las anclas de NPC de un segmento (gemela de `deriveSegmentAnchors`).
 *
 * Del ancla de NPC cuelga TODO el ledger de transacciones (runner.ts: `expectDelta` sólo se
 * lee de un `anchor.kind === "npc"`), y el corpus AD tenía CERO — de ahí este paso. Lo que se
 * emite es la MITAD derivable: el resync que planta la party junto al mercader correcto y abre
 * su conversación. El `expectDelta` NO se deriva aquí a propósito: exige el `seedInt`
 * triangulado del avatar del LP2, que aún no está (espejo-ledger-ad.md §4). Poner deltas antes
 * produciría un ledger de ceros que no distingue «el port cobró mal» de «la tienda no abrió».
 *
 * Sólo se ancla en segmentos de SUPERFICIE con location legible: en `overworld` el runner
 * declina el resync fino, y en `dungeon` no hay mercaderes.
 *
 * @returns Array<{ opIndex, anchor:{kind:"npc",cmd:"talk",match:"shop:<Type>",ocrLn} }>
 */
export function deriveSegmentNpcAnchors(seg, shoppeIndex) {
  const loc = seg.enter?.loc;
  if (typeof loc !== "number" || seg.enter?.dungeon === true) return [];
  const locName = LOCATION_NAMES[loc];
  if (!locName) return [];

  const script = seg.script ?? [];
  const cmdOpAt = new Map();
  const anyOpAt = new Map();
  script.forEach((op, i) => {
    if (op?.ocrLn == null || isNavOp(op)) return;
    if (!anyOpAt.has(op.ocrLn)) anyOpAt.set(op.ocrLn, i);
    if (String(op.key).toLowerCase() === "t" && !cmdOpAt.has(op.ocrLn)) cmdOpAt.set(op.ocrLn, i);
  });

  const byOpIndex = new Map();
  for (const b of seg.expect ?? []) {
    if (b?.ocrLn == null) continue;
    const type = matchShoppeType(b.text, shoppeIndex, locName);
    if (!type) continue;
    const opIndex = cmdOpAt.get(b.ocrLn) ?? anyOpAt.get(b.ocrLn);
    if (opIndex == null) continue; // beat sin op anclable (sólo movimiento) → sin resync
    if (byOpIndex.has(opIndex)) continue; // ya anclado (primer expect gana)
    byOpIndex.set(opIndex, { kind: "npc", cmd: "talk", match: `shop:${type}`, ocrLn: b.ocrLn });
  }
  return [...byOpIndex.entries()].map(([opIndex, anchor]) => ({ opIndex, anchor }));
}

// --------------------------------------------------------------------------- CLI
function loadLook2() {
  return JSON.parse(readFileSync(LOOK2_PATH, "utf8"));
}

/** Censo de mercaderes desde los assets del port (BOM del ShoppeKeeperMap incluido). */
function loadShoppeIndex() {
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const map = JSON.parse(readFileSync(SHOPPE_MAP_PATH, "utf8").replace(/^﻿/, ""));
  return buildShoppeIndex(map, data.storeNames ?? [], data.shoppeKeeperNames ?? []);
}

function listParts(routesDir) {
  return readdirSync(routesDir)
    .filter((f) => f.endsWith(".route.json"))
    .map((f) => f.replace(".route.json", ""))
    .sort();
}

/** Enriquece un route.json en disco (in-place). Devuelve estadísticas. */
function enrichPart(routesDir, part, look2Index, shoppeIndex, { dry, allowPurga }) {
  const path = join(routesDir, `${part}.route.json`);
  // ★ Se lee UNA sola vez y se parsea dos: `antes` es la foto del disco y `route` el objeto que
  // la pasada muta. Dos lecturas dejarían al cinturón midiendo contra un estado y al aviso contra
  // otro (la trampa que curate-cablear cerró en su §3).
  const enDisco = readFileSync(path, "utf8");
  const antes = JSON.parse(enDisco);
  const route = JSON.parse(enDisco);
  let derived = 0;
  let derivedNpc = 0;
  let purged = 0;
  for (const seg of route.segments ?? []) {
    const byIndex = new Map(deriveSegmentAnchors(seg, look2Index).map((h) => [h.opIndex, h.anchor]));
    const npcByIndex = new Map(deriveSegmentNpcAnchors(seg, shoppeIndex).map((h) => [h.opIndex, h.anchor]));
    seg.script?.forEach((op, i) => {
      // Ancla COLOCADA A MANO por overlay: ni se pisa ni se purga. El predicado es la FAMILIA
      // `overlay*`, igual que en `curate.mjs` §172 — era `=== "overlay"` exacto, y ese exacto es
      // el que dejó purgar el `expectDelta:+36` de `part04-g03` cuando el op llevaba el
      // `src:"overlay-timing"` que curate documenta como realmente existente en el corpus.
      // Ensanchar sólo PROTEGE: no puede crear pérdidas nuevas. Inerte hoy y dicho como tal —
      // los 117 ops con `src` del corpus llevan `"overlay"` exacto, así que 0 anclas cambian de
      // trato. Es un seguro alineado con el vecino, no un hallazgo.
      if (String(op.src ?? "").startsWith("overlay")) return;
      if (byIndex.has(i)) {
        op.anchor = byIndex.get(i);
        derived++;
      } else if (npcByIndex.has(i)) {
        op.anchor = npcByIndex.get(i);
        derivedNpc++;
      } else if (op.anchor) {
        delete op.anchor; // purga las anclas DERIVADAS (idempotencia). El guardián de lo
        purged++; //        hecho a mano es `src === "overlay"`, arriba, no el `kind`.
      }
    });
  }
  // ★★ CINTURÓN — LAS DOS CAPAS, medidas SIEMPRE y ANTES de escribir.
  //
  // Fuera de todo `if`: un cinturón dentro de la rama del caso que preocupa es código muerto el
  // día que la pérdida llegue por otro camino. Lo que se condiciona es la FATALIDAD.
  //
  // `campos` es el invariante compartido con `curate.mjs` y `apply-ledger-overlay.mjs` — la MISMA
  // `camposPerdidos`, no una réplica. Aquí es 0 POR CONSTRUCCIÓN (este fichero no escribe fuera
  // del guion) y se declara como tal: es el seguro para el día que eso cambie, no el que vigila
  // lo de hoy. El que vigila lo de hoy es `anclas`.
  const campos = camposPerdidos(antes, route, clavesVigiladas(antes));
  const anclas = anclasPerdidas(antes, route);
  const perdidas = [...campos, ...anclas];

  if (perdidas.length && !dry && !allowPurga) {
    console.error(`\n★ ABORTADO SIN ESCRIBIR — ${part}: esta pasada se llevaría ${perdidas.length} ancla(s)/campo(s):`);
    for (const p of perdidas) console.error(`   ${describePerdida(p)}`);
    console.error(
      `  El runner lee la RUTA: cada uno de éstos cambia lo que se EJECUTA (del ancla de NPC cuelga` +
        `\n  el ledger entero de transacciones). El guardián de lo puesto A MANO es \`src:"overlay*"\`;` +
        `\n  si el ancla es legítima, márcala así en la ruta o repónla desde el overlay. Si la baja es` +
        `\n  deliberada, acéptala a sabiendas con --allow-purga, ENUMERÁNDOLA en el mensaje del commit.` +
        `\n  (${part} y las partes posteriores quedan SIN TOCAR.)`,
    );
    process.exit(3);
  }

  if (!dry) writeFileSync(path, JSON.stringify(route, null, 2) + "\n");
  // Se nombran también en `--dry` y bajo `--allow-purga`: en el primero porque informar sin romper
  // es justo lo que se le pide, y en el segundo porque una pérdida aceptada a sabiendas hay que
  // poder copiarla al commit. Callarlas en esos dos modos dejaría la purga esperando su turno.
  for (const p of perdidas) console.log(`   ANCLA PERDIDA: ${describePerdida(p)}`);
  return { derived, derivedNpc, purged, perdidas: perdidas.length };
}

/** Una línea legible por pérdida, del canal que sea (campo de segmento o ancla del guion). */
function describePerdida(p) {
  if (p.clave !== undefined && p.opIndex === undefined)
    return `${p.motivo}  ${p.segId} · ${p.clave} = ${JSON.stringify(p.enRuta)}`; // campo de segmento
  const donde = p.opIndex >= 0 ? ` · op[${p.opIndex}]` : "";
  const que = p.clave ? ` · ${p.clave}` : "";
  return `${p.motivo}  ${p.segId}${donde}${que} = ${JSON.stringify(p.enRuta)}`;
}

function main() {
  const args = process.argv.slice(2);
  const routesDir = resolveRoutesDir(args); // consume `--routes <dir>` de `args`
  rechazaFlagsDesconocidas(args); // ★ puerta 4: antes de leer o escribir NADA
  const dry = args.includes("--dry");
  const all = args.includes("--all");
  const allowPurga = args.includes("--allow-purga");
  const parts = all ? listParts(routesDir) : args.filter((a) => !a.startsWith("--"));
  if (parts.length === 0) {
    console.error("uso: derive-anchors.mjs <partNN...> | --all [--dry] [--allow-purga] [--routes <dir>]");
    process.exit(2);
  }
  const look2Index = buildLook2Index(loadLook2());
  const shoppeIndex = loadShoppeIndex();
  let totalDerived = 0;
  let totalNpc = 0;
  let totalPerdidas = 0;
  for (const part of parts) {
    const { derived, derivedNpc, purged, perdidas } = enrichPart(routesDir, part, look2Index, shoppeIndex, {
      dry,
      allowPurga,
    });
    totalDerived += derived;
    totalNpc += derivedNpc;
    totalPerdidas += perdidas;
    console.log(
      `${part}: ${derived} anclas de cara, ${derivedNpc} de NPC${purged ? ` (${purged} purgadas)` : ""}` +
        `${perdidas ? `, ${perdidas} PERDIDAS ★` : ""}${dry ? " [dry]" : ""}`,
    );
  }
  console.log(
    `TOTAL: ${totalDerived} anclas de cara + ${totalNpc} de NPC derivadas` +
      `${totalPerdidas ? ` · ★ ${totalPerdidas} ANCLA(S)/CAMPO(S) PERDIDOS` : ""}` +
      `${dry ? " (dry-run, sin escribir)" : ""}`,
  );
}

// sólo ejecuta el CLI si se invoca directamente (no al importarse desde los unit tests)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
