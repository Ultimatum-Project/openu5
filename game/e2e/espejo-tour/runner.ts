/**
 * WALKTHROUGH-ESPEJO — runner genérico de rutas (Fase A).
 *
 * Consume un `routes/partNN.route.json` (segmentos tipados con costura, ver README) y:
 *
 *   1. REPRODUCE el guion: replay-por-inputs del spam de movimiento del LP (fuente
 *      primaria de navegación) + ops de escena (teclas, keywords, overlays), con
 *      RESINCRONIZACIÓN en cada costura (enterLocation/teleport sancionados = arnés).
 *   2. CAPTURA el transcript de la consola LÓGICA (`__u5test.consoleLines()`,
 *      acumulador page-side con poll 35 ms + dedupe por solape — arnés de fase 1,
 *      re/notes/espejo-part08.md §Arnés, con sus caveats de canal).
 *   3. DIFF normalizado por segmento contra los bloques `expect` del OCR:
 *      des-wrap 16 cols (los bloques ya vienen unidos), colapso difuso OCR
 *      (l/I/1/]→i, 0/O→o), números wildcard + LEDGER numérico (la caza de derivas
 *      de estado acumulado: oro/comida/fechas se REGISTRAN, no se descartan),
 *      exclusión RNG por patrón y known-gaps por ticket (si un known-gap MATCHEA,
 *      el reporte lo aflora como «gap-cerrado»).
 *
 * Verdicto por segmento: match / divergente / no-comparable; conformidad por parte =
 * comparables-matcheados / comparables. Toda divergencia lleva el snippet más parecido
 * del transcript (evidencia para el ticket; ver tools/evidence.sh para el frame).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { getPos, inDungeonCombat, dungeonResolveRoomCombat } from "../grandtour/nav";
import { tecla } from "../tempo-video.mjs";
import {
  acumulaInventario,
  acumulaVehiculo,
  aplicaVehiculo,
  decideVehiculo,
  resumenVehiculo,
  sondaVehiculo,
  type VehiculoReport,
} from "./vehiculo";
import { runeSyllableForInitial } from "../../src/core/magic/spells.js";
import {
  resolveFaceAnchor,
  resolveFaceAnchorAcrossFloors,
  objectFaceCandidates,
  resolveNpcAnchor,
  dirFromCellToNpc,
  ARROW_TO_DIR,
  planAnchorResync,
  driftHistogram,
  bandMatches,
  bandCanonicalHour,
  DRIFT_BUCKETS,
  type DriftBucket,
  type Dir4,
  type Anchor,
  type FaceAnchor,
  type NpcAnchor,
  type NpcLive,
  type GridSnapshot,
  type FloorGrid,
  type ObjLive,
} from "./anchors";
import {
  LP1_PROFILE as LP1,
  profileFor,
  collapseWith,
  stripGhostPass,
  isGarbage,
  coverageRatio,
  coverageRatioMonotone,
  probeFold,
  isRosterTail,
  lateFold,
  isLateStatusPanel,
  LATE_COMBAT_RNG,
  LATE_PENDING,
  type OcrProfile,
} from "./ocr-profile";
import {
  newDngFilter,
  resetFilter,
  stepFilterForSegment,
  type DngFilter,
  type FloorGrid as DngFloorGrid,
} from "./dungeon-filter.js";
import { shopGreetingLines, type AnchorLike } from "./shop-greeting.js";
import { inputSinks, livePacers } from "./checkpoint";
import { resumenResiembra } from "./resiembra";
// La DECISIÓN ante un prompt de guardia es la tabla del Grand Tour (unit-testeada, task #51):
// se IMPORTA para que los dos arneses no puedan divergir. Ver `resolveBlockingYesNo`.
import { blockingYesNoAction } from "../grandtour/nav-tactics";

/** Set vacío COMPARTIDO para el camino en que la palanca de saludos está apagada: evita alocar
 *  uno por segmento y deja explícito que «apagada» es un Set vacío, no `undefined`. */
const EMPTY_LINES: ReadonlySet<number> = new Set<number>();

/** DESENLACE de combate (la línea de corte que `segment.mjs` marca `exact`). Es el MISMO
 *  vocabulario que `RNG_AUTO` ya declara no-comparable para la clase `auto` — no se añade
 *  ninguna categoría nueva de no-comparable: se le quita al `exact` la exención que tenía. */
const COMBAT_OUTCOME = /victory|battle is lost|battie is lost/i;

const HERE = dirname(fileURLToPath(import.meta.url));

/** Pisabilidad de tiles para validar la celda de un resync (misma fuente que el motor y
 *  que nav.ts: TileData.json → IsWalking_Passable, más las puertas regulares). Se usa para
 *  no teletransportar la party a un muro al resolver un ancla. */
const TILE_DATA = JSON.parse(
  readFileSync(join(HERE, "..", "..", "src", "core", "data", "TileData.json"), "utf8"),
) as Record<string, { IsWalking_Passable?: boolean }>;
const REGULAR_DOORS = new Set([184, 186]);
const standableTile = (tile: number): boolean =>
  Boolean(TILE_DATA[String(tile)]?.IsWalking_Passable) || REGULAR_DOORS.has(tile);
export const ROUTES_DIR = join(HERE, "routes");
/** Rutas del ESPEJO-2 (LP de Alex Diener, 25 episodios) — corpus paralelo al canónico.
 *  Mazmorra-céntrico: mayoría de segmentos [SKIP:pendiente-runner] hasta que el runner
 *  aprenda salas; la cadena ad01..ad25 se valida offline (tests/espejo-routes.test.ts). */
export const ROUTES_AD_DIR = join(HERE, "routes-ad");
/** Rutas del ESPEJO-3 (LP de Lord Fenton, 33 episodios) — TERCER corpus. Igual que las de AD
 *  y las de LP1, el directorio está FUERA del índice (`.gitignore:30`): lleva la prosa TLK de
 *  EA verbatim en los `expect`. Ver `re/notes/fenton-curacion.md`. */
export const ROUTES_LF_DIR = join(HERE, "routes-lf");
/** CORPUS SINTÉTICO (`routes-sint/`) — el ÚNICO de los cuatro que VIAJA al repositorio
 *  público, porque es el único cuya prosa es NUESTRA (ver `routes-sint/README.md`). No mide
 *  conformidad de nada: existe para instanciar las propiedades del CURADOR —planificación de
 *  los `skip`, costuras, `recruit`/`dismiss`, punto fijo del derivador, colocación de
 *  `insertOps`— sobre rutas con la misma FORMA y sin una palabra de EA dentro. Los censos por
 *  identidad y los cardinales calibrados NO viven aquí: ésos son de los corpus reales. */
export const ROUTES_SINT_DIR = join(HERE, "routes-sint");
export const OUT_DIR =
  process.env.ESPEJO_OUT ?? join(HERE, "..", "..", "test-results", "espejo-tour");

// ---------------------------------------------------------------------------- tipos
export interface NavRun {
  m: "north" | "south" | "east" | "west";
  v: string;
  n: number;
}
export interface Op {
  nav?: NavRun[];
  gap?: number;
  key?: string;
  typed?: string;
  typedMantra?: string;
  type?: string;
  use?: string;
  wait?: number;
  todo?: string;
  todoKeep?: string;
  ocrLn?: number;
  src?: string;
  ynFrom?: string;
  /** FASE 3a — OP DE INTERIOR DE MAZMORRA (derive-dungeon-ops.mjs). Vocabulario CERRADO del
   *  pasillo 3D, RELATIVO al facing: advance/back/turnLeft/turnRight/turnAround/pass/ignite/
   *  get/klimb/search/look. `dir` = vía del Klimb (up|down) o dirección del prompt «Dir-»
   *  (ahead|here|left|right). `from` = el eco crudo del OCR (procedencia) y `sim` su
   *  similitud con el eco canónico del port. Ver runDungeonOp. */
  dng?: string;
  dir?: string;
  from?: string;
  sim?: number;
  /** ARNÉS de reclutamiento: une al companion `name` a la party (state-resync, análogo a
   *  teleport/clock). El JOIN real por Talk direccional es frágil bajo deriva de posición
   *  del replay; este op mantiene la FIDELIDAD DEL LEDGER (party 3→5) que gatea part03+.
   *  Insertado por overlay en el beat del join. Ver recruitCompanion. */
  recruit?: string;
  /** ARNÉS DE SWAP DE PARTY (gemelo de `recruit`): DEJA al companion `name` en la location
   *  actual llamando al CORE (`core/shops.innLeave`, calco de SHOPPES3 0x02AE = la tecla L
   *  del posadero). Necesario para los swaps del LP2 de AD (Julia→Mariah, Iolo fuera): con
   *  la party a 6, el `recruit` siguiente rebota con el «no room for me» del binario
   *  (`party.ts` PARTY_FULL, DS 0x9348+0x9372 — antes aquí ponía «Thy party is full.»,
   *  cadena fabricada que 58413c38 retiró) y el ledger de
   *  party del port divergiría del LP el RESTO de la cadena (todos los «Mariah, armed with
   *  Crossbow:» del OCR quedarían sin contraparte). Ver dismissCompanion. */
  dismiss?: string;
  /** ARNÉS DE SOLVENCIA: siembra el oro a `seedGold` ANTES del beat de compra. El ledger del
   *  espejo NO persigue igualar el BALANCE del LP (imposible: el loot de cofre es RNG); su
   *  función es cazar divergencias del PORT en la MECÁNICA de transacción (¿cobra el DELTA
   *  exacto?). Para que un buy caro DISPARE bajo un balance de replay que quedó bajo (loot no
   *  anclado), se siembra oro suficiente por arnés (patrón recruit). Ver seedGold. */
  seedGold?: number;
  /** ARNÉS DE NEGOCIADOR: siembra la INT del avatar (characters[0] = record+0x0E, el
   *  negociador de TODAS las tiendas — SHOPPES:0x02F4) a la del LP. El careo del guild
   *  (-954) adjudicó el precio: la fórmula del port ES el calco (SHOPPES:0x02D8-0x0318,
   *  base+⌊base·(100−3·INT)/100⌋) y reproduce EXACTO los precios del LP a INT=25
   *  (gems 318=255+63, inn 22=18+4, helm-sell 12=⌊75·15/100⌋+1) — el avatar del LP es
   *  una conversión U4 con 25/25/25, mientras la plantilla INIT de la cadena trae 15.
   *  Deriva de INSTRUMENTO, no sapo: este seed alinea el negociador para que los deltas
   *  anclados del LP disparen con su precio fiel. */
  seedInt?: number;
  /** ARNÉS DE FUERZA (gemelo de `seedInt`, pedido en `espejo-ledger-ad.md` §5): siembra la STR
   *  a la del avatar del LP para que el IMPORTE del peaje de troll sea comparable. La rutina
   *  del peaje vive en MAINOUT en `0x1b3e`, y el port la calca en
   *  `core/world/loops/hazards.ts`: el importe es 99 − 3·STR, así que sin sembrar la STR el
   *  port cobra un peaje distinto del que muestra el OCR y los 4 beats de peaje del corpus AD
   *  no son comparables. A QUIÉN siembra lo decide `strSeedTargets` (a todos los conscientes,
   *  no sólo al avatar) — y ahí está el porqué. */
  seedStr?: number;
  /** ARNÉS DE INVENTARIO: siembra `qty` unidades del equipo `id` (equipmentQuantities).
   *  Patrón seedGold: el LP llegó al beat de VENTA con ítems looteados por SU ruta RNG
   *  (3× Leather Helm en Iolo's Bows) que la cadena no tiene; se siembran para que la
   *  transacción de venta DISPARE y el ledger mida el DELTA (+36) con el precio fiel. */
  seedEquip?: { id: number; qty: number };
  /** DELTA DE ORO esperado de la transacción que este op dispara, con signo. Es el gemelo
   *  SUELTO de `anchor.expectDelta`: el ancla de NPC sólo sirve a las tiendas, y un PEAJE de
   *  puente o un TRIBUTO de guardia no tienen mercader al que anclarse — son disparos de
   *  terreno y de conversación. Con el delta aquí, entran al ledger por la misma maquinaria
   *  ya probada (`ledgerDeltaResult`) sin fabricar un ancla falsa. Si el op trae ADEMÁS un
   *  ancla con su propio `expectDelta`, manda éste (la forma más específica gana).
   *  `expectDelta: 0` NO es «no armar»: es la aserción «la transacción no movió el oro» —
   *  que es justo lo que hay que medir en los 4 peajes RECHAZADOS del corpus AD. */
  expectDelta?: number;
  /** DELTA de LLAVES esperado (con signo). Gemelos del oro y con su MISMA semántica: se lee
   *  el contador vivo en este punto del guion y se compara al cierre del segmento. Los dos
   *  contadores se LEÍAN ya (`probeState` los vuelca en el ledger de estado) y no se comparaba
   *  ninguno, en NINGUNO de los dos espejos: media transacción quedaba sin medir cada vez que
   *  el LP compraba en especie (llaves del herrero, gemas del guild). Un contador que el arnés
   *  no sepa leer sale ILEGIBLE, no a cero (ver `ledgerDeltaResult`). */
  expectKeysDelta?: number;
  /** DELTA de GEMAS esperado (con signo). Ver `expectKeysDelta`. */
  expectGemsDelta?: number;
  /** CITA del artefacto que JUSTIFICA los `expect*Delta` de este op: las `ocrLn` del `route.json`
   *  donde el LP acepta o RECHAZA la transacción, y el importe. Es la guarda del pre-registro
   *  del frente 3 («cada `expectDelta` lleva el `ocrLn` del bloque del LP que lo justifica»)
   *  hecha MECÁNICA en vez de convención: el esperado queda auditable contra el OCR sin correr
   *  nada, y quien lo cambie para que «pase» tiene que tocar la cita en el mismo diff.
   *
   *  ⚠ NO puede ser el `afterOcrLn` del overlay: ése es la COLOCACIÓN (curate lo estampa como
   *  `ocrLn`), y colocar el armado en la línea que lo justifica lo pondría DESPUÉS de la
   *  transacción — el oro se leería ya cobrado y todo delta saldría 0. Los dos datos son
   *  distintos y por eso viajan en campos distintos. Se vuelca en `resyncs` para que la cita
   *  viaje también en la evidencia de la corrida, no sólo en la ruta. */
  ledgerCite?: string;
  /** ★★ COSTURA INTERNA — ENTRADA. «A partir de aquí la party está DENTRO de la location `n`».
   *
   *  El `ctx`/costura de un segmento describe dónde EMPIEZA, no dónde ocurre cada beat. Cuando el
   *  LP entra a una location a MITAD de segmento, el segmentador no parte el episodio y el runner
   *  se quedaba fuera: `resyncEnterLocation` existe desde el relevo-3 pero **sólo lo llamaba la
   *  costura**. Medido en `ad09-g04` (`teclas-ad09-acta.md` §3): la party seguía en el mapa grande
   *  durante toda la visita al torreón, el ancla de NPC se abstiene por diseño ahí
   *  (`resyncToNpcAnchor`: `if (pos.location === 0) → skip`) y el delta −274 del herrero no podía
   *  armar. Censo propio de los dos corpus: **16 entradas a mitad de segmento**.
   *
   *  Rango 1..32 (towns/castles). Las mazmorras (33..40) NO: su costura es `setDungeonPos` y
   *  `goToLocation` dejaría un estado imposible — mismo motivo que documenta `SegEnter.dungeon`.
   *  Fuera de rango ABORTA; no se ignora en silencio.
   *
   *  ★ DIFERENCIA DELIBERADA CON LA COSTURA DE SEGMENTO: la costura intenta primero la (E) REAL
   *  (entrada natural, que además emite el eco «Enter <tipo>») y sólo cae a `goToLocation` si no
   *  entró. Aquí se va DIRECTO a `goToLocation`. Motivo: a mitad de guion no se puede suponer que
   *  la party esté sobre el tile-entrada, y una (E) fallida deja un prompt vivo que se traga las
   *  teclas siguientes — justo el modo de fallo contra el que existen `resolveBlockingYesNo` y el
   *  Escape ×2 del ancla. El coste es que el eco «Enter keep» del LP no tiene contraparte del port
   *  (el BANNER de la location sí: lo emite `loadSmallMap` → `locationNameBanner`). */
  enterLoc?: number;
  /** ★★ COSTURA INTERNA — SALIDA. «A partir de aquí la party está en el mapa grande, en esta CAPA».
   *  Gemela de `enterLoc`, reusa `resyncExitToOverworld` con la location viva como origen.
   *
   *  ★ LA CAPA ES UN STRING OBLIGATORIO, NO UN BOOLEANO, y no es cosmética: es exactamente el
   *  campo que este arnés ya se comió una vez. `resyncExitToOverworld` iba sin pasar su tercer
   *  argumento y el default `false` depositaba SIEMPRE en Britannia, también en las costuras del
   *  Underworld (E-2, ver el comentario dentro de esa función). Un `exitOverworld: true`
   *  reproduciría el agujero con otra caligrafía; el string obliga a declarar la capa en el corpus.
   *
   *  ⚠ Nace SIN consumidores, y está pre-registrado: el censo de los dos corpus da 5 salidas a
   *  mitad de segmento contra 16 entradas, y las otras 177 caen en la COLA del segmento, donde la
   *  costura del segmento SIGUIENTE (`enter.overworld`) ya las resuelve. `ad09-g04` ni siquiera la
   *  necesita al final: su propio guion conduce la puerta (`o`+`ArrowDown`) y el `y` del prompt. */
  exitOverworld?: "britannia" | "underworld";
  /** ANCLA DE POSICIÓN POR-INTERACCIÓN (Fase C, derive-anchors.mjs). Si está, el runner
   *  RESINCRONIZA la posición a la celda del ancla ANTES de ejecutar este op (teleport
   *  sancionado cero-rand). face = cara (L)ook→tile; npc = guardia/mercader (transacción).
   *  Ver anchors.ts + resyncToAnchor. */
  anchor?: Anchor;
}
export interface ExpectBlock {
  text: string;
  ocrLn: number;
  class: string; // auto | exact | numeric | rng | pending | known-gap
}
export interface SegEnter {
  loc?: number | null;
  banner?: string;
  overworld?: boolean;
  /** CAPA del mapa grande de una costura `overworld`: `true` = Underworld (floor 0xFF).
   *  Existe porque Britannia y el Underworld comparten `location` 0 y NO son derivables de la
   *  posición viva: cuando el resync de salida corre, la party está DENTRO de una location y su
   *  `floor` es el piso del edificio, no la capa. Tampoco lo dice `data.locationsX/Y`, que es
   *  una tabla de coordenadas sin capa. Así que la capa se DECLARA en la costura o no se sabe.
   *  Ausente = Britannia, que es lo que el runner hacía siempre (y lo que ninguna ruta ha
   *  necesitado cambiar todavía: las costuras del Underworld del corpus están sin marcar —
   *  ése es el trabajo de población, no de este arnés). */
  underworld?: boolean;
  shrine?: string;
  noEnterEcho?: boolean;
  carryover?: boolean;
  /** costura de MAZMORRA (loc 33..40): la resincroniza `setDungeonPos` (cero-rand), NO
   *  `goToLocation` — 33..40 no son small maps y goToLocation dejaría un estado imposible.
   *  Con `carryover` (FASE 3d, `post-combat`) la costura NO teletransporta: sólo COMPRUEBA
   *  que la party siga dentro de esa mazmorra (ver el bloque de costura en `runSegment`). */
  dungeon?: boolean;
  /** procedencia de la mazmorra cuando la ruta no la traía (`derive-dungeon-ops.mjs`):
   *  `propio` · `banner-precedente` · `única-mazmorra-de-la-ruta` · `visita-abierta-en-<seg>`. */
  dungeonFrom?: string;
}
export interface Segment {
  id: string;
  ctx: string;
  seam: string | null;
  enter?: SegEnter;
  ocr: { from: number; to: number };
  script: Op[];
  expect: ExpectBlock[];
  policy?: string; // auto | escape (combate)
  calib?: boolean;
  note?: string;
  carryover?: string;
  // "pendiente-runner": contexto que el runner AÚN no reproduce fielmente (sala de
  // mazmorra, klimb entre plantas, gema de mazmorra). Marcado en Part07+ (offline).
  // El guard de runtime que lo honra (saltar diff/combate sin desincronizar la cadena)
  // es trabajo de Fase B con el puerto en el bucle.
  skip?: string;
  /** FASE 3b: segmento de interior ABIERTO (pasillo con ops derivadas por
   *  derive-dungeon-ops.mjs). Su conformidad se reporta APARTE de la de smallmap (ruling del
   *  lead: no se mezclan las métricas hasta que 3c cierre). */
  openedBy?: string;
  /** razón por la que un `ctx:dungeon` sigue CERRADO (sala = RNG de combate sin calibrar). */
  skipReason?: string;
}
export interface RouteEntry {
  checkpoint?: string | null;
  boot?: string;
  normalizeAvatarName?: string;
  entryClock?: { hour: number; minute: number };
  note?: string;
}
export interface Route {
  part: string;
  source: string;
  entry: RouteEntry;
  segments: Segment[];
  ledger?: { note?: string; assert?: Record<string, number> };
}

export function loadRoute(part: string, routesDir: string = ROUTES_DIR): Route {
  return JSON.parse(readFileSync(join(routesDir, `${part}.route.json`), "utf8")) as Route;
}
export function listParts(routesDir: string = ROUTES_DIR): string[] {
  return readdirSync(routesDir)
    .filter((f) => f.endsWith(".route.json"))
    .map((f) => f.replace(".route.json", ""))
    .sort();
}

// ------------------------------------------------------------------- normalización
/** Colapso difuso compartido con el segmentador: alfabeto [a-z2-9] (l/I/1/]/[/|/!→i,
 *  0/O→o) sin separadores. Se aplica a AMBOS lados del diff. */
export function collapse(s: string): string {
  return s
    .toLowerCase()
    .replace(/[1l|\]\[!]/g, "i")
    .replace(/[0o]/g, "o")
    .replace(/[^a-z2-9]/g, "");
}

/** PERFIL DE OCR activo del diff (calibración por corpus, ver ocr-profile.ts). `ESPEJO_OCR`
 *  lo fija explícitamente; por defecto se deduce del corpus (`U5_ESPEJO_CORPUS=ad` → perfil
 *  `ad`, resto → `lp1` = identidad, que preserva los números validados de part01..06). */
export const ACTIVE_PROFILE: OcrProfile = profileFor(
  process.env.ESPEJO_OCR ??
    (process.env.U5_ESPEJO_CORPUS === "ad" ? "ad" : process.env.U5_ESPEJO_CORPUS === "lf" ? "lf" : "lp1"),
);

/**
 * NÚMEROS de un texto, para el ledger numérico (T-LEDGER-GLIFO,
 * `re/notes/deltas-42-adjudicacion.md`).
 *
 * Antes esto era `s.match(/\d+/g)` sobre el texto CRUDO, y era el único consumidor del
 * comparador que no pasaba por el modelo de glifos: las clases BASE declaran `0`≡`O` y
 * `1`≡`l|][!` (`ocr-profile.ts`), así que la `O` de `Open-` entraba al ledger como el número
 * cero. Medido en la ventana E-3: **42 de las 43** observaciones del canal eran ese fantasma.
 *
 * El criterio es **AISLAMIENTO DE TOKEN**: una tirada de dígitos cuenta como número sólo si
 * no toca una letra ASCII por ninguno de los dos lados. Derivado del corpus AD (25
 * episodios): de los 29.349 dígitos PEGADOS a letra los más frecuentes son `0pen`, `0pened`,
 * `VICT0RY`, `5outh`, `5hamlno` —confusiones de glifo, ni un contador— y de los 2.724
 * AISLADOS los más frecuentes son «1 food!», «2 torches!», «1 key!», «13 gold!» —contadores
 * de verdad—. `2H Axe` cae del lado pegado, que es lo correcto: el `2` es el arma, no una
 * cuenta.
 *
 * ⚠ POR QUÉ NO SE PLIEGA. El fix aparentemente obvio —derivar los dígitos de la
 * representación PLEGADA— mata 40 de los 42 fantasmas y es una TRAMPA: el plegado entra
 * DENTRO del número, así que «150»→«5», «63»→«3» (AD pliega `6`→`o`) y «1»→nada. Habría
 * cambiado 42 fantasmas de glifo por un fantasma ARITMÉTICO en cada contador real. El test
 * «TRAMPA DEL PLEGADO» de `espejo-ledger.test.ts` es el candado.
 *
 * Se aplica a los DOS lados del diff (OCR y transcript), como todo lo demás del comparador.
 */
export const countedDigits = (s: string): string[] =>
  Array.from(s.matchAll(/\d+/g))
    .filter((m) => !/[A-Za-z]$/.test(s.slice(0, m.index)) && !/^[A-Za-z]/.test(s.slice(m.index + m[0].length)))
    .map((m) => m[0]);

/** Patrón regex del bloque esperado sobre el alfabeto colapsado, con los números en
 *  wildcard `[oi2-9]{1,7}` (0→o / 1→i ya colapsados). Los TROZOS LITERALES van en grupos de
 *  captura —que no cambian lo que casa— para que `literalSpan` pueda acotar la ventana
 *  (T-LEDGER-VENTANA); el flag `d` es el que expone sus offsets. */
function blockPattern(text: string, profile: OcrProfile = LP1): RegExp {
  const parts = text.split(/\d+/).map((p) => collapseWith(p, profile).replace(/[.*+?^${}()|[\]\\]/g, ""));
  return new RegExp(parts.map((p) => `(${p})`).join("[oi2-9]{1,7}"), "d");
}

/** Igual que `blockPattern`, expuesto para el banco de tests del canal numérico. */
export const blockPatternFor = blockPattern;

/**
 * Span de los TROZOS LITERALES de un match de `blockPattern` — del principio del primer
 * literal no vacío al final del último (T-LEDGER-VENTANA).
 *
 * POR QUÉ. La ventana de líneas del port que alimenta `got` salía del span COMPLETO del
 * match, y el comodín `[oi2-9]{1,7}` acepta `o`/`i`: cuando el bloque OCR empieza por dígito
 * el patrón empieza por comodín, que se come la cola de la línea de ARRIBA («Nothing to
 * open!» → «…openi») y arrastra la ventana una línea atrás. Medido: **16 de 42** ventanas de
 * la ventana E-3 abarcaban más de una línea teniendo la que casaba una sola. Con el canal
 * fabricando fantasmas era inocuo; con números reales el `got` se lleva dígitos de una línea
 * ajena y puede firmar un ACUERDO donde había divergencia.
 *
 * `null` cuando el bloque no tiene literal ninguno (texto todo dígitos): no hay ancla que
 * usar y el llamador cae al span completo, declarado.
 */
export function literalSpan(m: RegExpExecArray): { from: number; to: number } | null {
  const spans = (m.indices ?? []).slice(1).filter((s, i): s is [number, number] => !!s && m[i + 1] !== "");
  if (!spans.length) return null;
  return { from: spans[0]![0], to: spans[spans.length - 1]![1] - 1 };
}

/** Similitud por bigramas (Dice) entre dos strings colapsados. */
function dice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const grams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ga = grams(a);
  const gb = grams(b);
  let inter = 0;
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0);
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

/**
 * MEJOR VENTANA POR BIGRAMAS (ventana `comparador-bandas`, ficha F4-f) — lo que el barrido fuzzy
 * dice que calcula, calculado de verdad, y **más barato** que la rejilla que sustituye.
 *
 * 🔴 EL DEFECTO QUE ARREGLA. El barrido histórico muestrea `T` con `step = max(2, ⌊w/6⌋)` desde
 * `i = 0`, así que la FASE de la rejilla respecto al sitio donde vive el bloque depende de
 * cuántos caracteres haya ANTES en el transcript. Medido sobre un bloque de 38 caracteres,
 * moviendo SÓLO el prefijo de `T` y sin tocar un carácter del material:
 *
 *     prefijo 0 → 0.8947   prefijo 2 → 0.9474   prefijo 5 → 0.8947      (exacto: 0.9474 siempre)
 *
 * Con el umbral en 0.84, todo bloque cuya similitud real caiga en esa banda de oscilación entra
 * y sale de `fuzzy` **según dónde estuviera plantado** — el `fuzzy→divergent` de F4-f.
 *
 * CÓMO: multiconjunto de bigramas de la ventana, deslizado carácter a carácter (se añade el
 * bigrama que entra y se quita el que sale, y el tamaño de la intersección se mantiene
 * incremental). `O(|T|)` por bloque, frente al `O(|T|·w/step)` del muestreo: exacto Y más rápido.
 * Devuelve `{ best, at }` con `at` = índice de inicio de la mejor ventana (para el snippet).
 * PURO.
 */
export function bestDiceWindow(cb: string, T: string): { best: number; at: number } {
  const w = Math.max(cb.length, 8);
  const minLen = Math.floor(w * 0.7); // misma condición de barrido que la rejilla histórica
  if (cb.length < 2 || T.length < 2 || minLen > T.length) return { best: 0, at: 0 };
  const need = new Map<string, number>();
  for (let i = 0; i < cb.length - 1; i++) {
    const g = cb.slice(i, i + 2);
    need.set(g, (need.get(g) ?? 0) + 1);
  }
  const have = new Map<string, number>();
  let inter = 0;
  // `add`/`remove` mantienen `inter` = Σ_g min(need[g], have[g]) sin recontar el mapa.
  const add = (g: string): void => {
    const h = (have.get(g) ?? 0) + 1;
    have.set(g, h);
    if (h <= (need.get(g) ?? 0)) inter++;
  };
  const remove = (g: string): void => {
    const h = have.get(g) ?? 0;
    if (h <= (need.get(g) ?? 0)) inter--;
    have.set(g, h - 1);
  };
  let best = 0;
  let at = 0;
  for (let i = 0; i + minLen <= T.length; i++) {
    if (i === 0) {
      for (let k = 0; k + 1 < Math.min(w, T.length); k++) add(T.slice(k, k + 2));
    } else {
      remove(T.slice(i - 1, i + 1));
      const end = i + w; // el bigrama que ENTRA por la derecha, si la ventana aún cabe entera
      if (end <= T.length) add(T.slice(end - 2, end));
    }
    const bLen = Math.min(w, T.length - i);
    const s = (2 * inter) / (cb.length - 1 + (bLen - 1));
    if (s > best) {
      best = s;
      at = i;
    }
  }
  return { best, at };
}

// -------------------------------------------------- política de clases (runtime)
/** RNG del mundo: tiradas de combate, spam de banner de combate, loot de cofres RNG,
 *  auras de Shadowlord, aparición de camp, pools de saludo… Se EXCLUYEN de la
 *  conformidad (no-comparables) pero se buscan y reportan informativamente. */
const RNG_AUTO: RegExp[] = [
  /\b(missed|killed|ki\]led|kiiied|wounded|grazed|critical|criticai|escapes)\b/i,
  /armed with|attack-aim|set active plr/i,
  /\b\w+ hit!/i,
  /\*\*\*|conflict|victory|battle is lost|battie/i,
  /^(orcs|trolls|tro\]ls|giant rats|skeletons|insects|sea horses|squids|pirates|sea serpents|sharks|attacked!)/i,
  /an air of (hatred|cowardice|falsehood)/i,
  /apparition|strangely familiar|strangeiy/i,
  /is poisoned|poisoned!/i,
  /slow progress|very s\[?low/i,
  /rough seas/i,
  // CONTENIDO DE COFRE = RNG del port (difiere del LP). Tras cofre-fiel el flujo es
  // ITEM-A-ITEM (no el agregado del display viejo): se captan «Found:» en cualquier posición
  // (no sólo inicio: el eco «Open-North Found:…» lleva prefijo) + los ítems sueltos que emite
  // el cofre item-by-item, para que no aparezcan como divergentes falsos por la granularidad.
  /\bfound:/i,
  /a sack of gold|small shield|throwing axe|silver sword|a ring of|an? (he[l\]]m|amulet|shield)!/i,
  /^(some |a |an |\d+ )?(food|torch|torches|keys?|gems?|gold)!?$/i, // ítem suelto del cofre-fiel
  /says \w+\.$/i, // atribución de pool de tendero (la variante 1-de-4 difiere)
];

/** Huecos CONOCIDOS del port con ticket abierto (fase 1/2 del espejo). NO cuentan como
 *  divergencia; si algún día MATCHEAN, el reporte los aflora como «gap-cerrado» (el fix
 *  aterrizó). Mantener alineado con re/notes/espejo-part08.md + espejo-fase2.md. */
const KNOWN_GAPS: Array<{ re: RegExp; ticket: string }> = [
  { re: /thou spieth|sneaks/i, ticket: "C5 preámbulo peaje" },
  { re: /art thou here to pick up or leave|we are a little full|rate for a comfortable room|have a pleasan/i, ticket: "F2-T2 posada rest/leave" },
  { re: /what'\[?ll? it be|shall i bring thee more|we buy our dried beef|how many woulds|anything else for thee/i, ticket: "F2-T10 taberna menú real" },
  { re: /^enter the shrine of|^>?enter the$/i, ticket: "F2-T6 eco Enter-shrine" },
  { re: /upon what virtu|mantra:|thine thoughts/i, ticket: "C13 prompts por overlay (canal)" },
  { re: /demands? a \d+ gp tribute|thou art under arrest|come quietly|strikes thee unconscious/i, ticket: "F2-T4 tributo/arresto" },
  { re: /we sell ocean-going|which would ye like to see|skiffs allow thee|stout-hearted vessels/i, ticket: "F2-T3 shipwright pitch" },
];

const PROMPT_OVERLAY: RegExp[] = [
  // prompts que el port muestra por OVERLAY, no por consola (caveat de canal nº2)
  /-,\+,\*,\* to move/i,
  /type m to mix/i,
];

/** De-corrupción OCR ligera para PROBAR patrones (no para casar): 0→o, [/]→l, 1→l.
 *  Los patrones RNG/presentación se probaban sobre el crudo y fugaban por corrupción
 *  ("VICT0RY!"/"0rc ki[led!" caían como divergentes). Probados sobre esto, casan. */
const ocrFriendly = (s: string): string => s.replace(/0/g, "o").replace(/[[\]]/g, "l").replace(/1/g, "l");

/**
 * FIRMA DE SALA (combate de sala de mazmorra) — bloques que se RETIRAN del denominador de
 * INTERIORES, declarados y contados (`sala-diferida`). No es un barrido de conveniencia:
 * el ruling separa las dos mediciones porque el RNG de combate del port NO está calibrado
 * contra el OCR de AD (es el trabajo de 3c) y mezclarlo hundiría el número de interior por
 * INSTRUMENTO — exactamente el error que hizo ilegible la conformidad del estreno. Los ecos de
 * combate de sala son inconfundibles: banner de entrada, aim del ataque, resultados de tirada
 * y el indicador de jugador activo del bucle de combate.
 *
 * ⚠ SE APLICA EN LA ÚLTIMA POSICIÓN DEL DIFF (desde 3d) — ver el bloque de `diffSegment` para
 * el porqué. Hasta 3c se aplicaba ANTES de casar y podía retirar matches REALES.
 */
const SALA_SIGNS: RegExp[] = [
  /Ent[e3]r[il1]ng\s+room/i,
  /Attack-A[il1]m/i,
  /Att[uv]ck-A[il1]m/i,
  /\bk[il1]lled!/i,
  /\bwounded!/i,
  /\bm[il1]ssed!/i,
  /\bh[il1]t!/i,
  /barely|l[il1]ghtly|heav[il1]ly/i,
  /Set\s+a[co]t[il1]ve\s+plr/i,
  /VICT[O0]RY/i,
  /armed\s+w[il1]th/i,
];

/** Canal de PRESENTACIÓN: texto SÓLO-PANTALLA que el log LÓGICO del port NO emite —
 *  Z-stats/hoja de personaje (overlay "Select:" + Player/Status) e indicador de jugador
 *  activo PURO ("Player: Min", "Player: None!", indicadores repetidos). Categoría PROPIA
 *  [presentacion]: ni comparable ni divergente, CONTADA aparte.
 *  ESTRECHADO tras el SPOT-CHECK vs port (ruling del lead): el port SÍ logea comando+
 *  resultado ("Look-East"/"Thou dost see...") → los ecos de input parciales NO son
 *  presentación (van a ocr-partial, ver abajo); y "Player: <contenido>" (p.ej. un scroll)
 *  NO es indicador puro → el patrón exige que la línea sean SÓLO tokens de indicador. */
const PRESENTATION_ONLY: RegExp[] = [
  /z-?stats/i,
  /^(player:\s*(min|shamino|iolo|jaana|julia|gwenno|none)!?\s*)+$/i,
];

/** Forma de ECO DE COMANDO PARCIAL por captura OCR fallida ("Look-2"/"Search-s"/"Open-F"):
 *  comando + cola corta ilegible (≤2 chars) y FIN. NO casa comandos completos con resultado
 *  ("Look-East Thou dost see…", cola larga). Captura la PALABRA del comando (grupo 1) para
 *  buscar su eco realmente logueado por el port (guard anti-alfombra: sólo es ocr-partial si
 *  el port emitió ese comando en el MISMO segmento; si no, queda DIVERGENTE). */
const OCR_PARTIAL_SHAPE = /^(look|search|get|open|push|jimmy|klimb|fire|cast|yell|talk|view)[-.]?\s*(?:[a-z0-9]{1,2})?\s*$/i;

/** Artefactos SÓLO-PANTALLA intercalados en un bloque OCR pero AUSENTES del log del port:
 *  el eco del comando de cabecera (">Look-East"/"Search-North"…) y el indicador de jugador
 *  activo ("Player: Min"). Se retiran ANTES de casar para comparar el RESULTADO (lo que el
 *  port sí registra), no el input del jugador. Es la palanca grande (19% cmd-echo). */
const stripScreenArtifacts = (text: string): string =>
  text
    .replace(/^\s*>?\s*(look|search|get|open|push|jimmy|klimb|fire|cast|yell|talk|view)[- ]?(north|south|east|west|up|down)?[!:.]*/i, "")
    // indicador de jugador activo al INICIO (con o sin nombre legible): "Player: Min ...",
    // "Player: A scroll..." → deja el RESULTADO que el port sí logea
    .replace(/^\s*player:\s*(?:min|shamino|iolo|jaana|julia|gwenno|none)?!?\s*/i, "")
    .replace(/\bplayer:\s*(min|shamino|iolo|jaana|julia|gwenno|none)\b!?/gi, " ");

/** Flujos del port SIN CALIBRAR en el corpus AD (clase `pending` en runtime): el LP2 los usó
 *  y el runner aún no los conduce, así que su ausencia del transcript NO es divergencia del
 *  port sino hueco de arnés. Cada entrada lleva el flujo para que el ratchet los vaya cerrando.
 *  (Firma medida en el estreno AD: `Quit: Save game?` 87×, prompts de `Hole up & camp` 61×,
 *  `View a gem!` 71× — el runner no teclea Quit ni el menú de camp ni la gema.) */
const AD_PENDING: Array<{ re: RegExp; flow: string; notWhenInterior?: boolean }> = [
  { re: /quit:?\s*save game|save game\?/i, flow: "Quit-save (el runner no teclea Q)" },
  { re: /hole up|for how many hours|wilt thou set watch|who will stand/i, flow: "Hole up & camp (menú de horas/guardia)" },
  // La GEMA sigue pending por RULING (es 3e, no 3b): declarada y contada, nunca silenciada.
  { re: /view a gem|gem shows|no gems/i, flow: "(V)iew gema de mazmorra (diferida a 3e por ruling)" },
  // Ignite YA se conduce en los segmentos de interior ABIERTOS (op `{dng:"ignite"}` derivada por
  // derive-dungeon-ops): ahí NO puede seguir siendo `pending`, o el instrumento se auto-absolvería
  // de un beat que ahora sí ejecuta. Fuera de los interiores abiertos sigue sin cablear.
  { re: /^ignite torch!?$/i, flow: "(I)gnite torch (op no cableado fuera de interiores)", notWhenInterior: true },
];

export type Verdict =
  | "match"
  | "covered"
  | "fuzzy"
  | "divergent"
  | "rng"
  | "known-gap"
  | "gap-cerrado"
  | "pending"
  | "overlay-channel"
  | "presentacion"
  | "ocr-partial"
  | "ocr-ghost"
  | "ocr-garbage"
  /** bloque de COMBATE DE SALA dentro de un interior abierto: diferido a 3c (RNG de combate
   *  sin calibrar para AD) → no-comparable DECLARADO y contado aparte. */
  | "sala-diferida"
  /** FASE 3c — RNG de combate reconocido por los patrones CALIBRADOS del corpus
   *  (`profile.combatRng` / `isRosterTail`). Misma semántica que `rng` (no-comparable), con
   *  verdicto PROPIO para que el aporte de la recalibración sea contable y reversible. */
  | "combat-rng";

// ---------------------------------------------------------------- ventana del snippet
// El snippet de un bloque DIVERGENTE es la ventana del transcript del port alrededor de su
// línea más parecida. Es material de LECTURA, pero también el sustrato sobre el que se han
// medido familias enteras (la tabla «BLOQUE» de `corrida-ad-resultado.md` §4.4), y ahí la
// ventana vieja —3 líneas tras la mejor, corte a 160 chars— sesgaba A LA BAJA las familias de
// DESENLACE LARGO: en un `Search` el rechazo («nothing of note.») llega varias líneas después
// del eco, así que se quedaba fuera y el bloque parecía no rechazar cuando sí rechazaba.
// Medido: la ventana moría por LÍNEAS, no por caracteres (47 de los 160 chars usados).
// Sigue ACOTADA a propósito — un snippet sin tope volcaría el transcript en cada bloque.
export const SNIPPET_LINES_BEFORE = 1;
export const SNIPPET_LINES_AFTER = 8;
export const SNIPPET_MAX_CHARS = 480;

export interface BlockResult {
  ocrLn: number;
  class: string;
  verdict: Verdict;
  ticket?: string;
  sim?: number;
  snippet?: string;
  numbers?: { expected: string[]; got: string[] };
}
export interface SegmentReport {
  id: string;
  ctx: string;
  seam: string | null;
  comparable: number;
  matched: number;
  conformity: number | null;
  presentacion: number; // bloques de canal sólo-pantalla (no-comparable, contado aparte)
  ocrPartial: number; // ecos de comando parcial por captura OCR fallida CON eco port-logueado
  /** bloques que sólo eran la SEGUNDA PASADA FANTASMA del OCR de AD (re-lectura de la misma
   *  línea con espacios→`"`): al retirarla no queda contenido → no-comparable. */
  ocrGhost: number;
  /** bloques de BASURA de área gráfica (OCR de sprite/marco, sin texto detrás) → no-comparable. */
  ocrGarbage: number;
  /** bloques casados por COBERTURA-TILING (perfil AD): el contenido está en el transcript en
   *  trozos largos, pero no contiguo (truncamientos/redibujados del OCR). Cuentan como
   *  matcheados y se reportan APARTE para que el efecto de la calibración sea auditable. */
  covered: number;
  // ---- FASE 3c: recalibración de los patrones de COMBATE para el corpus (contada por MECANISMO
  // para que el antes/después sea auditable y cada palanca se pueda aceptar o revertir sola)
  /** bloques declasificados por los patrones de combate calibrados del corpus (`combatRng`). */
  combatRng: number;
  /** de ésos, los que eran la COLA DE ARMAS huérfana del banner de roster (`isRosterTail`). */
  combatRosterTail: number;
  /** de ésos, los que llevaban clase CURADA `exact` (la línea de corte `VICTORY!`/`BATTLE IS
   *  LOST!` que pone `segment.mjs`) y sólo se declasifican con
   *  `combatOverridesCuratedClass`. Es la palanca más discutible: va contada SOLA. */
  combatCurated: number;
  /** VENTANA `comparador-bandas` — BILLETES DE LOTERÍA retirados del denominador ANTES de casar,
   *  gane o pierda su tirada. Contados SOLOS para que la exclusión sea auditable y reversible. */
  /** desenlaces de combate de clase CURADA (ficha F-5): su casado es el RNG de encuentros. */
  combatOutcomeRng: number;
  /** bloques de SALUDO DE TIENDA (pool `rand_range(0,3)` por visita, prior 1/4 de casar). */
  shopGreetingRng: number;
  /** DELTA de oro de una transacción del segmento (comparable del ledger): esperado vs
   *  obtenido. El balance corrido es NO-comparable (loot RNG). Sólo presente si algún op armó
   *  el oro (ancla con expectDelta, u op.expectDelta suelto). */
  ledgerDelta?: LedgerDelta;
  /** DELTA de LLAVES de la transacción, en canal propio (`expectKeysDelta`). Sólo presente si
   *  algún op lo armó: un segmento que sólo mueve oro sigue reportando exactamente lo mismo
   *  que antes de que este canal existiera. */
  ledgerKeysDelta?: LedgerDelta;
  /** DELTA de GEMAS de la transacción, en canal propio (`expectGemsDelta`). Ver arriba. */
  ledgerGemsDelta?: LedgerDelta;
  resyncs: string[];
  combatRounds: number;
  todosSkipped: number;
  /** `typed` del LP DESCARTADOS por no haber sumidero de entrada vivo (ver inputSinkOpen):
   *  instrumento, NO fidelidad — antes se pulverizaban como comandos y atascaban el replay. */
  typedSkipped: number;
  // ---- Fase C: resync de posición por-interacción (anclas de cara)
  anchorsResolved: number; // anclas resueltas contra el grid vivo (con o sin salto)
  anchorsJumped: number; // de las resueltas, cuántas exigieron teleport (deriva>0)
  anchorsMissed: number; // feature del LP AUSENTE en el mapa vivo → candidato a divergencia
  anchorsAmbiguous: number; // demasiadas candidatas → resync declinado (reportado)
  drifts: number[]; // distancia Manhattan de cada salto de resync (histograma de deriva)
  // ---- FASE 3 (interior de mazmorra): métrica APARTE hasta que 3c cierre (ruling del lead)
  /** el segmento es un INTERIOR ABIERTO (`openedBy`) → su conformidad va a la métrica de
   *  interiores, NO a la de smallmap. */
  interior?: boolean;
  /** FASE que abrió el interior (`3b` pasillo puro / `3c` mixto) — viaja desde `openedBy` de la
   *  ruta para que la descomposición «material nuevo abierto» sea automática, no un recuento. */
  interiorPhase?: string;
  /** bloques de combate de SALA retirados del denominador de interior (declarado). */
  salaDeferred: number;
  /** ops de interior CONDUCIDAS por teclas reales del pasillo (advance/turn/klimb/search/…). */
  dngOps: number;
  /** costuras de CONGELADO del errante realmente aplicadas (instrumento declarado, ruling A). */
  wandererFrozen: number;
  /** rastreo de PLANTA (el ancla primaria del modelo de interior): casos en que la planta viva
   *  casó la esperada por conteo de Klimb, resyncs de planta y salidas de la mazmorra. */
  floorMatches: number;
  floorResyncs: number;
  /** el pasillo dejó de conducirse porque el eco del LP falsificó la planta supuesta por la
   *  costura (ver PLANTA-DESCONOCIDA): coste DECLARADO de 3b, no silencio. */
  floorUnknown: number;
  /** ops 2D/de SALA que un interior abierto NO condujo (su material está diferido a 3c). */
  salaOpsSkipped: number;
  blocks: BlockResult[];
  // ── FASE 3e-a (filtro de localización). `filterFed` es la PRUEBA DE EJECUCIÓN del cableado.
  // ⚠ Lección: la 1ª versión de este contador declaró el tipo en InteriorMetric y NO lo añadió al
  // objeto del reporte, así que salía 0 aunque el filtro SÍ corriera — un falso NEGATIVO que me
  // hizo creer que el cableado no ejecutaba. Un contador de ejecución hay que verificarlo end-to-end.
  /** observaciones REALMENTE alimentadas al filtro en esta visita (acumulado) */
  filterFed?: number;
  /** candidatas vivas tras alimentar este segmento */
  filterCandidates?: number;
  /** 1 si el resync de celda se APLICÓ en este segmento */
  filterApplied?: number;
  /** veredicto: resolved | ambiguous | miss | no-budget | "" (filtro apagado) */
  filterStatus?: string;
}
export interface PartReport {
  part: string;
  when: string;
  /** sha del árbol que produjo el report; `null` si git no pudo decirlo. Lo sella `writeReport`
   *  (ver `procedencia`), no el constructor: así ningún llamador puede olvidarlo. */
  sha?: string | null;
  /** ¿el árbol tenía cambios sin commitear? `true` ⇒ el sha NO identifica lo que se midió. */
  dirty?: boolean | null;
  conformity: number | null;
  comparable: number;
  matched: number;
  divergent: number;
  presentacion: number;
  ocrPartial: number;
  /** ---- CALIBRACIÓN POR CORPUS (perfil de OCR, ver ocr-profile.ts) ---- */
  ocrProfile: string;
  ocrGhost: number; // bloques que sólo eran la segunda pasada fantasma del OCR
  ocrGarbage: number; // bloques de basura de área gráfica
  covered: number; // matcheados por cobertura-tiling (de los `matched`)
  /** ---- VENTANA `comparador-bandas`: LO EXCLUIDO POR SER UNA TIRADA DEL PORT, contado ----
   *  Son NO-COMPARABLES retirados ANTES de casar (gane o pierda la tirada), así que no salen ni
   *  en `matched` ni en `comparable`. Van en canal propio para que la exclusión sea auditable
   *  por parte y por clase, y reversible palanca a palanca. */
  combatOutcomeRng: number; // desenlaces de combate de clase curada (F-5)
  shopGreetingRng: number; // saludos de tienda del pool rand(0,3)
  gapsClosed: number;
  // ---- Fase C: resync de posición por-interacción (agregado de parte)
  anchorsResolved: number;
  anchorsJumped: number;
  anchorsMissed: number;
  anchorsAmbiguous: number;
  driftHistogram: Record<DriftBucket, number>;
  /** ---- FASE 3: MÉTRICA DE INTERIORES, APARTE de la de smallmap (ruling del lead: no se
   *  fusionan hasta que 3c cierre — mezclarlas antes de recalibrar el RNG de combate hunde el
   *  número global por instrumento y hace ilegible el progreso). ---- */
  interior: InteriorMetric;
  ledger: Record<string, unknown>;
  segments: SegmentReport[];
  /** ---- SALUD DE LA PARTY, EN EL SELLO (adjudicación `espejo-cadena-party-muerta`, 22-08) ----
   *
   * 🔴 EXISTEN PORQUE `partySize` SOLO NO PUEDE VER LA MUERTE, y eso ya firmó una cadena rota.
   * El acta de #45 certificó la salud de part07-18 con «party = 6 de punta a punta»: una frase
   * CIERTA sobre unos checkpoints en los que los seis miembros estaban a `status='D'` y 0 HP,
   * porque `partySize` cuenta MIEMBROS y un muerto sigue en el grupo. `partyAlive` ya lo
   * calculaba `probeState` dos líneas más abajo (busca `p.status !== "D"`) y no llegaba al
   * sello. Van los DOS y nunca uno en lugar del otro: el par «4/6» dice lo que ninguno dice
   * solo. `null` si la sonda no los trajo — nunca 0, que se leería como «todos muertos». */
  partyAlive: number | null;
  partySize: number | null;
  /** ---- EL DENOMINADOR REAL ----
   * Bloques `expect` que el corpus de esta parte DECLARA, frente a los `comparable` que esta
   * pasada llegó a medir. Sin él, `conformity` se lee como «qué tan fiel es el port» cuando es
   * «qué tan fiel es en el trozo que se pudo conducir»: part23 y part24 declaran 578 y 351
   * bloques y comparan CERO, y su reporte salía indistinguible de una parte medida. */
  expectTotal: number;
  /** ---- RE-SIEMBRA DECLARADA (carril `espejo-resiembra`) ----
   *
   * 🔴 VA SIEMPRE, TAMBIÉN CON LA RE-SIEMBRA APAGADA. Es el §(b) del reparo de la
   * adjudicación `espejo-cadena-party-muerta` §9: una conformidad medida tras un
   * re-anclaje NO es comparable con una medida en cadena, y mezclarlas sin marcarlas
   * repetiría la clase de error del §4 (un indicador cierto que no puede ver lo que
   * importa). Con el bloque presente en los DOS brazos, el censo que compare reportes no
   * depende de que alguien se acuerde de anotar con qué env corrió cada uno.
   *
   * `null` sólo si el reporte lo escribió una versión anterior a este carril. */
  reseed?: import("./resiembra").ResiembraReport | null;
  /** ---- TRAYECTORIA DE VIVOS por segmento ----
   * `partyAlive` de fin de parte no distingue «llegó muerta» de «se murió aquí», y esa
   * diferencia es la que adjudica si re-anclar el punto de partida sirve de algo. */
  partyAliveBySegment?: Array<{ seg: string; alive: number | null; size: number | null }>;
  /** ---- CONDUCCIÓN DEL VEHÍCULO (carril `espejo-vuelo`) ----
   * SIEMPRE presente, también con el modo apagado: un reporte sin este bloque sería
   * indistinguible de uno anterior a este carril (misma razón que `reseed`). Cuando
   * `aplicados > 0` la parte NO es comparable con una medida en cadena — el aviso va
   * dentro del propio bloque. */
  vehiculo?: import("./vehiculo").VehiculoReport | null;
}

/** Conformidad de INTERIOR (segmentos `openedBy`) + instrumento declarado de la Fase 3. */
export interface InteriorMetric {
  segments: number;
  comparable: number;
  matched: number;
  conformity: number | null;
  divergent: number;
  /** bloques de combate de SALA retirados del denominador (diferidos a 3c) */
  salaDeferred: number;
  dngOps: number;
  /** costuras de congelado del errante aplicadas (COSTURA DECLARADA, no silencio) */
  wandererFrozen: number;
  floorMatches: number;
  floorResyncs: number;
  /** segmentos cuyo pasillo se cortó por planta-desconocida (coste declarado de 3b) */
  floorUnknown: number;
  /** ops 2D/de sala no conducidas en interiores abiertos (material diferido a 3c) */
  salaOpsSkipped: number;
  // ---- FASE 3c: LA DESCOMPOSICIÓN. Las dos causas de que el número del interior se mueva son
  // separables y van CONTADAS APARTE, o el progreso no es auditable:
  //   (a) MATERIAL NUEVO ABIERTO — segmentos mixtos que 3b cerraba por la sala que los
  //       acompaña (`openedBy:"3c"`): suben comparables Y matcheados;
  //   (b) PATRONES RETIRADOS — bloques de combate que el port sí emite y el OCR de Diener
  //       escribe distinto: bajan el denominador SIN tocar el numerador.
  /** interiores por FASE que los abrió: `{"3b":N,"3c":M}` */
  byPhase: Record<string, { segments: number; comparable: number; matched: number }>;
  /** (b) bloques retirados por los patrones de combate calibrados de 3c */
  combatRng: number;
  /** de ésos, cola de armas huérfana del banner de roster */
  combatRosterTail: number;
  /** de ésos, los de clase curada `exact` (la palanca más discutible, contada sola) */
  combatCurated: number;
}

/** Agrega la métrica de INTERIOR de los segmentos abiertos. PURO (testeable sin puerto). */
export function aggregateInterior(segs: SegmentReport[]): InteriorMetric {
  const inner = segs.filter((s) => s.interior);
  const comparable = inner.reduce((a, s) => a + s.comparable, 0);
  const matched = inner.reduce((a, s) => a + s.matched, 0);
  return {
    segments: inner.length,
    comparable,
    matched,
    conformity: comparable ? Number((matched / comparable).toFixed(3)) : null,
    divergent: inner.reduce((a, s) => a + s.blocks.filter((b) => b.verdict === "divergent").length, 0),
    salaDeferred: inner.reduce((a, s) => a + s.salaDeferred, 0),
    dngOps: inner.reduce((a, s) => a + s.dngOps, 0),
    wandererFrozen: inner.reduce((a, s) => a + s.wandererFrozen, 0),
    floorMatches: inner.reduce((a, s) => a + s.floorMatches, 0),
    floorResyncs: inner.reduce((a, s) => a + s.floorResyncs, 0),
    floorUnknown: inner.reduce((a, s) => a + s.floorUnknown, 0),
    salaOpsSkipped: inner.reduce((a, s) => a + s.salaOpsSkipped, 0),
    byPhase: inner.reduce<InteriorMetric["byPhase"]>((acc, s) => {
      const k = s.interiorPhase ?? "?";
      const e = (acc[k] ??= { segments: 0, comparable: 0, matched: 0 });
      e.segments++;
      e.comparable += s.comparable;
      e.matched += s.matched;
      return acc;
    }, {}),
    combatRng: inner.reduce((a, s) => a + s.combatRng, 0),
    combatRosterTail: inner.reduce((a, s) => a + s.combatRosterTail, 0),
    combatCurated: inner.reduce((a, s) => a + s.combatCurated, 0),
  };
}

/** Agrega los desenlaces de ancla de todos los segmentos de una parte + histograma de deriva.
 *  PURO (sin Playwright): testeable y reutilizable por la spec. */
export function aggregateAnchors(segs: SegmentReport[]): {
  anchorsResolved: number;
  anchorsJumped: number;
  anchorsMissed: number;
  anchorsAmbiguous: number;
  driftHistogram: Record<DriftBucket, number>;
} {
  return {
    anchorsResolved: segs.reduce((a, s) => a + s.anchorsResolved, 0),
    anchorsJumped: segs.reduce((a, s) => a + s.anchorsJumped, 0),
    anchorsMissed: segs.reduce((a, s) => a + s.anchorsMissed, 0),
    anchorsAmbiguous: segs.reduce((a, s) => a + s.anchorsAmbiguous, 0),
    driftHistogram: driftHistogram(segs.flatMap((s) => s.drifts)),
  };
}

// ------------------------------------------------------------------- diff motor
export function diffSegment(
  seg: Segment,
  portLines: string[],
  profile: OcrProfile = ACTIVE_PROFILE,
): Omit<
  SegmentReport,
  "resyncs" | "combatRounds" | "todosSkipped" | "typedSkipped" | "anchorsResolved" | "anchorsJumped" | "anchorsMissed" | "anchorsAmbiguous" | "drifts"
> {
  // transcript colapsado + mapa de índices → línea (para recuperar números crudos)
  let T = "";
  const lineAt: number[] = [];
  portLines.forEach((raw, li) => {
    const c = collapseWith(raw.replace(/^[>›]\s*/, ""), profile);
    for (let k = 0; k < c.length; k++) lineAt.push(li);
    T += c;
  });

  // SALUDOS DE TIENDA de este segmento (palanca `shopGreetingLottery`): las líneas de las que
  // `derive-anchors` sacó un ancla `shop:<Tipo>` con pool `rand(0,3)`. Ver `shop-greeting.ts`.
  const greetingLines = profile.shopGreetingLottery
    ? shopGreetingLines((seg.script ?? []).map((op) => op.anchor as AnchorLike | undefined))
    : EMPTY_LINES;

  const blocks: BlockResult[] = [];
  for (const b of seg.expect) {
    // SEGUNDA PASADA FANTASMA (perfil AD): la re-lectura de la MISMA línea con espacios→`"`
    // se retira ANTES de clasificar y de casar — su ruido rompía el casado del bloque entero.
    const raw = profile.stripGhost ? stripGhostPass(b.text) : b.text;
    if (profile.stripGhost && collapseWith(raw, profile).length < 3) {
      // el bloque ERA sólo la pasada fantasma: sin contenido propio → no-comparable
      blocks.push({ ocrLn: b.ocrLn, class: "ocr-ghost", verdict: "ocr-ghost" });
      continue;
    }
    if (profile.detectGarbage && isGarbage(raw)) {
      blocks.push({ ocrLn: b.ocrLn, class: "ocr-garbage", verdict: "ocr-garbage" });
      continue;
    }
    const friendly = ocrFriendly(raw); // para probar patrones tolerantes a corrupción OCR
    // ══════════════════════════════════════════════════════════════════════════════════════
    // VENTANA `comparador-bandas` — LAS DOS LOTERÍAS, RETIRADAS **ANTES DE CASAR**
    //
    // ⚠ Esto CONTRADICE A PROPÓSITO la doctrina de monotonía que rige el resto del diff (un
    // reconocedor va en la ÚLTIMA posición para que sólo pueda convertir DIVERGENTE →
    // no-comparable y nunca pueda robar un match). Aquí van ARRIBA, donde SÍ retiran matches, y
    // el argumento es que **ese match no es real**: en los dos casos el casado lo decide una
    // TIRADA DEL PORT, no su fidelidad, así que un `match` es un billete premiado y un
    // `divergent` es un billete perdedor. Dejarlos dentro es lo que hace que la conformidad se
    // mueva sola entre shas. Cada una lleva palanca de perfil propia y contador propio.
    // Pre-registro: re/notes/comparador-bandas-preregistro.md §1 (condición 5) y §2.
    //
    // 1) DESENLACE DE COMBATE en clase CURADA (ficha F-5). `RNG_AUTO` ya declara el desenlace
    //    no-comparable para la clase `auto`; el `exact` que `segment.mjs` pone en la línea de
    //    corte del combate lo EXIME, y `combatOverridesCuratedClass` sólo lo recoge al final —
    //    o sea, hoy el billete sale del denominador ÚNICAMENTE cuando pierde (`0/0`) y se queda
    //    (`+1/+1`) cuando gana. Aquí sale gane o pierda.
    if (profile.combatOutcomeLottery && b.class !== "auto" && COMBAT_OUTCOME.test(friendly)) {
      blocks.push({ ocrLn: b.ocrLn, class: "combat-outcome-rng", verdict: "combat-rng" });
      continue;
    }
    // 2) SALUDO DE TIENDA (pool `rand_range(0,3)` por visita). El predicado es el JOIN por
    //    `ocrLn` contra el ancla de la que se derivó — sin umbrales y sin texto del juego.
    if (greetingLines.has(b.ocrLn)) {
      blocks.push({ ocrLn: b.ocrLn, class: "shop-greeting-rng", verdict: "rng" });
      continue;
    }
    // ══════════════════════════════════════════════════════════════════════════════════════
    const salaSign = !!seg.openedBy && SALA_SIGNS.some((re) => re.test(raw) || re.test(friendly));
    // LÍNEA BASE 3b/3c (sólo perfiles de banco): clasificar la sala ANTES de casar. Se conserva
    // para poder MEDIR lo que retiraba; el camino vigente la aplica al final (ver abajo).
    if (salaSign && profile.salaDeferredBeforeMatch) {
      blocks.push({ ocrLn: b.ocrLn, class: "sala-diferida", verdict: "sala-diferida" });
      continue;
    }
    let cls = b.class;
    // `detectAdPending` y no `id === "ad"`: el banco de calibración offline necesita un perfil
    // AD-de-3b (`ad-pre3c`) que se diferencie del vigente SÓLO en las palancas de 3c. Con el
    // gate por id, ese perfil perdía además la clasificación `pending` y el «antes» dejaba de
    // ser el 3b real (la línea base mentía por 702 bloques).
    if (cls === "auto" && profile.detectAdPending) {
      const p = AD_PENDING.find(
        (x) => !(x.notWhenInterior && seg.openedBy) && (x.re.test(raw) || x.re.test(friendly)),
      );
      if (p) {
        blocks.push({ ocrLn: b.ocrLn, class: "pending", verdict: "pending", ticket: p.flow });
        continue;
      }
    }
    if (cls === "auto") {
      if (PRESENTATION_ONLY.some((re) => re.test(raw) || re.test(friendly))) cls = "presentacion";
      else if (PROMPT_OVERLAY.some((re) => re.test(raw))) cls = "overlay-channel";
      else if (RNG_AUTO.some((re) => re.test(friendly))) cls = "rng"; // OCR-tolerante (antes fugaba)
    }
    // presentación = canal sólo-pantalla: no-comparable, sin intentar casar (spot-check valida)
    if (cls === "presentacion") {
      blocks.push({ ocrLn: b.ocrLn, class: cls, verdict: "presentacion" });
      continue;
    }
    // OCR-PARTIAL: eco de comando parcial por captura OCR fallida ("Look-2"/"Open-F").
    // GUARD anti-alfombra (ruling del lead): sólo se etiqueta si el port EMITIÓ ese comando
    // en el MISMO segmento (su palabra aparece en el transcript T); si no hay contraparte
    // port-logueada, NO se barre → cae como divergente normal abajo.
    if (cls === "auto") {
      const pm = OCR_PARTIAL_SHAPE.exec(raw) ?? OCR_PARTIAL_SHAPE.exec(friendly);
      if (pm) {
        const cmd = collapseWith(pm[1] ?? "", profile);
        if (cmd.length >= 3 && T.includes(cmd)) {
          blocks.push({ ocrLn: b.ocrLn, class: "ocr-partial", verdict: "ocr-partial" });
        } else {
          // comando-partial SIN eco port-logueado cercano → DIVERGENTE (no se barre); y evita
          // el falso-match del wildcard cuando el strip deja el bloque casi vacío ("-2").
          blocks.push({ ocrLn: b.ocrLn, class: cls, verdict: "divergent", snippet: `(partial sin eco port: '${raw.slice(0, 24)}')` });
        }
        continue;
      }
    }
    const gap = KNOWN_GAPS.find((g) => g.re.test(raw));
    // retira artefactos sólo-pantalla (eco de comando + "Player: X") ANTES de casar el RESULTADO
    const stripped = stripScreenArtifacts(raw);
    const pat = blockPattern(stripped, profile);
    const m = pat.exec(T);
    const cb = collapseWith(stripped.replace(/\d+/g, ""), profile);
    if (m) {
      // números: compara los números del bloque OCR con los de las líneas del port que
      // cubre el LITERAL del match (ledger de deriva numérica). Los dos lados pasan por
      // `countedDigits` (aislamiento de token, T-LEDGER-GLIFO) y la ventana sale de
      // `literalSpan`, no del span completo, para que el comodín no arrastre la línea de
      // arriba (T-LEDGER-VENTANA). Ver re/notes/deltas-42-adjudicacion.md.
      const expNums = countedDigits(raw);
      let got: string[] = [];
      if (expNums.length) {
        // sin literal (bloque todo dígitos) no hay ancla: se cae al span completo, declarado
        const span = literalSpan(m) ?? { from: m.index, to: m.index + m[0].length - 1 };
        const fromLi = lineAt[span.from] ?? 0;
        const toLi = lineAt[Math.min(span.to, lineAt.length - 1)] ?? fromLi;
        for (let li = fromLi; li <= toLi; li++) got = got.concat(countedDigits(portLines[li] ?? ""));
      }
      const numbers = expNums.length ? { expected: expNums, got } : undefined;
      if (gap) {
        blocks.push({ ocrLn: b.ocrLn, class: cls, verdict: "gap-cerrado", ticket: gap.ticket, numbers });
        continue;
      }
      blocks.push({ ocrLn: b.ocrLn, class: cls, verdict: cls === "rng" ? "rng" : "match", numbers });
      continue;
    }
    if (gap) {
      blocks.push({ ocrLn: b.ocrLn, class: cls, verdict: "known-gap", ticket: gap.ticket });
      continue;
    }
    if (cls === "pending" || cls === "overlay-channel" || cls === "rng") {
      blocks.push({ ocrLn: b.ocrLn, class: cls, verdict: cls === "rng" ? "rng" : (cls as Verdict) });
      continue;
    }
    // COBERTURA-TILING (perfil AD): el bloque OCR es la concatenación DEDUPLICADA de
    // redibujados parciales, así que trae truncamientos («The pocket watc reads 3:28 AM.»)
    // que rompen la subcadena contigua por UN carácter. Si el transcript CUBRE el contenido
    // del bloque en teselas largas (≥minTile) por encima del umbral, es la MISMA línea vista
    // a trozos → `covered` (matcheado, contado aparte para auditar la calibración). Sin
    // `numbers`: la posición de los trozos no delimita una ventana de líneas del port, así
    // que el LEDGER numérico sólo se alimenta de los matches por patrón (posición conocida).
    if (profile.coverage && cb.length >= profile.coverage.minLen) {
      // F4-f: el teselado GREEDY no es monótono en `T` (ver `coverageRatioMonotone`), así que un
      // bloque que el port SÍ dice puede caer a `divergent` porque el port dijo más cosas EN OTRA
      // PARTE del segmento. La palanca cambia el ESTIMADOR, no el umbral.
      const cov = profile.coverageMonotone
        ? coverageRatioMonotone(cb, T, profile.coverage.minTile)
        : coverageRatio(cb, T, profile.coverage.minTile);
      if (cov >= profile.coverage.threshold) {
        blocks.push({ ocrLn: b.ocrLn, class: cls, verdict: "covered", sim: Number(cov.toFixed(3)) });
        continue;
      }
    }
    // fuzzy: mejor ventana por bigramas. F4-f: la rejilla histórica (`step = w/6` desde el índice
    // 0) hace que el valor dependa de la FASE, o sea de cuántos caracteres haya ANTES en `T`; el
    // barrido exacto es invariante (y más barato). La palanca cambia el ESTIMADOR, no el umbral.
    let best = 0;
    let bestAt = 0;
    if (profile.fuzzyExactScan) {
      const bd = bestDiceWindow(cb, T);
      best = bd.best;
      bestAt = bd.at;
    } else {
      const w = Math.max(cb.length, 8);
      const step = Math.max(2, Math.floor(w / 6));
      for (let i = 0; i + Math.floor(w * 0.7) <= T.length; i += step) {
        const s = dice(cb, T.slice(i, i + w));
        if (s > best) {
          best = s;
          bestAt = i;
        }
      }
    }
    if (best >= 0.84) {
      blocks.push({ ocrLn: b.ocrLn, class: cls, verdict: "fuzzy", sim: Number(best.toFixed(3)) });
      continue;
    }
    // FASE 3c — RNG DE COMBATE CALIBRADO POR CORPUS, en la ÚLTIMA posición a propósito.
    //
    // Los patrones (`profile.combatRng` + `isRosterTail`) son la re-escritura, en la ortografía
    // del OCR de ESTE corpus, de lo que `RNG_AUTO` ya declara no-comparable en LP1: banner de
    // roster, aim del ataque, resultados de tirada, desenlace, jugador activo y huida. No se
    // añade ninguna clase nueva a lo no-comparable; se reconoce la misma en otra caligrafía.
    //
    // Por qué AQUÍ y no arriba (y no como `RNG_AUTO`, que declasifica ANTES de intentar casar):
    // puesto arriba, el reconocedor se comía 138 bloques que SÍ casaban — o sea, retiraba
    // conformidad REAL del numerador, que es justo lo que la calibración no debe hacer nunca.
    // En la última posición la palanca sólo puede convertir DIVERGENTE → no-comparable: es
    // monótona sobre `matched` (un bloque que el port dijo sigue contando como match) y por
    // construcción no puede fabricar ni ocultar conformidad. Es MÁS conservador que la doctrina
    // histórica de LP1, deliberadamente (blindado por unit test).
    //
    // Actúa también sobre clase CURADA `exact` si el perfil lo permite, porque ese `exact` lo
    // pone `segment.mjs` en la LÍNEA DE CORTE del combate (`VICTORY!`/`BATTLE IS LOST!`), no un
    // curador — ver `combatOverridesCuratedClass`. Cada mecanismo se cuenta SOLO.
    if (profile.combatRng.length || profile.detectRosterTail) {
      const curated = b.class !== "auto";
      if (!curated || profile.combatOverridesCuratedClass) {
        const tail = profile.detectRosterTail && isRosterTail(raw);
        if (tail || profile.combatRng.some((re) => re.test(probeFold(raw)))) {
          blocks.push({
            ocrLn: b.ocrLn,
            class: tail ? "combat-roster-tail" : curated ? "combat-rng-curado" : "combat-rng",
            verdict: "combat-rng",
            sim: Number(best.toFixed(3)),
          });
          continue;
        }
      }
    }
    // FASE 3d — SALA DIFERIDA, UNIFICADA CON EL RECONOCEDOR CALIBRADO (deber previo de 3d).
    //
    // Qué hace: dentro de un interior ABIERTO, los bloques con firma de COMBATE DE SALA se
    // retiran del denominador de INTERIORES y se cuentan aparte (`salaDeferred`). El ruling de
    // 3b separó las dos métricas porque el RNG de combate no estaba calibrado para AD y
    // mezclarlo hundía el número de interior por INSTRUMENTO.
    //
    // POR QUÉ SE MOVIÓ AQUÍ (era la deuda declarada de 3c): hasta 3c este bloque estaba ARRIBA,
    // clasificando ANTES de intentar casar, así que **podía retirar matches** — 208 bloques en
    // el lote medido de 3c salían del denominador sin que nadie comprobara si el port los había
    // dicho. Eso es exactamente lo que la doctrina de 3c prohíbe: puesto arriba, un reconocedor
    // no es monótono sobre `matched` y puede borrar conformidad REAL. Abrir los 209 `post-combat`
    // (que son material de sala + pasillo mezclado) habría multiplicado esa asimetría por ~209 y
    // dejado el número global ilegible.
    //
    // En la ÚLTIMA posición —detrás de match/covered/fuzzy Y detrás del reconocedor calibrado de
    // 3c— sólo puede convertir DIVERGENTE → no-comparable: un bloque que el port SÍ dijo sigue
    // contando como match. Misma garantía, y misma prueba (unit test de monotonía), que
    // `combat-rng`. Va DESPUÉS de `combat-rng` a propósito: el reconocedor calibrado por corpus
    // (derivado del vocabulario del propio port) tiene prioridad de atribución, y `sala-diferida`
    // queda como la red agnóstica de corpus para el resto de la firma de sala.
    if (salaSign) {
      blocks.push({ ocrLn: b.ocrLn, class: "sala-diferida", verdict: "sala-diferida", sim: Number(best.toFixed(3)) });
      continue;
    }
    // FASE 3f — RECONOCEDORES DEL CORPUS LP1 TARDÍO, en la ÚLTIMA posición de TODAS (detrás
    // incluso de `sala-diferida`; misma doctrina y misma garantía que `combat-rng` de 3c).
    //
    // POR QUÉ DETRÁS TAMBIÉN DE LA SALA, y no delante como el reconocedor de 3c: el test de
    // monotonía sobre el corpus lo cazó — puesto delante, 3f le robaba a `sala-diferida` sus
    // bloques (part16-g05 y compañía). El numerador no se movía (los dos son no-comparables),
    // pero el CENSO de «lo que 3f retira» se habría inflado con material que 3d ya había
    // retirado, y el delta de la fase habría cobrado trabajo ajeno. La regla que queda: 3f sólo
    // puede tocar lo que, sin él, sería DIVERGENTE.
    //
    // Reconocen en la caligrafía corrupta de part07-24
    // las MISMAS cuatro categorías que el comparador ya declara no-comparable con caligrafía
    // limpia: canal de presentación, RNG de combate, flujo no conducido y segunda pasada del
    // OCR. Ver el bloque de doctrina en `ocr-profile.ts` para qué se deja fuera A PROPÓSITO
    // (los verbos de transporte `Fly`/`Ride`/`Row` son un hueco del PORT y siguen contando).
    //
    // Aquí sólo pueden convertir DIVERGENTE → no-comparable: nunca se re-intenta casar con el
    // texto plegado ni limpiado, que sería relajación. Cada mecanismo lleva su propia `class`
    // para que el censo de retirados sea contable y la palanca reversible una a una.
    if (profile.lateRecognizers) {
      const lf = lateFold(raw);
      const pend = LATE_PENDING.find((x) => x.re.test(lf));
      if (pend) {
        blocks.push({ ocrLn: b.ocrLn, class: "3f-pending", verdict: "pending", ticket: pend.flow });
        continue;
      }
      if (LATE_COMBAT_RNG.some((re) => re.test(lf))) {
        blocks.push({ ocrLn: b.ocrLn, class: "3f-combat", verdict: "combat-rng", sim: Number(best.toFixed(3)) });
        continue;
      }
      if (isLateStatusPanel(raw)) {
        blocks.push({ ocrLn: b.ocrLn, class: "3f-presentacion", verdict: "presentacion" });
        continue;
      }
      // SEGUNDA PASADA PURA: el bloque era SÓLO la re-lectura fantasma (espacios→`"`); al
      // retirarla no queda contenido propio. Clasificación, no strip-y-recasar.
      if (collapseWith(stripGhostPass(raw), profile).length < 3 && collapseWith(raw, profile).length >= 3) {
        blocks.push({ ocrLn: b.ocrLn, class: "3f-ghost", verdict: "ocr-ghost" });
        continue;
      }
    }
    const li = lineAt[bestAt] ?? 0;
    blocks.push({
      ocrLn: b.ocrLn,
      class: cls,
      verdict: "divergent",
      sim: Number(best.toFixed(3)),
      snippet: portLines
        .slice(Math.max(0, li - SNIPPET_LINES_BEFORE), li + SNIPPET_LINES_AFTER)
        .join(" / ")
        .slice(0, SNIPPET_MAX_CHARS),
    });
  }
  const comparableBlocks = blocks.filter(
    (x) => x.verdict === "match" || x.verdict === "covered" || x.verdict === "fuzzy" || x.verdict === "divergent",
  );
  const matched = comparableBlocks.filter((x) => x.verdict !== "divergent").length;
  return {
    id: seg.id,
    ctx: seg.ctx,
    seam: seg.seam,
    comparable: comparableBlocks.length,
    matched,
    conformity: comparableBlocks.length ? Number((matched / comparableBlocks.length).toFixed(3)) : null,
    presentacion: blocks.filter((x) => x.verdict === "presentacion").length,
    ocrPartial: blocks.filter((x) => x.verdict === "ocr-partial").length,
    ocrGhost: blocks.filter((x) => x.verdict === "ocr-ghost").length,
    ocrGarbage: blocks.filter((x) => x.verdict === "ocr-garbage").length,
    covered: blocks.filter((x) => x.verdict === "covered").length,
    combatRng: blocks.filter((x) => x.verdict === "combat-rng").length,
    combatRosterTail: blocks.filter((x) => x.class === "combat-roster-tail").length,
    combatCurated: blocks.filter((x) => x.class === "combat-rng-curado").length,
    combatOutcomeRng: blocks.filter((x) => x.class === "combat-outcome-rng").length,
    shopGreetingRng: blocks.filter((x) => x.class === "shop-greeting-rng").length,
    ...(seg.openedBy ? { interior: true, interiorPhase: seg.openedBy } : {}),
    salaDeferred: blocks.filter((x) => x.verdict === "sala-diferida").length,
    dngOps: 0,
    wandererFrozen: 0,
    floorMatches: 0,
    floorResyncs: 0,
    floorUnknown: 0,
    salaOpsSkipped: 0,
    blocks,
  };
}


// ------------------------------------------- RESYNC DE LOCATION POR COSTURA (relevo-3)
/**
 * Ids de los castillos/keeps que NO tienen entrada en `locationNames` (la tabla DS 0x1e3a
 * las trae a 0x0000 y el emisor del banner las SALTA — OUTSUBS 0x3c1-0x3c9, ver
 * `Game.locationNameBanner`). Su banner en el OCR NO puede resolverse contra la tabla, así
 * que se completa con los DOS que el LP2 de AD visita, con cita del core:
 *   · Palacio de Blackthorn = loc 18 (core/state.ts:65 «Palace_of_Blackthorn (loc 18)»,
 *     core/combat/combat.ts:311 «Loc 18 (0x12) = Palacio de Blackthorn»).
 *   · Castillo de Lord British = loc 17 = 0x11 (core/game.ts:1878/3978 «Lord British (loc 0x11)»).
 */
export const KEEP_BANNERS: Array<{ re: RegExp; loc: number }> = [
  { re: /pa[lt1i]ace of b[lt1i]ack|b[lt1i]ackthorn/i, loc: 18 },
  { re: /cast[lt1i]e of [lt1i]ord br|[lt1i]ord brit|[lt1i]ord br[lt1i]t/i, loc: 17 },
];

/**
 * BANNER → LOCATION (PURO, testeable). El segmentador dejó `enter.loc = null` en las costuras
 * cuyo banner venía demasiado corrupto para mapearlo (8 de las 10 son el PALACIO DE BLACKTHORN
 * del corpus AD: «PALACE OF BLACKTHORN RNOG NMG YGG»). Sin `loc` el runner NO resincronizaba
 * NADA en esa costura, así que la party se quedaba en la location anterior y TODOS los beats
 * del episodio se miraban desde el sitio equivocado — la DERIVA DE LOCATION diagnosticada en el
 * estreno (los ANCHOR-MISS mirror/brick/hourglass de ad12 eran features de Blackthorn buscadas
 * desde otra location).
 *
 * Resolución en cascada, CONSERVADORA (mejor `null` que una location falsa):
 *   1. keeps/castillos sin banner en tabla (`KEEP_BANNERS`, con cita de core);
 *   2. nombre de `locationNames` contenido en el banner colapsado (gana el más largo);
 *   3. similitud por bigramas ≥ `minSim` contra el prefijo del banner (los banners de AD
 *      arrastran basura OCR a la DERECHA: «CASTLE OF LORD BRLTLSH OFTETGHT»);
 *   4. null.
 * El id se deriva con el MISMO mapeo empaquetado que `Game.locationNameBanner` (ids 1-13 →
 * idx id-1; ids ≥19 → idx id-6; los 14-18 no están en la tabla).
 */
export function seamLocationFromBanner(
  banner: string,
  locationNames: readonly string[],
  minSim = 0.7,
): number | null {
  const keep = KEEP_BANNERS.find((k) => k.re.test(banner));
  if (keep) return keep.loc;
  const cb = collapse(banner);
  if (cb.length < 3) return null;
  const idToLoc = (idx: number): number => (idx <= 12 ? idx + 1 : idx + 6);
  let bestSub = -1;
  let bestSubLen = 0;
  locationNames.forEach((nm, idx) => {
    const cn = collapse(nm);
    if (cn.length >= 4 && cb.includes(cn) && cn.length > bestSubLen) {
      bestSubLen = cn.length;
      bestSub = idx;
    }
  });
  if (bestSub >= 0) return idToLoc(bestSub);
  let bestSim = 0;
  let bestIdx = -1;
  locationNames.forEach((nm, idx) => {
    const cn = collapse(nm);
    if (cn.length < 4) return;
    // el banner de AD trae basura a la DERECHA → se compara contra su PREFIJO del largo del nombre
    const sim = dice(cn, cb.slice(0, cn.length));
    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = idx;
    }
  });
  return bestSim >= minSim && bestIdx >= 0 ? idToLoc(bestIdx) : null;
}

// ------------------------------------------------------------------- conducción
const ARROW: Record<string, string> = {
  north: "ArrowUp",
  south: "ArrowDown",
  east: "ArrowRight",
  west: "ArrowLeft",
};
const KEYMAP: Record<string, string> = { " ": "Space" };

/** Acumulador de consola page-side (poll 35 ms, dedupe por solape máximo) — arnés de
 *  fase 1 (espejo-part08 §Arnés), instalado ANTES de navegar. */
export async function armAccumulator(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const acc: string[] = [];
    let prev: string[] = [];
    (window as unknown as { __espejoAcc: string[] }).__espejoAcc = acc;
    setInterval(() => {
      const t = (window as unknown as { __u5test?: { consoleLines?: () => string[] } }).__u5test;
      if (!t?.consoleLines) return;
      const cur = t.consoleLines();
      if (cur.length === 0) return;
      let best = 0;
      const max = Math.min(prev.length, cur.length);
      for (let k = max; k > 0; k--) {
        let ok = true;
        for (let i = 0; i < k; i++) {
          const a = prev[prev.length - k + i]!;
          const b = cur[i]!;
          if (a === b) continue;
          if (i === k - 1 && b.startsWith(a)) continue;
          ok = false;
          break;
        }
        if (ok) {
          best = k;
          break;
        }
      }
      if (best > 0) {
        const grown = cur[best - 1]!;
        if (acc.length > 0 && grown.startsWith(acc[acc.length - 1]!) && grown !== acc[acc.length - 1]) {
          acc[acc.length - 1] = grown;
        }
      }
      for (let i = best; i < cur.length; i++) acc.push(cur[i]!);
      prev = cur;
    }, 35);
  });
}

/**
 * ★ INSTRUMENTO DEL CARRIL `ad06-teclas` (ficha #12) — **REGISTRO DE TECLAS DE LA CONSOLA
 * DE TIENDA**. Apagado por defecto: sin `U5_TECLAS_SEG` este `addInitScript` **no se instala**,
 * así que el camino por defecto es idéntico al de main (ni un listener de más).
 *
 * Contesta la pregunta del encargo —«¿qué teclas RECIBE la consola de tienda?»— en la ÚNICA
 * capa donde el dato existe: el DOM. El listener va en **fase de captura sobre `window`**, o
 * sea ANTES del `keydown` de burbujeo que monta `main.ts:4493` (`handleGameKey`), y anota el
 * estado JUSTO ANTES de que el juego procese la tecla:
 *   · `so`  — `__u5test.shopOpen()`: ¿hay consola de tienda viva que pueda recibirla?
 *   · `ph`  — `__u5test.shopConsole().phase`: en QUÉ fase la recibe (menu / sell-list / …)
 *   · `pr`  — `__u5test.promptType()`: qué sumidero de prompt la posee
 * y un `queueMicrotask` cierra el mismo registro con el estado de DESPUÉS (`so2`/`ph2`), que
 * corre tras el despacho síncrono completo.
 *
 * 🔴 POR QUÉ ESTA CAPA Y NO EL ARNÉS. El arnés sabe lo que MANDA pulsar; el juego sabe lo que
 * CONSUME. Los cuatro mecanismos refutados de `loteria-sellos-acta.md` §3.4 se construyeron
 * sobre transcripts —o sea sobre la SALIDA—, que no distingue «la tecla no se envió» de «se
 * envió y se la tragó otro sumidero». Este registro separa esas dos cosas por construcción.
 */
export async function armKeyLog(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface KeyRec {
      i: number;
      k: string;
      so: boolean;
      ty: string | null;
      ph: string | null;
      pr: string | null;
      so2?: boolean;
      ty2?: string | null;
      ph2?: string | null;
    }
    const log: KeyRec[] = [];
    (window as unknown as { __u5keys: KeyRec[] }).__u5keys = log;
    // ★ `ty` (TIPO de tienda) es el campo que adjudica, y por eso está: `shopOpen` es
    // `shopConsole != null` — dice si hay ALGUNA tienda abierta, no si es LA que se pidió.
    // Sale de la MISMA llamada que ya se hacía para `ph`: cero coste, cero perturbación extra.
    const leer = (): { so: boolean; ty: string | null; ph: string | null; pr: string | null } => {
      const t = (
        window as unknown as {
          __u5test?: {
            shopOpen?: () => boolean;
            shopConsole?: () => { type?: string; phase?: string } | null;
            promptType?: () => string | null;
          };
        }
      ).__u5test;
      const sc = t?.shopConsole?.() ?? null;
      return {
        so: Boolean(t?.shopOpen?.()),
        ty: sc?.type ?? null,
        ph: sc?.phase ?? null,
        pr: t?.promptType?.() ?? null,
      };
    };
    window.addEventListener(
      "keydown",
      (ev) => {
        const antes = leer();
        const rec: KeyRec = { i: log.length, k: ev.key, ...antes };
        log.push(rec);
        // El despacho de `handleGameKey` es SÍNCRONO: un microtask corre justo después.
        queueMicrotask(() => {
          const d = leer();
          rec.so2 = d.so;
          rec.ty2 = d.ty;
          rec.ph2 = d.ph;
        });
      },
      true, // CAPTURA: antes del listener de burbujeo del juego
    );
  });
}

/** Vuelca (y NO borra) el registro de teclas page-side. `from` = índice del primero a leer. */
export async function keyLogSlice(page: Page, from: number): Promise<KeyLogRec[]> {
  return page.evaluate(
    (f) => ((window as unknown as { __u5keys?: KeyLogRec[] }).__u5keys ?? []).slice(f),
    from,
  );
}

/** Una entrada del registro de teclas page-side (ver `armKeyLog`). */
export interface KeyLogRec {
  i: number;
  k: string;
  so: boolean;
  ty: string | null;
  ph: string | null;
  pr: string | null;
  so2?: boolean;
  ty2?: string | null;
  ph2?: string | null;
}

/** Longitud viva del registro de teclas page-side (0 si el instrumento no está armado). */
export async function keyLogLength(page: Page): Promise<number> {
  return page.evaluate(() => ((window as unknown as { __u5keys?: unknown[] }).__u5keys ?? []).length);
}

export async function accLength(page: Page): Promise<number> {
  return page.evaluate(() => ((window as unknown as { __espejoAcc?: string[] }).__espejoAcc ?? []).length);
}
export async function accSlice(page: Page, from: number): Promise<string[]> {
  return page.evaluate(
    (f) => ((window as unknown as { __espejoAcc?: string[] }).__espejoAcc ?? []).slice(f),
    from,
  );
}

/** Responde a un prompt: overlay .save-name si está visible; si no, teclado directo.
 *  SANEA el texto de teclas de arnés/consola: el backquote (corrupción OCR frecuente en los
 *  typed de AD: «thee`338 gp») es el TOGGLE del panel DEBUG QA (debug/index.ts F4/`) — un
 *  typed con ` abría el drawer en mitad del replay y su searchbox se tragaba el F5 del
 *  export de checkpoint (rotura medida de la cadena AD en ad04). */
/**
 * INVERSA del eco rúnico: de lo que el OCR LEYÓ a lo que el jugador PULSÓ.
 *
 * El getstring rúnico de Cast/Mix (CAST2.OVL:0x00de) se teclea por INICIAL y ecoa la
 * sílaba entera en mayúsculas — pulsar `D` pinta `DES`. El LP sólo tiene la fila de ECO,
 * así que guarda `typed: "DES POR"` cuando lo pulsado fueron dos teclas, `D` y `P`.
 * Re-teclear el eco NO reproduce el hechizo: dentro de este prompt el ESPACIO es la tecla
 * de ENVÍO (`prompt-manager.ts`), así que "DES POR" manda las iniciales `DES`
 * (Des·Ex·Sanct = ningún hechizo, "No effect!") y suelta `POR` sobre el MAPA como comandos.
 *
 * La inversa es total y no ambigua porque la tabla `DATA.OVL DS:0x1b7a` es biyectiva: 24
 * iniciales ↔ 24 sílabas distintas, cada una empezando por su propia inicial ('J'/'O'
 * tienen puntero NULL y no son sílaba). Se DERIVA de `runeSyllableForInitial` en vez de
 * copiarse, para que no puedan divergir.
 *
 * Devuelve `null` cuando la palabra NO es eco rúnico (keyword de conversación, nombre
 * propio, o ruido de OCR que no casa sílaba): entonces el runner la teclea literal, que es
 * lo correcto para su sumidero (`text`/diálogo/tienda). Ver `tools/censo-runa.mjs`.
 */
export function runeInitialsFromEcho(echo: string): string | null {
  const tokens = echo.toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  let initials = "";
  for (const tok of tokens) {
    const inicial = tok[0]!;
    // La sílaba de esa inicial tiene que ser EXACTAMENTE el token (biyección de DS:0x1b7a).
    if (runeSyllableForInitial(inicial) !== tok) return null;
    initials += inicial;
  }
  return initials;
}

async function typeAnswer(page: Page, text: string): Promise<void> {
  const clean = text.replace(/[`]/g, "");
  const overlay = page.locator(".save-name:visible");
  if ((await overlay.count()) > 0) {
    await overlay.fill(clean);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(180);
    return;
  }
  await page.keyboard.type(clean, { delay: 22 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(180);
}

/** Clase del sumidero de entrada vivo respecto a un `typed` del LP (ver typedSinkClass). */
export type SinkClass =
  /** getstring de conversación (o getstring de consola DENTRO de una tienda: el keyword del
   *  rumor de taberna, la cantidad de raciones): TRAGA una palabra — el `typed` va aquí */
  | "word"
  /** getstring RÚNICO de Cast/Mix: traga la palabra, pero se teclea por INICIAL y el
   *  ESPACIO es la tecla de ENVÍO. El `typed` del LP es el ECO (sílabas enteras), así que
   *  hay que invertirlo antes de mandarlo (ver `runeInitialsFromEcho`). */
  | "rune"
  /** picker de un caracter (Ready/Wear/party-select/digit): una PALABRA se pulveriza en él */
  | "letter"
  /** ★★ CONSOLA DE TIENDA (`prompts.current = {type:"shop"}`, `main.ts:armShopKey`): es un
   *  picker de UN CARÁCTER como los de arriba —despacha tecla a tecla por FASE, no acumula
   *  texto— pero se separa en clase propia por DOS razones medidas:
   *   · sus elecciones **GASTAN ORO** (`b`=Buy, letra=ítem, `y`=Deal), así que el
   *     envenenamiento no es cosmético: mueve el ledger. Ver `compra-fantasma-acta.md`.
   *   · su PURGA no puede ser el Escape ×2 a ciegas de `purgeLiveModes`: hay fases cuyo
   *     getkey RE-LEE el Escape (`greet-yn`, `buy-deal`, `sell-deal`, `blacksmith-pause`…).
   *     La purga correcta es la TABLA POR FASE de `closeShopDialog` (carril cierre-dialogo). */
  | "shop"
  /** nada vivo: el `typed` caería sobre el MAPA como ráfaga de comandos */
  | "none";

/**
 * CLASE del sumidero de entrada vivo, para decidir qué hacer con un `typed` del LP.
 * Hooks read-only del arnés (`promptType`/`dialogueOpen`/`shopOpen`/`readyPicker`/
 * `partySelectOpen`). Sin overlays DOM: desde #268 no hay ninguno para texto.
 *
 * PORQUÉ, y por qué la CLASE importa (atasco medido en el estreno AD, transcripts de ad07:
 * 21 de 30 segmentos con CERO líneas útiles y el 33% de las que hubo siendo la misma queja
 * repetida). Un `typed` tiene DOS formas de envenenar el replay:
 *
 *  1. **Sin sumidero** — `keyboard.type("YOUNGW")` pulveriza la keyword sobre el MAPA como
 *     ráfaga de COMANDOS (Y=Yell, O=Open, U=Use, N=New-order, G=Get, **W=Wear**), y los que
 *     abren modo (Wear/Ready/Cast/Mix) dejan el modo VIVO, que se traga TODO el resto del
 *     guion.
 *  2. **Con sumidero del tipo EQUIVOCADO** — un picker de UN CARÁCTER (Ready/Wear,
 *     party-select, digit) no acumula texto: consume cada letra como una elección de slot,
 *     así que «COMPASSION» son DIEZ elecciones, y de ahí sale exactamente la firma medida
 *     («Thou must free one of thy hands first!» / «Both hands must be free before thou canst
 *     wield that!» / «Thou must first remove thine other armour!»). Además el picker sigue
 *     vivo después, así que el envenenamiento es PERSISTENTE.
 *
 *  3. ★★ **Con la CONSOLA DE TIENDA viva** — el caso 2 con el ledger de por medio, y por eso
 *     tiene clase propia. La tienda también despacha tecla a tecla por fase, sólo que sus
 *     elecciones GASTAN ORO. Medido en `ad03-g11` (Trinsic) con las tres teclas nombradas:
 *     la **B** de `JVB` (el `JOB` del LP hablando con el preso Jerone, ocrLn 2414) abre la
 *     lista de COMPRA, la **E** de `PRISONER` (ocrLn 2437) elige `e...Large Shield` y la
 *     **Y** de `HERESY` (ocrLn 2446) contesta Yes: **−100 gp** y un escudo en el inventario
 *     que el LP nunca compró. Acta: `re/notes/compra-fantasma-acta.md`.
 *
 * Un `typed` del LP es SIEMPRE una palabra de getstring (keyword de conversación, nombre de
 * hechizo, mantra, nombre propio): su sumidero legítimo es `word`. Ante `letter`/`shop` el
 * modo es un residuo de un beat anterior — se PURGA y el `typed` se descarta; ante `none` se
 * descarta. En todos los casos cuenta como `typedSkipped` (INSTRUMENTO declarado, no
 * fidelidad): el beat del OCR sigue en la ruta y sigue contando como divergente si el port
 * debía responder.
 */
async function typedSinkClass(page: Page): Promise<SinkClass> {
  // (Aquí iba un `if (.save-name:visible) return "word"` para el modal DOM de las preguntas
  // de texto. #268 lo retiró del producto: esas preguntas son getstrings de CONSOLA y el
  // hook `promptType` de abajo ya las clasifica como `word`. Dejar el locator habría sido
  // un predicado que NUNCA casa con pinta de cubrir un caso.)
  return page.evaluate(() => {
    const t = (
      window as unknown as {
        __u5test?: {
          promptType?: () => string | null;
          dialogueOpen?: () => boolean;
          shopOpen?: () => boolean;
          readyPicker?: () => unknown;
          partySelectOpen?: () => boolean;
        };
      }
    ).__u5test;
    if (!t) return "none";
    // getstring del core (text/number) = acumulador de texto → traga la palabra entera
    const pt = t.promptType?.() ?? null;
    // El RÚNICO también traga, pero NO letra por letra: clase propia (ver SinkClass).
    if (pt === "rune") return "rune";
    if (pt === "text" || pt === "number") return "word";
    // conversación por consola: la keyword del LP entra por su propio getstring.
    // ★★ La TIENDA ya NO entra aquí: su prompt (`type:"shop"`) NO acumula texto, despacha
    // tecla a tecla por fase. Los getstring que sí viven DENTRO de una tienda (keyword del
    // rumor de taberna y cantidad de raciones, `deps.armText` → `type:"text"`) los recoge la
    // línea de arriba, que va ANTES: el arreglo no les quita el sumidero.
    if (t.dialogueOpen?.()) return "word";
    // CONSOLA DE TIENDA: picker de un carácter cuyas elecciones gastan oro (ver SinkClass).
    if (t.shopOpen?.()) return "shop";
    // pickers de UN carácter: una palabra se pulveriza en elecciones de slot
    if (pt || t.readyPicker?.() || t.partySelectOpen?.()) return "letter";
    return "none";
  });
}

/** Qué pasó con un `typed` del LP al conducirlo (ver `conductTypedOp`). */
export interface TypedOpOutcome {
  /** No se tecleó nada (sin sumidero, o picker de un carácter): cuenta `typedSkipped`. */
  skipped: boolean;
  /** Era eco RÚNICO y se invirtió a sus pulsaciones antes de teclearlo. */
  runeTranslated: boolean;
  /** Lo que REALMENTE se mandó al juego (`null` si no se mandó nada). */
  typed: string | null;
}

/**
 * CONDUCE un `typed` del LP contra el sumidero VIVO. Extraído del bucle de guion para que
 * el cableado —no sólo la lógica pura— quede bajo test: `espejo-rune-echo.test.ts` lo
 * ejecuta con un `Page` de mentira que alimenta el `PromptManager` DE PRODUCCIÓN, así que
 * perder la rama `rune` (o volver a clasificar el prompt rúnico como `word`) se pone ROJO
 * en vez de envenenar 623 ops en silencio.
 *
 * GUARDA DE SUMIDERO POR CLASE (ver `typedSinkClass`): la palabra sólo se teclea si hay un
 * sumidero que la trague. Sin sumidero se pulveriza como ráfaga de comandos sobre el mapa;
 * en un picker de UN CARÁCTER (Ready/Wear/party-select) se pulveriza en elecciones de slot
 * — y ese picker es residuo de un beat anterior, así que se PURGA para que no siga
 * envenenando el segmento.
 */
export async function conductTypedOp(page: Page, word: string, resyncs: string[]): Promise<TypedOpOutcome> {
  const sink = await typedSinkClass(page);
  if (sink !== "word" && sink !== "rune") {
    if (sink === "letter") {
      await purgeLiveModes(page, resyncs);
      resyncs.push(`typed '${word}' descartado: picker de UN CARÁCTER vivo (residuo de un beat anterior) → purgado`);
    } else if (sink === "shop") {
      // La purga de la tienda NO es el Escape ×2 a ciegas: hay fases que lo RE-LEEN. Se
      // reusa la tabla por fase del carril cierre-dialogo (misma pieza, para que no diverjan).
      const pulsadas = await closeShopDialog(page, `typed '${word}'`, resyncs);
      resyncs.push(
        `typed '${word}' descartado: CONSOLA DE TIENDA viva (residuo de un beat anterior) — sus teclas GASTAN ORO → cerrada con [${pulsadas.join(",")}]`,
      );
    }
    return { skipped: true, runeTranslated: false, typed: null };
  }
  // SUMIDERO RÚNICO (Cast/Mix): el `typed` del LP es el ECO de las sílabas, no las
  // pulsaciones. Mandarlo literal envía las iniciales equivocadas y derrama el resto
  // sobre el mapa (el ESPACIO envía) — ver `runeInitialsFromEcho` y el censo de 623 ops.
  let toType = word;
  let runeTranslated = false;
  if (sink === "rune") {
    const initials = runeInitialsFromEcho(word);
    if (initials !== null) {
      toType = initials;
      runeTranslated = true;
    } else {
      // No es eco rúnico (ruido de OCR que no casa sílaba): se manda literal, que es el
      // comportamiento de siempre, y se declara para no esconder el caso.
      resyncs.push(`typed '${word}' sobre prompt RÚNICO pero no es eco de sílabas: se teclea literal`);
    }
  }
  await typeAnswer(page, toType);
  return { skipped: false, runeTranslated, typed: toType };
}

/** Qué pasó con un op `key` del guion al conducirlo (ver `conductKeyOp`). */
export interface KeyOpOutcome {
  /** La tecla se envió al juego. */
  sent: boolean;
  /** Prompt ACUMULADOR vivo que la habría tragado como texto (`null` = ninguno). */
  heldBy: "text" | "number" | "rune" | null;
}

/**
 * ★★ CONDUCE un op `key` del guion con careo de sumidero — el KEY-LEAK del getstring
 * (ficha F1 de `espejo-ad-cabos-ad.md` §1.b.2, confirmando §4.2 de `tecleos-parciales-fix.md`).
 *
 * EL DEFECTO: los ops `key` se enviaban INCONDICIONALMENTE (`pressKey`), sin el careo que
 * los `typed` sí tienen. Un op `key` del guion es SIEMPRE un comando de mapa, una elección
 * de picker/tienda o una respuesta Y/N — NUNCA una letra de getstring (las respuestas de
 * getstring viajan como `typed`, por diseño del segmentador). Cuando el juego abre un
 * getstring que el guion no condujo (la captura de Blackthorn en ad12-g34: divergencia de
 * localización, interrogatorio inesperado), las teclas de comando programadas entran como
 * TEXTO: `:okootYES` (o/k/t de Open/Klimb/Talk) → 4 respuestas ≠ mantra → péndulo. El
 * runner fabricaba una vía que el LP no condujo.
 *
 * EL CRITERIO, derivado del reductor de prompts (`prompt-manager.ts`, `PendingPrompt`): la
 * tecla sólo se retiene ante un prompt ACUMULADOR — `text` / `number` / `rune` — que es el
 * único sumidero que la tragaría como texto en vez de consumirla como elección. Los demás
 * consumidores por tecla (`yesno`/`yesno-esc`/`digit`/`party-select`/`ready-picker`/
 * `getkey`/`shop`, y el MAPA sin prompt) son exactamente lo que un op `key` conduce:
 * a ellos se envía como siempre. Este careo es deliberadamente MÁS estrecho que
 * `typedSinkClass` («word» incluye `dialogueOpen`, que para una TECLA no discrimina: con
 * el diálogo abierto puede vivir un picker que la consume legítimamente — lo que decide
 * es el prompt acumulador, no la conversación).
 *
 * RETENER, no purgar: purgar un getstring de texto fabricaría una respuesta (Enter-vacío
 * es «bye»; en `rune` el ESPACIO envía). La retención se DECLARA (resync + transcript) y
 * el getstring queda para el siguiente `typed` del guion — la divergencia se mide, no se
 * contesta con basura.
 */
export async function conductKeyOp(page: Page, key: string, resyncs: string[]): Promise<KeyOpOutcome> {
  const pt = await page.evaluate(() => {
    const t = (window as unknown as { __u5test?: { promptType?: () => string | null } }).__u5test;
    return t?.promptType?.() ?? null;
  });
  if (pt === "text" || pt === "number" || pt === "rune") {
    resyncs.push(
      `key '${key}' RETENIDA: getstring ${pt} vivo que el guion no abrió — la tecla entraría como TEXTO (key-leak F1, espejo-ad-cabos-ad §1.b.2)`,
    );
    return { sent: false, heldBy: pt };
  }
  await pressKey(page, key);
  return { sent: true, heldBy: null };
}

/**
 * ★★ PROMPT Y/N DE FLOW 2 VIVO — lo que el `Escape ×2` NO PUEDE cerrar.
 *
 * El reductor de prompts del port (`src/ui/prompt-manager.ts:202-213`) resuelve el `Escape`
 * SÓLO en el tipo `yesno-esc`. En el tipo `yesno` **el ESC se ignora y la tecla se CONSUME**
 * (`return true`), que es lo FIEL: son los getkey Y/N crudos del binario — `getYN` 0x448c
 * («SÓLO Y/N, re-lee cualquier otra»), el tributo de guardia TALK 0x01e2 (eco 0x00c7/0x00d8) y
 * el arresto TOWN 0x12ae. O sea: **el port no se toca**; el que no sabía contestar era el arnés.
 *
 * MEDIDO EN CORRIDA (carril `tercera-rama`, ficha AH-1 de `ancla-herrero-acta.md` §4, corpus
 * AD, `ad04-g34`): a los 4 pasos de entrar en Moonglow el mundo levanta «A guard demands a 60
 * gp tribute to Blackthorn! / Dost thou pay?» — y el prompt se queda vivo el SEGMENTO ENTERO.
 * La sonda de ancla lo declara en los DOS resyncs (`sumideros: prompt=yesno`), las dos anclas
 * `shop:MagicSeller` fallan con `shopOpen=false tras 2 intentos` y el transcript del segmento
 * son 15 líneas para 60 beats (conformidad 7 %). Y el diagnóstico se le escapó a la ventana
 * anterior porque `npcAt` se lee por `page.evaluate`, no por tecla: la sonda seguía viendo al
 * mercader SOLO en su celda, con la party y la dirección correctas. **[[medir-en-la-capa-equivocada]]**
 *
 * La DECISIÓN no se reinventa aquí: es la tabla `guardPromptAction` del Grand Tour
 * (`e2e/grandtour/nav-tactics.ts`, unit-testeada, task #51) — `guard-tribute` → pagar ('y',
 * ruling del lead «el arnés se adapta al mundo»); `guard-arrest` → NO contestar (aceptar la
 * cárcel teletransporta la party a Yew y mide el resto del capítulo en el pueblo equivocado).
 *
 * ★★ EL PEAJE DE TROLLS (`troll-toll`, MAINOUT 0x1B3E) → se REHÚSA (`'n'`), y la decisión la
 * trae el CORPUS: los cuatro overlays de peaje llevan `expectDelta: 0` con `ledgerCite` «el LP
 * no pagó» (`ad01-g04` 39 gp · `ad04-g10` 39 · `ad04-g17` 39 · `ad05-g03` 36; importe
 * `99 − 3×STR`). Rehusar es además la ÚNICA rama de `resolveTrollToll` que no toca el oro ⇒ no
 * puede mover un delta armado. Tabla: `blockingYesNoAction` (nav-tactics), separada de
 * `guardPromptAction` a propósito para no cambiarle el comportamiento al Grand Tour.
 *
 * MEDIDO (carril `yesno-sin-tag`, sonda de eco de consola sobre las 3 partes de AD que lo
 * disparan): los **161** avisos «sin tag» de la ventana `agregado-23` eran **161 de 161** este
 * peaje — CERO Quit&Save, CERO exit-to-DOS, CERO fuente. Y eran **3 prompts**, no 161: uno por
 * parte (36 gp `ad05`, 42 `ad11`, 54 `ad08`), re-declarado una vez por op mientras seguía vivo.
 *
 * Lo que SIGA sin tag se DECLARA y se deja vivo a propósito —contestarlo a ciegas fabricaría un
 * guardado o pisaría el `y`/`n` del guion del LP—, pero el aviso ahora **NOMBRA el prompt con su
 * eco de consola**: un aviso anónimo no es adjudicable, y esa es exactamente la razón por la que
 * estos 161 se atribuyeron durante una ventana entera al prompt equivocado.
 *
 * Devuelve la etiqueta de lo que encontró (`null` = ningún `yesno` vivo).
 */
export async function resolveBlockingYesNo(page: Page, log: string[]): Promise<string | null> {
  let visto: string | null = null;
  // Cota de 2: el tributo puede ESCALAR a arresto cuando el pago falla por falta de oro
  // (`guard-encounters.ts`, ret 1 → TOWN 0x12ae). Más de dos vueltas sería un bucle.
  for (let i = 0; i < 2; i++) {
    const st = await page.evaluate(() => {
      const t = (
        window as unknown as {
          __u5test?: { promptType?: () => string | null; guardPromptOpen?: () => string | null };
        }
      ).__u5test;
      const w = (window as unknown as { __u5test?: { consoleLines?: () => string[] } }).__u5test;
      return {
        prompt: t?.promptType?.() ?? null,
        tag: t?.guardPromptOpen?.() ?? null,
        eco: (w?.consoleLines?.() ?? []).slice(-3).join(" | "),
      };
    });
    if (st.prompt !== "yesno") return visto;
    const accion = blockingYesNoAction(st.tag);
    if (accion === "refuse") {
      await pressKey(page, "n", 200);
      log.push(
        `YESNO-VIVO 'troll-toll' RESUELTO rehusando ('n'): el LP NO PAGÓ el peaje en los 4 overlays del corpus ` +
          `(ad01-g04 · ad04-g10 · ad04-g17 · ad05-g03, los cuatro con expectDelta 0) — y rehusar es la única rama ` +
          `de resolveTrollToll (MAINOUT 0x1B3E) que no toca el oro. El combate de trolls que sigue es la ` +
          `consecuencia que el propio transcript del LP registra (*** CONFLICT ***)`,
      );
      return "troll-toll";
    }
    if (accion === "pay") {
      visto = "guard-tribute";
      await pressKey(page, "y", 200);
      log.push(
        `YESNO-VIVO 'guard-tribute' RESUELTO pagando ('y'): un yesno de Flow 2 es INMUNE al Escape ×2 y se tragaba la 't' y la flecha del ancla (TALK 0x01e2)`,
      );
      continue; // puede haber escalado a arresto si el pago falló por oro
    }
    if (accion === "arrested") {
      log.push(
        `YESNO-VIVO 'guard-arrest' 🔴 NO se contesta (aceptar la cárcel teletransporta la party a Yew y mide el capítulo en el pueblo equivocado, nav-tactics #51) — el prompt SIGUE VIVO y se tragará las teclas de aquí en adelante`,
      );
      return "guard-arrest";
    }
    // ★★ EL ECO VA EN LA LÍNEA, y no es decoración: sin él el aviso es ANÓNIMO y una
    // ventana entera atribuyó estos 161 avisos a un Quit&Save que nunca se disparó (eran
    // los TRES peajes de trolls). Un aviso que no nombra a su prompt no es adjudicable.
    log.push(
      `YESNO-VIVO sin tag 🔴 NO se contesta a ciegas — el prompt SIGUE VIVO y se tragará las teclas de aquí en adelante. ECO DE CONSOLA: «${st.eco}»`,
    );
    return "yesno-sin-tag";
  }
  return visto;
}

/** PURGA DE MODOS VIVOS: cierra getstring/pickers/party-select colgados de un beat anterior. En
 *  mapa limpio es no-op («Cancelled.», cero estado de juego). Se aplica al ABRIR cada segmento
 *  para que un modo colgado no se coma el segmento siguiente (misma clase que la limpieza
 *  pre-Talk del resync de ancla-NPC).
 *
 *  El Escape ×2 NO basta: un `yesno` de Flow 2 lo IGNORA y consume la tecla (ver
 *  `resolveBlockingYesNo`), así que la purga lo resuelve ANTES — si no, los dos Escape se los
 *  come el prompt y la purga se cree hecha. */
async function purgeLiveModes(page: Page, log: string[] = []): Promise<void> {
  await resolveBlockingYesNo(page, log);
  await pressKey(page, "Escape", 120);
  await pressKey(page, "Escape", 120);
  await drainConversationGetstring(page, log);
}

/**
 * DRENAJE del getstring de CONVERSACIÓN colgado: desde el carril blackthorn-esc el
 * ESC ya no lo mata (régimen fiel del kernel 0x3b1c — ESC sólo borra la línea, la
 * única salida es CR), así que tras un Escape ×2 el único `text` que puede seguir
 * vivo es el de una charla. Se resuelve como en 1988: Enter con línea vacía
 * («Your interest?» vacío → bye cierra la charla; un AskName vacío re-pregunta y
 * el SIGUIENTE Enter vacío cae en el interest → bye). Acotado a 3 — un prompt que
 * sobreviva se queda para que el clasificador de tickets lo NOMBRE, no se machaca
 * a ciegas (misma doctrina que el yesno de Flow 2).
 */
async function drainConversationGetstring(page: Page, log: string[] = []): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const pt = await page.evaluate(
      () =>
        (window as unknown as { __u5test?: { promptType?: () => string | null } }).__u5test?.promptType?.() ?? null,
    );
    if (pt !== "text") break;
    log.push(`PURGA: getstring de conversación vivo tras Escape ×2 — Enter vacío (${i + 1}/3)`);
    await pressKey(page, "Enter", 120);
  }
}

/**
 * ★★ ESPERA DE COSTURA A LOS PACERS A RELOJ DE PARED (`refuging`/`camping`/`moongate`/
 * `trollSneak`/`endgame`).
 *
 * Estos pacers NO se despejan con teclas: `handleGameKey` hace `preventDefault()+return`
 * mientras corren, así que el `purgeLiveModes` (Escape ×2) de la costura pasa de largo. Y el
 * que peor sienta es `refuging`: al terminar, `resolveRefuge` (core/game.ts) llama a
 * `partyRefuge`, que **teletransporta a la party al castillo de Lord British** (loc 0x11,
 * planta 1, (10,10)) y pone el reloj a 6:00. Si la escena sigue viva cuando la costura hace su
 * `goToLocation`, el teleport de la escena llega DESPUÉS y **pisa el resync**: el segmento
 * entero se mide en el mapa equivocado.
 *
 * MEDIDO EN CORRIDA (ventana `f4bc-residuales`, `ad06-g18`, dos réplicas idénticas): la costura
 * hace `enter TRINSIC` y el ancla de mercader falla a los pocos ops con
 * `NPC-ANCHOR-MISS 'shop:Blacksmith' @loc17` — loc 17 es el castillo de LB, no Trinsic. El
 * transcript del propio segmento ABRE con los últimos beats del refuge («There is a peal of
 * thunder!» → discurso de LB → «Strange words are intoned.» → «Vertigo...»), y la costura de
 * salida del segmento siguiente lo confirma: «el replay no salió de loc=17».
 *
 * Mismo predicado (`livePacers`) que la espera del EXPORT de checkpoint (`waitOutPacers`), que
 * ya documenta esta rotura en la cadena AD: se comparte la definición para que no diverjan.
 * Devuelve los pacers que hubo que esperar (vacío = no hubo ninguno).
 */
export async function waitOutSeamPacers(page: Page, log: string[], budgetMs = 30_000): Promise<string[]> {
  const seen = new Set<string>();
  const t0 = Date.now();
  for (;;) {
    const live = livePacers(await inputSinks(page));
    if (live.length === 0) break;
    for (const p of live) seen.add(p);
    if (Date.now() - t0 > budgetMs) {
      log.push(`costura: pacer(s) ${live.join("+")} SIGUEN vivos tras ${budgetMs} ms — la costura sigue SIN esperarlos (su teleport puede pisar el resync)`);
      return [...seen];
    }
    await page.waitForTimeout(250);
  }
  if (seen.size > 0) {
    log.push(`costura: esperados los pacers a reloj de pared ${[...seen].join("+")} (${Date.now() - t0} ms) ANTES del resync de location — si no, su teleport lo pisa`);
  }
  return [...seen];
}

/** Tecla del replay del espejo. El `ms` que le pasa cada llamador es su cadencia de
 *  RÉGIMEN TEST (la de hoy); bajo `U5_VIDEO_TEMPO=cine` se sustituye por la cadencia
 *  humana medida, porque el mismo replay produce los vídeos que mira un humano. */
async function pressKey(page: Page, k: string, ms = 220): Promise<void> {
  await page.keyboard.press(KEYMAP[k] ?? k);
  await page.waitForTimeout(tecla(ms));
}

/**
 * FASE 3d — DECISIÓN de la costura `carryover` de mazmorra, PURA (testeable sin puerto).
 *
 * Un `post-combat` continúa la MISMA visita, así que no se teletransporta: se comprueba. La
 * regla es deliberadamente estricta — **la mazmorra viva tiene que ser la esperada**. Estar en
 * OTRA mazmorra no vale (el replay se fue por otro sitio y las teclas del pasillo medirían el
 * interior equivocado), y estar fuera del 3D tampoco (sería la rotura nº1 de 3b: teclas de
 * pasillo sobre el overworld). Cuando no vale, el segmento no se conduce y se DECLARA: un
 * interior abierto que no midió nada es un dato, no un silencio.
 */
export function carryoverInteriorLive(live: DngPos | null, expected: number | null | undefined): boolean {
  return live != null && expected != null && live.dungeon === expected;
}

/** Política de combate del replay: resuelve el combate vivo (auto = resolvedor real de
 *  nav.ts por teclas; escape = intenta huir como el LP). Devuelve rondas consumidas. */
/** Estado del guard anti-thrash de combate por SEGMENTO. Un combate que el resolvedor deja
 *  ATASCADO no debe re-lanzarse en cada paso de nav (el bucle resolver↔nav que agotó el
 *  timeout de part02: 104× intercept + 104× «atascado», ~300 rondas cada uno). */
export interface CombatGuard {
  stuck: boolean;
}
/** Decisión PURA: ¿lanzar el resolvedor? Sólo si HAY combate y NO quedó ya atascado en este
 *  segmento. (Testeable sin puerto.) */
export function shouldResolveCombat(inCombat: boolean, guard: CombatGuard): boolean {
  return inCombat && !guard.stuck;
}

/** Resultado de comparar un contador del ledger. `got: null` + `unreadable` = el contador no
 *  se pudo LEER (arnés sin ese campo): no es un delta 0, y por eso nunca matchea. */
export interface LedgerDelta {
  expected: number;
  got: number | null;
  match: boolean;
  unreadable?: true;
}

/** DELTA de una transacción anclada (PURO, testeable): got = contador después − antes; el
 *  ledger compara este delta con el esperado del beat (mecánica de transacción del port), NO
 *  el balance corrido (no-comparable: loot RNG). match ⇔ el port cobró/pagó el delta EXACTO.
 *  Con cualquiera de las dos lecturas a `null` el resultado es ILEGIBLE y se declara: la resta
 *  con null daría un número (`3 - null === 3`) y un `?? 0` complaciente convertiría «no lo sé»
 *  en un 0 que MATCHEA un delta esperado de 0 — un verde que no se ha medido. */
export function ledgerDeltaResult(before: number | null, after: number | null, expected: number): LedgerDelta {
  if (before == null || after == null) return { expected, got: null, match: false, unreadable: true };
  const got = after - before;
  return { expected, got, match: got === expected };
}

/** ¿El ancla de NPC de una transacción ENGANCHÓ (la party quedó plantada junto al mercader y
 *  la tienda abrió)? PURA.
 *
 *  ★★ LISTA BLANCA, NO LISTA NEGRA, y ésa es toda la lección. La forma anterior vivía inline
 *  en el runner como `status === "miss" || status === "ambiguous"` — enumerar los modos de
 *  FALLO conocidos. `AnchorStatus` tiene CINCO valores, y `skip` (el ancla se abstiene) no era
 *  ninguno de los dos: caía por el lado de «enganchó» y las teclas de la transacción se
 *  fabricaban sobre el mapa. Preguntando por los DOS estados de éxito, cualquier estado
 *  futuro entra por el lado seguro sin que nadie tenga que acordarse de esta línea. */
export function anchorEngaged(status: AnchorStatus): boolean {
  return status === "resolved-jump" || status === "resolved-hold";
}

/** Estado del veredicto de una transacción del ledger. Ver `ledgerTxnVerdict`. */
export type LedgerTxnState =
  | "fiel" // conducida y el delta CUADRA
  | "divergencia" // conducida y el delta NO cuadra → el único estado que acusa al PORT
  | "no-conducida" // el ancla no enganchó: el port nunca vio la tienda (cero VACÍO)
  | "no-conducida-con-movimiento" // el ancla no enganchó y AUN ASÍ el contador se movió
  | "ilegible" // conducida, pero el contador no se pudo LEER
  | "sin-intento"; // el segmento no armó ninguna transacción

export interface LedgerTxnVerdict {
  state: LedgerTxnState;
  /** ¿Este veredicto acusa al PORT de una divergencia de mecánica? SÓLO `divergencia`. */
  accusesPort: boolean;
  /** Cola de la línea `LEDGER-DELTA` — el sufijo que el lector del reporte archiva. */
  label: string;
}

/**
 * VEREDICTO de una transacción del ledger (PURO, testeable sin puerto).
 *
 * ★★ POR QUÉ EXISTE. La etiqueta anterior era un TERNARIO sobre `match` y sólo sabía decir
 * dos cosas: `✓ (mecánica FIEL)` o `✗ (DIVERGENCIA DE PORT en la transacción)`. Cuando el
 * ancla de NPC NO enganchaba, el port no llegaba a ver la tienda, el delta salía 0 — un cero
 * VACÍO, no medido — y la línea de cierre acusaba igualmente al port de una divergencia de
 * mecánica que nadie había observado. La causa real (`npc-anchor '…': skip (overworld…)`)
 * estaba en los `resyncs` decenas de líneas más arriba, así que un lector que auditara el
 * reporte por su cierre archivaba un fallo del port inexistente, y en el canal más caro del
 * proyecto. Medido en `ad09-g04` (acta `teclas-ad09` §6.1).
 * [[cita-equivocada-peor-que-ninguna]] · [[cero-vacio-exige-que-el-port-emita]]
 *
 * `anchor = null` significa que la transacción se armó de un op SUELTO (peaje de puente,
 * tributo de guardia): no hay mercader al que anclarse, así que está conducida por
 * construcción y su delta SÍ mide al port.
 *
 * ★ EL ORDEN DE LAS GUARDAS ES LA DECISIÓN. «No conducida» va ANTES que `unreadable` y antes
 * que `match`: si el port no condujo la transacción, ninguna propiedad del contador es una
 * medición de su mecánica, la lea o no. Al revés, un `unreadable` que se evaluara primero
 * archivaría como «no medido» algo que además ni se intentó, y perdería la causa.
 * [[orden-de-guardas-invierte-al-acusado]]
 */
export function ledgerTxnVerdict(delta: LedgerDelta | null, anchor: AnchorStatus | null): LedgerTxnVerdict {
  if (delta == null) return { state: "sin-intento", accusesPort: false, label: "" };
  if (anchor != null && !anchorEngaged(anchor)) {
    // El port NUNCA condujo la transacción. Ninguna propiedad del contador mide su mecánica.
    const causa = `el ancla de NPC resolvió '${anchor}' — el port nunca condujo la transacción (causa literal en los resyncs de arriba)`;
    if (delta.unreadable) {
      return { state: "no-conducida", accusesPort: false, label: `— (NO CONDUCIDA: ${causa}; y el contador tampoco es legible — NO medido)` };
    }
    if (delta.got !== 0) {
      // El contador se movió SIN que la transacción se condujera: no es un cero vacío y
      // tampoco es una divergencia del port en ESTA transacción — es otra cosa, y se nombra.
      return {
        state: "no-conducida-con-movimiento",
        accusesPort: false,
        label: `⚠ (NO CONDUCIDA: ${causa}; y AUN ASÍ el contador se movió ${delta.got} — ese movimiento NO es de esta transacción)`,
      };
    }
    return { state: "no-conducida", accusesPort: false, label: `— (NO CONDUCIDA: ${causa}. Cero VACÍO: NO medido, NO acusa al port)` };
  }
  if (delta.unreadable) return { state: "ilegible", accusesPort: false, label: "— (contador no legible: NO medido)" };
  return delta.match
    ? { state: "fiel", accusesPort: false, label: "✓ (mecánica FIEL)" }
    : { state: "divergencia", accusesPort: true, label: "✗ (DIVERGENCIA DE PORT en la transacción)" };
}

/** Contadores que un op puede ARMAR en el ledger del segmento. `null` = ese contador no se
 *  arma (distinto de armarlo con delta 0, que SÍ es una aserción: «esta transacción no
 *  movió el contador»). */
export interface LedgerArm {
  gold: number | null;
  keys: number | null;
  gems: number | null;
}

/**
 * ARMADO DEL LEDGER — decisión PURA de qué contadores arma un op del guion.
 *
 * DESACOPLADA DEL ANCLA. El ledger colgaba EXCLUSIVAMENTE del ancla de NPC, que sólo sirve a
 * las tiendas: un peaje de puente o un tributo de guardia no tienen mercader al que anclarse,
 * así que no podían entrar al ledger jamás (`espejo-ledger-ad.md` §5). Ahora arma cualquier
 * op que declare el delta, con o sin ancla; el ancla sigue armando por compatibilidad con las
 * dos transacciones verdes de LP1, y el delta del OP manda si están los dos.
 *
 * `null` = este op no arma nada. NO confundir con armar a 0, que es la aserción «la
 * transacción no movió el contador» — el caso de los 4 peajes RECHAZADOS del corpus AD.
 */
/**
 * Índices de la party a los que `seedStr` siembra la fuerza: los CONSCIENTES ('G'/'P'), en
 * los `partySize` primeros slots (máximo 6). PURA.
 *
 * POR QUÉ TODOS Y NO SÓLO EL AVATAR, a diferencia de `seedInt`: el negociador de las tiendas
 * es siempre `characters[0]`, así que sembrar la INT del avatar basta. El importe del peaje
 * NO — lo pone el STR del PRIMER MIEMBRO CONSCIENTE, y cuál sea ése depende del estado vivo
 * de la party (con el avatar muerto o dormido es otro). La derivación de esa selección vive
 * en `core/world/loops/hazards.ts`; sembrar a todos los conscientes deja el importe
 * determinista SIN copiarla aquí, que es lo que se desincronizaría en silencio el día que el
 * core la cambie.
 */
export function strSeedTargets(chars: ReadonlyArray<{ status?: string }>, partySize: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < partySize && i < 6 && i < chars.length; i++) {
    const s = chars[i]?.status;
    if (s === "G" || s === "P") out.push(i);
  }
  return out;
}

/**
 * ¿Este ancla de NPC abre una TIENDA? PURA. Decide si el resync-a-NPC exige el bucle de
 * verificación de enganche (`shopOpen`) o se conforma con un Talk a ciegas.
 *
 * LA PROPIEDAD QUE MANDA ES `match`, no `cmd`. La regla anterior sólo miraba `cmd` contra
 * buy/sell, y las 47 anclas del corpus AD llevan `cmd: "talk"` con `match: "shop:<Tipo>"`:
 * son tiendas, la regla decía que no, y se saltaban la verificación y el reintento. `match`
 * es lo que dice «tienda» sin obligar a mentir en `cmd` (el beat del OCR es un Talk).
 *
 * El brazo de `cmd` NO se retira. `d<N>` es una forma de match documentada en `NpcAnchor`
 * para mercaderes sin ambigüedad de tipo; keyear sólo por `match` dejaría un `buy`/`sell`
 * casado por dialogNumber sin verificación EN SILENCIO. Medido en los dos corpus: hoy no hay
 * ninguna así (0 anclas), que es justo lo que haría al agujero pasar inadvertido. La unión
 * es estrictamente aditiva: mismo comportamiento que antes MÁS las 47.
 */
export function anchorIsShop(anchor: { cmd: string; match: string }): boolean {
  return anchor.match.toLowerCase().startsWith("shop:") || /^(buy|sell)$/i.test(anchor.cmd);
}

export function ledgerArm(op: Op): LedgerArm | null {
  const anchorGold = op.anchor?.kind === "npc" ? op.anchor.expectDelta ?? null : null;
  const gold = op.expectDelta ?? anchorGold;
  const keys = op.expectKeysDelta ?? null;
  const gems = op.expectGemsDelta ?? null;
  if (gold == null && keys == null && gems == null) return null;
  return { gold, keys, gems };
}

async function resolveCombatIfAny(page: Page, policy: string | undefined, log: string[], guard: CombatGuard): Promise<number> {
  const inCombat = await inDungeonCombat(page);
  if (!inCombat) {
    guard.stuck = false; // el combate terminó (o no hay) → rearma el guard para el PRÓXIMO
    return 0;
  }
  if (!shouldResolveCombat(inCombat, guard)) return 0; // ya atascado en ESTE combate → no re-lanzar
  log.push(`combate interceptado (policy=${policy ?? "auto"})`);
  if (policy === "escape") {
    // huida a lo LP: empuja hacia el borde unas rondas; si no, cae al resolvedor
    for (let i = 0; i < 24; i++) {
      if (!(await inDungeonCombat(page))) {
        guard.stuck = false;
        return i;
      }
      await pressKey(page, "ArrowDown", 140);
    }
  }
  const ok = await dungeonResolveRoomCombat(page, { maxRounds: 300 });
  if (ok) {
    log.push("combate resuelto");
    guard.stuck = false;
  } else {
    log.push("combate NO resuelto (resolvedor atascado) — NO se re-lanzará en este segmento hasta que el combate cambie");
    guard.stuck = true; // corta el thrash: los siguientes pasos de nav no re-lanzan el resolvedor
  }
  await page.waitForTimeout(400);
  return 1;
}

/** RESYNC determinista a una location (arnés): usa `__u5debug.goToLocation` (position +
 *  enterMap NPCs + hydrateInteriorObjects, cero-rand) en lugar de teleport+(E). Robusto ante
 *  CUALQUIER estado (dentro de OTRA location, overworld a coords sueltas…): elimina el patrón
 *  de RESYNC-FAIL donde el replay no salió de la location anterior antes de la costura
 *  (teleportOverworld ponía location=0 pero la (E) no entraba). Sólo towns/castles 1-32
 *  llegan aquí (dungeons son skip nav-only; shrines usan enter.shrine sin loc). */
async function resyncEnterLocation(page: Page, loc: number): Promise<void> {
  await page.evaluate((id) => {
    const dbg = (window as unknown as { __u5debug?: { goToLocation?: (l: number, f?: number) => void } }).__u5debug;
    if (!dbg?.goToLocation) throw new Error("falta __u5debug.goToLocation (build sin ?debug)");
    dbg.goToLocation(id);
  }, loc);
  await page.waitForTimeout(200);
  const p = await getPos(page);
  if (p.location !== loc) throw new Error(`goToLocation(${loc}) dejó location=${p.location}`);
}

/** Tabla `locationNames` viva (data.json, la MISMA fuente que `Game.locationNameBanner`). */
async function liveLocationNames(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __u5test: { game: { data: { locationNames?: string[] } } } }).__u5test.game.data
        .locationNames ?? [],
  );
}

/** Tile-ENTRADA en el overworld de la location `loc` (`data.locationsX/locationsY`, indexadas
 *  por loc-1 — la MISMA fuente que `locationAt` del core y que `enterDungeon` del arnés). Es la
 *  celda a la que el juego devuelve al SALIR, así que sirve de destino del resync de salida. */
async function locationOverworldTile(page: Page, loc: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate((l) => {
    const d = (window as unknown as { __u5test: { game: { data: { locationsX?: number[]; locationsY?: number[] } } } })
      .__u5test.game.data;
    const x = d.locationsX?.[l - 1];
    const y = d.locationsY?.[l - 1];
    return x === undefined || y === undefined ? null : { x, y };
  }, loc);
}

/** CAPA del mapa grande. Britannia y el Underworld son la MISMA `location` (0) y se
 *  distinguen SÓLO por la planta: `floor` 0xFF = Underworld (`state.ts`, doc de `Position`;
 *  la constante del arnés es `UNDERWORLD_FLOOR` en `src/debug/debugApi.ts`). */
export const UNDERWORLD_FLOOR = 0xff;

export interface ExitResyncCheck {
  ok: boolean;
  reason?: string;
}

/** Nombre legible de una capa del mapa grande, para que el log diga DÓNDE cayó la party y no
 *  un número que hay que ir a interpretar. */
const layerName = (floor: number): string => (floor === UNDERWORLD_FLOOR ? "Underworld" : "Britannia");

/**
 * ¿El resync de salida dejó a la party donde se pedía? PURA.
 *
 * DISCRIMINA POR CAPA, no sólo por location. `location` no puede distinguir Britannia del
 * Underworld —los dos son 0— así que la guarda anterior firmaba como bueno un depósito en el
 * mapa grande equivocado. Y el depósito equivocado era el caso NORMAL, porque el resync
 * llamaba a `teleportOverworld` sin su tercer argumento y ése cae a `false` (Britannia).
 * Dos defectos que se tapaban el uno al otro: el que produce el error y el que no lo ve.
 */
export function exitResyncVerdict(pos: { location: number; floor: number }, wantUnderworld: boolean): ExitResyncCheck {
  if (pos.location !== 0) return { ok: false, reason: `teleportOverworld dejó location=${pos.location}` };
  const got = pos.floor === UNDERWORLD_FLOOR;
  if (got !== wantUnderworld) {
    return { ok: false, reason: `capa EQUIVOCADA: se pedía ${layerName(wantUnderworld ? UNDERWORLD_FLOOR : 0)} y la party quedó en ${layerName(pos.floor)} (floor=${pos.floor})` };
  }
  return { ok: true };
}

/** Qué hace el runner al entrar en una costura de salida, decidido APARTE del `await`. */
export type ExitSeamAction =
  | { kind: "resync"; fromLoc: number; underworld: boolean; porqueMazmorra: boolean }
  /** `abandonedIn` = el segmento donde la party fue EXPULSADA del 3D, cuando se sabe (ver abajo). */
  | { kind: "layer-mismatch"; want: boolean; got: number; abandonedIn?: string }
  | { kind: "none"; reason: string };

/**
 * ★★ DECISIÓN del call-site de la costura de salida. PURA.
 *
 * Existía sólo como un `if` dentro de `runSegment`, y arrastraba DOS defectos encadenados. El
 * segundo es el que mata al primero, así que van en orden:
 *
 * ─── 1. `state.position` NO ATESTIGUA que la party esté en una mazmorra ───────────────────
 * `setDungeonPos` (`dungeon-cmds.ts:174-212`), que es como el arnés mete a la party en el 3D,
 * deja **a propósito** `state.position = { location: 0, floor: 0, … }` — el tile de SUPERFICIE
 * de la entrada, para que un `Exit to Britannia!` posterior aterrice donde debe. El testigo de
 * «estoy dentro» es `dungeonState`, no `position`.
 *
 * ⇒ El gate viejo (`pos.location !== 0`) **nunca podía ser cierto para una mazmorra**, así que
 * el resync de salida estaba MUERTO para el único caso que las 16 costuras del Underworld
 * describen. Y de paso refuta el criterio de clase A de E-23 —*«si el replay no salió, la party
 * sigue en `location != 0`»*—: no sigue. Es 0 desde que el arnés la metió dentro.
 *
 * ─── 2. y la capa no se miraba en la otra rama ────────────────────────────────────────────
 * E-2 arregló la comprobación de capa DENTRO de `resyncExitToOverworld` —la rama que ya sabía
 * que había que corregir— y dejó la del replay-que-salió-solo con el predicado viejo, el mismo
 * que E-2 declaró incapaz de distinguir Britannia del Underworld (los dos son `location` 0).
 *
 * `layer-mismatch` **NO corrige**: DECLARA. Corregirlo taparía una divergencia real del port (la
 * costura dice `underworld` porque el LP emergió al Underworld; si el port emergió a Britannia,
 * eso es el dato). Mover la party aquí convertiría un hallazgo en un verde.
 *
 * ─── 3. …pero DECLARAR no es NOMBRAR UNA CAUSA (tarjeta `ad18-g11`) ───────────────────────
 * La rama emitía «el replay salió por su cuenta a Britannia», y eso **no se observa aquí**:
 * `location 0 / floor 0` sin mazmorra viva es exactamente lo que deja también una **expulsión**
 * del 3D (`PLANTA-DESCONOCIDA`: la costura de mazmorra sólo sabe entrar por la CIMA, así que un
 * `Klimb-Up!` del LP saca al port a Britannia). En el único `layer-mismatch` real que el brazo ha
 * cazado —`ad18-g11`, medido en vivo— la causa era ésa, y el runner ya la había impreso un
 * segmento antes; afirmar la otra dejó «divergencia del port» como hipótesis viva una ventana
 * entera. Por eso la causa entra por `interiorAbandonedBefore` **cuando se sabe**, y cuando no se
 * sabe no se nombra.
 */
export function exitSeamAction(
  pos: { location: number; floor: number },
  enter: { overworld?: boolean; carryover?: boolean; underworld?: boolean } | undefined,
  dungeonLive?: { dungeon: number } | null,
  /** el segmento ANTERIOR abandonó el 3D (`floorUnknown > 0`), si es que lo hizo */
  interiorAbandonedBefore?: { abandonedIn: string },
): ExitSeamAction {
  if (!enter?.overworld || enter.carryover) return { kind: "none", reason: "no es costura de salida sin carryover" };
  const want = enter.underworld === true;
  // La mazmorra VIVA manda sobre `position`: el arnés la dejó en el tile de superficie (0,0) y
  // preguntarle a `position` da «ya está fuera» con la party dentro del 3D.
  if (dungeonLive) return { kind: "resync", fromLoc: dungeonLive.dungeon, underworld: want, porqueMazmorra: true };
  if (pos.location !== 0) return { kind: "resync", fromLoc: pos.location, underworld: want, porqueMazmorra: false };
  // El replay salió por su cuenta. El resync no tiene nada que hacer — pero la CAPA sigue sin
  // comprobarse, y `location` no puede distinguirla.
  if ((pos.floor === UNDERWORLD_FLOOR) !== want) {
    return { kind: "layer-mismatch", want, got: pos.floor, ...(interiorAbandonedBefore ? { abandonedIn: interiorAbandonedBefore.abandonedIn } : {}) };
  }
  return { kind: "none", reason: `el replay ya salió por su cuenta a ${layerName(pos.floor)}` };
}

/** RESYNC DE SALIDA (costura `exit`/`overworld`): si el replay NO sacó a la party de la
 *  location, la deja SOBRE el tile-entrada de esa location en el overworld — la celda a la que
 *  el juego devuelve al salir de verdad. Sin esto, las 140 costuras `overworld` del corpus AD no
 *  comprobaban NADA y un episodio entero seguía corriendo DENTRO del pueblo anterior (deriva de
 *  LOCATION, gemela de la de posición pero a nivel mapa). Costura sancionada cero-rand
 *  (`__u5debug.teleportOverworld`, misma clase que goToLocation/teleportSmallMap). */
async function resyncExitToOverworld(page: Page, fromLoc: number, log: string[], underworld: boolean): Promise<void> {
  const tile = await locationOverworldTile(page, fromLoc);
  if (!tile) {
    log.push(`RESYNC-FAIL exit: sin tile-entrada de overworld para loc=${fromLoc} (data.locationsX/Y)`);
    return;
  }
  // El TERCER argumento es la capa. Iba sin pasar, y su default es `false`, así que este
  // resync depositaba SIEMPRE en Britannia — también cuando la costura era del Underworld.
  await page.evaluate(
    ({ x, y, u }) => {
      (window as unknown as { __u5debug?: { teleportOverworld?: (x: number, y: number, u?: boolean) => void } }).__u5debug?.teleportOverworld?.(x, y, u);
    },
    { ...tile, u: underworld },
  );
  // ★★ SALIR ES TAMBIÉN DEJAR EL 3D. `teleportOverworld` (debugApi) escribe SÓLO
  // `state.position`; no toca `dungeonState`. El core, al salir de verdad, hace las dos cosas
  // (`exitDungeonTo` → `ctx.setDungeonState(null)`, `dungeon-cmds.ts:441`). Sin este cierre el
  // resync deja un estado que el core NUNCA produce —party en el mapa grande y mazmorra viva— y
  // la costura SIGUIENTE lo vuelve a leer como «sigue dentro» y resincroniza otra vez.
  // MEDIDO: es lo que hacía `ad23-g04` justo detrás del resync de `ad23-g03`.
  await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { dungeonState?: unknown } } }).__u5test.game;
    if (g.dungeonState) g.dungeonState = null;
  });
  await page.waitForTimeout(150);
  const p = await getPos(page);
  const verdict = exitResyncVerdict(p, underworld);
  if (!verdict.ok) {
    log.push(`RESYNC-FAIL exit: ${verdict.reason}`);
    return;
  }
  log.push(`RESYNC exit: el replay no salió de loc=${fromLoc} → party al tile-entrada de ${layerName(p.floor)} ${tile.x},${tile.y}`);
}

/** Rango de location que `goToLocation` sabe resincronizar: towns y castles. 33..40 son
 *  mazmorras (costura `setDungeonPos`) y >40 no existe. */
const SMALL_MAP_LOC_MIN = 1;
const SMALL_MAP_LOC_MAX = 32;

/**
 * ★★ COSTURA INTERNA: la op que cambia de location A MITAD DE SEGMENTO.
 *
 * Ejecuta `enterLoc` / `exitOverworld` (ver su doc en `Op`) reusando LA MISMA maquinaria que las
 * costuras de segmento —`resyncEnterLocation` y `resyncExitToOverworld`—, no una copia. Devuelve
 * `true` si la op era suya (el bucle de conducción hace `continue`), `false` si no la reconoce.
 *
 * Va en el bucle ANTES del bloque de anclas y ANTES de `ledgerArm`: una costura no es un beat, y
 * el ancla de NPC que viene detrás tiene que leer la location YA cambiada — que es literalmente el
 * defecto que abre el ticket.
 */
export async function applyInternalSeam(page: Page, op: Op, log: string[]): Promise<boolean> {
  if (op.enterLoc != null) {
    const loc = op.enterLoc;
    if (!Number.isInteger(loc) || loc < SMALL_MAP_LOC_MIN || loc > SMALL_MAP_LOC_MAX) {
      throw new Error(
        `enterLoc ${loc} fuera de rango ${SMALL_MAP_LOC_MIN}..${SMALL_MAP_LOC_MAX}: las mazmorras (33..40) se resincronizan con setDungeonPos, no con goToLocation`,
      );
    }
    const pos = await getPos(page);
    if (pos.location === loc) {
      // IDEMPOTENCIA: re-teleportar devolvería la party al tile-entrada estándar y borraría la
      // posición que el replay (o un ancla anterior) ya había ganado dentro de la location.
      log.push(`costura INTERNA enterLoc ${loc}: ya dentro (${pos.x},${pos.y}) — sin resync`);
      return true;
    }
    await resyncEnterLocation(page, loc);
    const p2 = await getPos(page);
    log.push(
      `costura INTERNA enterLoc ${loc}: goToLocation desde location=${pos.location} (${pos.x},${pos.y}) → ${p2.x},${p2.y} — cero-rand`,
    );
    return true;
  }
  if (op.exitOverworld != null) {
    const capa = op.exitOverworld;
    if (capa !== "britannia" && capa !== "underworld") {
      // Sin este aborto, una capa mal escrita caería al `!== "underworld"` ⇒ Britannia: el mismo
      // default silencioso que E-2 tuvo que arreglar dentro de resyncExitToOverworld.
      throw new Error(`exitOverworld "${String(capa)}" no es del vocabulario: britannia | underworld`);
    }
    const underworld = capa === "underworld";
    const pos = await getPos(page);
    const live = await dungeonPos(page);
    const fromLoc = live?.dungeon ?? pos.location;
    if (fromLoc === 0) {
      const verdict = exitResyncVerdict(pos, underworld);
      log.push(
        verdict.ok
          ? `costura INTERNA exitOverworld ${capa}: la party ya está fuera y en la capa pedida — sin resync`
          : `costura INTERNA exitOverworld ${capa}: RESYNC-FAIL sin origen — ${verdict.reason} (location=0 y no hay mazmorra viva: no hay tile-entrada al que volver)`,
      );
      return true;
    }
    log.push(`costura INTERNA exitOverworld ${capa}: saliendo de loc=${fromLoc}${live ? " (mazmorra viva)" : ""}`);
    await resyncExitToOverworld(page, fromLoc, log, underworld);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════ FASE 3 — INTERIOR DE MAZMORRA (3a/3b)
/** Posición de mazmorra viva (hook read-only `__u5debug.dungeonPos`), o null fuera del 3D. */
export async function dungeonPos(page: Page): Promise<DngPos | null> {
  return page.evaluate(() => {
    const d = (window as unknown as { __u5debug?: { dungeonPos?: () => DngPosRaw | null } }).__u5debug;
    return d?.dungeonPos?.() ?? null;
  });
}
type DngPosRaw = { dungeon: number; floor: number; x: number; y: number; facing: string };
export interface DngPos {
  dungeon: number;
  floor: number;
  x: number;
  y: number;
  facing: string;
}

/** COSTURA cero-rand de interior (`__u5debug.setDungeonPos`): fija mazmorra+planta+celda+FACING.
 *  Misma clase sancionada que goToLocation/teleportSmallMap/teleportOverworld. */
async function setDungeonPosSeam(
  page: Page,
  dungeon: number,
  floor: number,
  x: number,
  y: number,
  facing: string,
): Promise<void> {
  await page.evaluate(
    (a) => {
      const d = (
        window as unknown as {
          __u5debug?: { setDungeonPos?: (d: number, f: number, x: number, y: number, fa: string) => void };
        }
      ).__u5debug;
      if (!d?.setDungeonPos) throw new Error("falta __u5debug.setDungeonPos (build sin dev hooks)");
      d.setDungeonPos(a.dungeon, a.floor, a.x, a.y, a.facing);
    },
    { dungeon, floor, x, y, facing },
  );
  await page.waitForTimeout(120);
}

/**
 * CELDA DE ENTRADA de una mazmorra desde SUPERFICIE: la primera escalera-arriba (type 0x1) o
 * arriba-y-abajo (0x3) de la planta 0, barriendo y luego x; (1,1) por defecto. Es LITERALMENTE
 * la regla de `enterDungeon` (dungeon-cmds.ts, MAINOUT cmd_enter 0x088f-0x08be), leída de los
 * MISMOS datos vivos (`game.dungeons`) para no duplicar la tabla en el arnés.
 */
async function dungeonEntryCell(page: Page, dungeonId: number): Promise<{ x: number; y: number }> {
  return page.evaluate((id) => {
    const dungeons = (
      window as unknown as {
        __u5test: { game: { dungeons?: Array<{ location: number; floors: Array<Array<Array<{ type: number }>>> }> } };
      }
    ).__u5test.game.dungeons;
    const d = dungeons?.find((x) => x.location === id);
    const f0 = d?.floors?.[0];
    if (f0) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const t = f0[y]?.[x]?.type;
          if (t === 0x1 || t === 0x3) return { x, y };
        }
      }
    }
    return { x: 1, y: 1 };
  }, dungeonId);
}

/**
 * CONGELADO DEL ERRANTE — instrumento de ARNÉS, declarado y contado (ruling del lead, opción A).
 *
 * El errante 3D consume el stream en CADA turno de mazmorra (hasta 8 `rand(0,3)` de dirección +
 * gate de ataque `rand(0,7)==1`, wanderer.ts) y sus emboscadas MUTAN EL FACING de la party
 * (dungeon.ts:1392 «Attacked from the west!» → `this.pos.facing = facingDir`). Con el errante
 * vivo hay DOS derivas simultáneas (la del replay y la del stream) y ninguna atribución posible;
 * la Fase 3b mide primero si el modelo de anclas de interior sirve.
 *
 * Se congela SIN TOCAR LA LÓGICA DEL CORE: se pone el tipo del errante a WANDERER_INACTIVE
 * (0xFF), el mismo valor que `inactiveWanderer()` deja tras un desarme (DNGLOOK 0x109E). Con
 * ese tipo, `wandererStep` retorna en la primera línea y NO consume ni una tirada, y
 * `wandererAt` da false. Cero-rand por construcción. Hay que RE-aplicarlo porque el core
 * re-arma el errante en cada cambio de planta / foso / post-combate (`respawnWanderer`).
 *
 * Devuelve true si REALMENTE había un errante activo (para contar la costura, no la llamada).
 */
async function freezeWanderer(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const ds = (
      window as unknown as { __u5test?: { game?: { dungeonState?: { wanderer?: { type: number } } | null } } }
    ).__u5test?.game?.dungeonState;
    const w = ds?.wanderer;
    if (!w || w.type === 0xff) return false;
    w.type = 0xff; // WANDERER_INACTIVE (wanderer.ts) — congelado por instrumento
    return true;
  });
}

/** Teclas del pasillo 3D (main.ts handleDungeonKey): ↑ forward, ↓ back, ←/→ giro, Enter 180º,
 *  Space Pass, i Ignite, g Get. Klimb/Search/Look llevan sub-prompt (ver runDungeonOp). */
const DNG_KEY: Record<string, string> = {
  advance: "ArrowUp",
  back: "ArrowDown",
  turnLeft: "ArrowLeft",
  turnRight: "ArrowRight",
  turnAround: "Enter",
  pass: "Space",
  ignite: "i",
  get: "g",
};
/** Prompt «Dir-» del (S)earch/(L)ook 3D (SJOG 0x0672): ↑ Ahead, ↓ Here, → Right, ← Left. */
const DNG_DIR_KEY: Record<string, string> = {
  ahead: "ArrowUp",
  here: "ArrowDown",
  right: "ArrowRight",
  left: "ArrowLeft",
};

/** Estado del rastreo de PLANTA del segmento de interior (el ancla primaria del modelo 3b). */
export interface FloorTrack {
  /** planta esperada por CONTEO de los ecos Klimb del LP desde la entrada (0 = cima) */
  expected: number | null;
  matches: number;
  resyncs: number;
  exits: number;
}

/** Decisión PURA del rastreo de planta tras un Klimb: qué planta se ESPERA y si la viva casa.
 *  Testeable sin puerto (unit). `live=null` = la party SALIÓ de la mazmorra (klimb en el tope). */
export function floorAfterKlimb(
  expected: number | null,
  dir: "up" | "down",
  live: number | null,
): { expected: number | null; verdict: "match" | "resync" | "exited" | "unknown" } {
  if (live === null) return { expected: null, verdict: "exited" };
  if (expected === null) return { expected: live, verdict: "unknown" }; // sin ancla: adopta la viva
  const want = Math.min(7, Math.max(0, expected + (dir === "up" ? -1 : 1)));
  return want === live ? { expected: want, verdict: "match" } : { expected: want, verdict: "resync" };
}

/**
 * Ejecuta un op de INTERIOR (`{dng:...}`) por TECLAS REALES del pasillo. Los sub-prompts se
 * resuelven MIRANDO el estado vivo (hook `inputSinks`), no contando teclas a ciegas:
 *  · Klimb: 'k'; si la celda tiene escalera arriba Y abajo el port abre «Klimb-U/D-» y espera
 *    la vía (main.ts:1149) → se pulsa 'u'/'d' SÓLO si el prompt está vivo.
 *  · Search/Look: 's'/'l' → selector de miembro (`pickCommandChar`; con party>1 abre
 *    party-select → Enter) → prompt «Dir-» → flecha de la dirección del OCR.
 * Devuelve la lista de teclas realmente pulsadas (traza del reporte).
 */
async function runDungeonOp(page: Page, op: Op, stepMs: number): Promise<string[]> {
  const pressed: string[] = [];
  const press = async (k: string, ms = stepMs): Promise<void> => {
    await pressKey(page, k, ms);
    pressed.push(k);
  };
  const kind = op.dng!;
  if (kind === "klimb") {
    await press("k");
    const sinks = await livePromptSinks(page);
    if (sinks.dungeonKlimbPrompt) await press(op.dir === "up" ? "u" : "d");
    return pressed;
  }
  if (kind === "search" || kind === "look") {
    await press(kind === "search" ? "s" : "l");
    if (await page.evaluate(() => Boolean((window as unknown as { __u5test?: { partySelectOpen?: () => boolean } }).__u5test?.partySelectOpen?.()))) {
      await press("Enter");
    }
    const sinks = await livePromptSinks(page);
    if (sinks.dungeonDirPrompt && op.dir && DNG_DIR_KEY[op.dir]) await press(DNG_DIR_KEY[op.dir]!);
    return pressed;
  }
  const key = DNG_KEY[kind];
  if (!key) return pressed; // vocabulario desconocido: no se fabrica tecla
  await press(key);
  return pressed;
}

/** Sumideros de entrada vivos (hook read-only `inputSinks`); `{}` si el build no lo trae. */
async function livePromptSinks(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const t = (window as unknown as { __u5test?: { inputSinks?: () => Record<string, unknown> } }).__u5test;
    return t?.inputSinks?.() ?? {};
  });
}

/** Instantánea del grid del mapa activo (rejilla de tile-ids) para resolver anclas. Misma
 *  fuente que nav.ts (`__u5test.game.activeMap.tileAt`). */
async function gridSnapshot(page: Page): Promise<GridSnapshot> {
  return page.evaluate(() => {
    const m = (window as unknown as { __u5test: { game: { activeMap: { width: number; height: number; tileAt: (x: number, y: number) => number } } } }).__u5test.game.activeMap;
    const W = m.width;
    const H = m.height;
    const grid: number[][] = [];
    for (let y = 0; y < H; y++) {
      const row: number[] = [];
      for (let x = 0; x < W; x++) row.push(m.tileAt(x, y));
      grid.push(row);
    }
    return { W, H, grid };
  });
}

export type AnchorStatus = "resolved-jump" | "resolved-hold" | "miss" | "ambiguous" | "skip";
export interface AnchorOutcome {
  status: AnchorStatus;
  drift: number;
}

/**
 * RESYNC DE POSICIÓN POR-INTERACCIÓN (Fase C, la palanca). Antes de ejecutar un op con ancla:
 * resuelve la celda del ancla contra el grid vivo (`resolveFaceAnchor`) y, si la posición
 * viva difiere, TELETRANSPORTA la party ahí por la costura sancionada cero-rand
 * (`__u5debug.teleportSmallMap` — misma clase que goToLocation/teleportOverworld). Así la
 * interacción REAL cae en la celda del LP y el ledger cobra vida. Devuelve el desenlace para
 * el histograma de deriva. NUNCA aborta: un `miss` (feature ausente) es DATO (candidato a
 * divergencia real), no un fallo del arnés.
 */
async function resyncToAnchor(page: Page, anchor: FaceAnchor, log: string[]): Promise<AnchorOutcome> {
  const pos = await getPos(page);
  // sólo small maps (1..32): en overworld el grid es 256×256 y los looks de terreno no son
  // features de interior; el resync grueso lo da la costura de entrada/salida del segmento.
  if (pos.location === 0) {
    log.push(`anchor '${anchor.sees}': skip (overworld, sin resync fino)`);
    return { status: "skip", drift: 0 };
  }
  // RECONCILIACIÓN DE RELOJ para anclas hora-dependientes (verja nocturna TOWN 0x0170): si la
  // banda del reloj vivo ≠ banda del ancla, el grid COMPUESTO (activeMap.tileAt con hourTiles)
  // pintaría el tile de la hora EQUIVOCADA → falso anchor-miss por DERIVA DE RELOJ, no de
  // posición. Se nudge el reloj a la hora canónica de la banda (sancionado, clase entryClock)
  // y se refresca la capa horaria antes de leer el grid.
  if (anchor.hourBand) {
    const hour = await page.evaluate(
      () => (window as unknown as { __u5test: { game: { state: { time: { hour: number } } } } }).__u5test.game.state.time.hour,
    );
    if (!bandMatches(hour, anchor)) {
      const h = bandCanonicalHour(anchor.hourBand);
      await page.evaluate((hh) => {
        const g = (window as unknown as { __u5test: { game: { state: { time: { hour: number } }; refreshHourTiles?: () => void } } }).__u5test.game;
        g.state.time.hour = hh;
        g.refreshHourTiles?.();
      }, h);
      await page.waitForTimeout(60);
      log.push(`anchor '${anchor.sees}': reloj reconciliado ${hour}:00→${h}:00 (banda ${anchor.hourBand}) para el grid compuesto`);
    }
  }
  const snap = await gridSnapshot(page);
  const res = resolveFaceAnchor(snap, anchor, { x: pos.x, y: pos.y }, { standable: standableTile });
  if (res.status === "miss") {
    // FALLBACK MULTI-PLANTA (b): la feature del LP puede vivir en OTRA planta del edificio
    // (bookshelf/rug del castillo LB = f2; sótanos z=-1). Se resuelve contra los grids
    // ESTÁTICOS de TODAS las plantas (world.smallMaps, misma fuente que loadSmallMap) —
    // suficiente para features de interior hora-INdependientes; la reconciliación horaria
    // de arriba ya cubrió la planta actual compuesta.
    const floors = await floorSnapshots(page, pos.location);
    const mf = resolveFaceAnchorAcrossFloors(floors, anchor, { x: pos.x, y: pos.y }, pos.floor, { standable: standableTile });
    if (mf.status === "resolved" && mf.cell && mf.floor !== undefined) {
      const cell = mf.cell;
      await teleportSmall(page, pos.location, mf.floor, cell.x, cell.y);
      await page.waitForTimeout(120);
      const floorMsg = mf.floor !== pos.floor ? ` [planta ${pos.floor}→${mf.floor}]` : "";
      log.push(`RESYNC '${anchor.sees}' ${pos.x},${pos.y}→${cell.x},${cell.y}${floorMsg} (deriva=${mf.drift ?? 0}, multi-planta)`);
      return { status: "resolved-jump", drift: mf.drift ?? 0 };
    }
    if (mf.status === "ambiguous") {
      log.push(`anchor-ambiguo '${anchor.sees}' (${mf.candidates} candidatas, multi-planta) — resync declinado`);
      return { status: "ambiguous", drift: 0 };
    }
    // FALLBACK CAPA DE OBJETOS: features que NO son tile del grid (la ALFOMBRA plot «an odd
    // rug» = Carpet2 283, cofres de interior) viven en state.worldObjects. El mirador es la
    // celda opuesta a dir; pisabilidad validada contra el grid estático de su planta.
    const objs = await liveObjects(page, pos.location);
    const byFloor = new Map(floors.map((f) => [f.z, f.snap]));
    const objCands = objectFaceCandidates(objs, anchor.tileIds, anchor.dir).filter((c) => {
      const s = byFloor.get(c.floor);
      const t = s?.grid[c.cell.y]?.[c.cell.x];
      return t !== undefined && standableTile(t);
    });
    if (objCands.length > 0 && objCands.length <= 4) {
      objCands.sort(
        (a, b) =>
          Number(a.floor !== pos.floor) - Number(b.floor !== pos.floor) ||
          Math.abs(a.cell.x - pos.x) + Math.abs(a.cell.y - pos.y) - (Math.abs(b.cell.x - pos.x) + Math.abs(b.cell.y - pos.y)),
      );
      const c = objCands[0]!;
      const drift = Math.abs(c.cell.x - pos.x) + Math.abs(c.cell.y - pos.y);
      await teleportSmall(page, pos.location, c.floor, c.cell.x, c.cell.y);
      await page.waitForTimeout(120);
      const floorMsg = c.floor !== pos.floor ? ` [planta ${pos.floor}→${c.floor}]` : "";
      log.push(`RESYNC '${anchor.sees}' ${pos.x},${pos.y}→${c.cell.x},${c.cell.y}${floorMsg} (deriva=${drift}, capa-objetos)`);
      return { status: "resolved-jump", drift };
    }
    if (objCands.length > 4) {
      log.push(`anchor-ambiguo '${anchor.sees}' (${objCands.length} candidatas, capa-objetos) — resync declinado`);
      return { status: "ambiguous", drift: 0 };
    }
    log.push(`ANCHOR-MISS '${anchor.sees}' dir=${anchor.dir} @loc${pos.location} — feature AUSENTE en TODAS las plantas del mapa vivo Y en la capa de objetos (candidato a divergencia del port)`);
    return { status: "miss", drift: 0 };
  }
  if (res.status === "ambiguous") {
    log.push(`anchor-ambiguo '${anchor.sees}' (${res.candidates} candidatas) — resync declinado`);
    return { status: "ambiguous", drift: 0 };
  }
  const cell = res.cell!;
  const { jump, drift } = planAnchorResync({ x: pos.x, y: pos.y }, cell);
  if (!jump) {
    log.push(`anchor '${anchor.sees}' ya alineado en ${cell.x},${cell.y} (deriva=0)`);
    return { status: "resolved-hold", drift: 0 };
  }
  await page.evaluate(
    ({ loc, floor, x, y }) => {
      (window as unknown as { __u5debug?: { teleportSmallMap?: (l: number, f: number, x: number, y: number) => void } }).__u5debug?.teleportSmallMap?.(loc, floor, x, y);
    },
    { loc: pos.location, floor: pos.floor, x: cell.x, y: cell.y },
  );
  await page.waitForTimeout(120);
  log.push(`RESYNC '${anchor.sees}' ${pos.x},${pos.y}→${cell.x},${cell.y} (deriva=${drift})`);
  return { status: "resolved-jump", drift };
}

/** Grids ESTÁTICOS de todas las plantas de la location (world.smallMaps → floors[].tiles,
 *  la MISMA fuente que loadSmallMap; z puede ser negativo = sótano). Para el fallback
 *  multi-planta del resync de anclas de cara. Tiles BASE (sin capa horaria/puertas):
 *  suficiente para features estáticas de interior (estufa/barril/bookshelf/rug). */
async function floorSnapshots(page: Page, loc: number): Promise<FloorGrid[]> {
  return page.evaluate((l) => {
    const g = (
      window as unknown as {
        __u5test: { game: { world?: { smallMaps?: Map<number, { floors: Array<{ z: number; tiles: number[][] }> }> } } };
      }
    ).__u5test.game;
    const smd = g.world?.smallMaps?.get?.(l);
    if (!smd) return [];
    return smd.floors.map((f) => ({
      z: f.z,
      snap: { W: f.tiles[0]?.length ?? 0, H: f.tiles.length, grid: f.tiles },
    }));
  }, loc);
}

/** Objetos vivos de la capa worldObjects de una location (todas las plantas). */
async function liveObjects(page: Page, loc: number): Promise<ObjLive[]> {
  return page.evaluate((l) => {
    const s = (
      window as unknown as {
        __u5test: { game: { state: { worldObjects?: Array<{ location: number; floor: number; x: number; y: number; tile: number }> } } };
      }
    ).__u5test.game.state;
    return (s.worldObjects ?? [])
      .filter((o) => o.location === l)
      .map((o) => ({ x: o.x, y: o.y, tile: o.tile, floor: o.floor }));
  }, loc);
}

/** NPCs vivos del mapa actual (npcsAt) proyectados a NpcLive. El `type` viaja como token
 *  casable "t<N> ai<a,b,c> d<N>" para que el `match` del ancla (derivado del beat) apunte por
 *  tipo de sprite, comportamiento (AI de extorsión = guardia de peaje) o diálogo. */
async function liveNpcs(page: Page): Promise<NpcLive[]> {
  return page.evaluate(() => {
    const g = (
      window as unknown as {
        __u5test: {
          game: {
            npcManager?: { npcsAt: (l: number, f: number) => Array<{ x: number; y: number; type: number; aiTypes: number[]; dialogNumber: number }> };
            state: { position: { location: number; floor: number } };
          };
        };
      }
    ).__u5test.game;
    const p = g.state.position;
    // MULTI-PLANTA: barre floors 0..4 (mercaderes de plantas altas — el guild de New Magincia vive
    // en f1, no en f0 donde está la tabernera). Cada NPC lleva su `floor` para que el resync
    // teleporte a la planta correcta, y su `dialogNumber` para casar por shopType.
    const out: NpcLive[] = [];
    for (let f = 0; f < 5; f++) {
      let list: Array<{ x: number; y: number; type: number; aiTypes: number[]; dialogNumber: number }> = [];
      try {
        list = g.npcManager?.npcsAt(p.location, f) ?? [];
      } catch {
        list = [];
      }
      for (const n of list) out.push({ x: n.x, y: n.y, type: `t${n.type} ai${n.aiTypes.join(",")} d${n.dialogNumber}`, dialogNumber: n.dialogNumber, floor: f });
    }
    return out;
  });
}

/**
 * TECLA DE SALIDA del diálogo de tienda POR FASE, leída del despacho de
 * `src/ui/shop-console.ts:1250-1411` (que cita a su vez los `getkey` del binario). No hay
 * una tecla universal: las fases de Y/N **RE-LEEN** Space y ESC.
 *
 *  · PAUSAS (`blacksmith-pause` 0x83dc · `buy-full-pause` 0x0a73 · `reagent-full-pause`
 *    0x557): el getkey DESCARTA la tecla y avanza. Escape sirve, y la fase RESULTANTE se
 *    cierra en la vuelta siguiente del bucle (el herrero necesita 2 teclas: pausa → menú).
 *  · Y/N (`greet-yn`, `healer-again`, `inn-again`, los `*-deal`, `tavern-again`,
 *    `ship-take`, `ship-else`, `inn-rest-take`, `inn-leave-take`, `healer-pay`): el getkey
 *    del binario re-lee TODO lo que no sea Y/N — Space y ESC incluidos. Sale la 'n'.
 *  · `healer-need` (0x1550-0x1568): acepta C/H/R/Space/CR; Space = «nothing» + despedida.
 *  · RESTO (menús y listas): gate global `raw === " " || raw === "Escape"` → `leave()`.
 */
const SHOP_EXIT_KEY: Record<string, string> = {
  "blacksmith-pause": "Escape",
  "buy-full-pause": "Escape",
  "reagent-full-pause": "Escape",
  "greet-yn": "n",
  "healer-again": "n",
  "inn-again": "n",
  "buy-deal": "n",
  "sell-deal": "n",
  "reagent-deal": "n",
  "guild-deal": "n",
  "horse-deal": "n",
  "tavern-again": "n",
  "ship-take": "n",
  "ship-else": "n",
  "inn-rest-take": "n",
  "inn-leave-take": "n",
  "healer-pay": "n",
  "healer-need": " ",
};
const SHOP_EXIT_DEFAULT = "Escape"; // menús y listas: gate global de `leave()`

/**
 * ★★ CIERRA el diálogo de tienda que el (T)alk de VERIFICACIÓN del ancla dejó ABIERTO.
 *
 * Sin esto el diálogo se queda vivo y **se traga el resto del guion del segmento**: medido en
 * `part09-g10` (acta `anclas-lp1-acta.md` §5.4-bis), donde el ancla nº12 cae en el op[1] y los
 * ~88 ops siguientes caen DENTRO del menú de compra — el port deja de emitir un solo
 * `Open-`/`Look-` en todo el segmento (154 → 0 ocurrencias de material de mapa) y el segmento
 * pierde 12 bloques casados. Es el modo de fallo que el comentario del Talk documenta AL REVÉS:
 * allí las teclas de compra caían sobre el mapa; aquí las de mapa caen sobre la tienda.
 *
 * DOS guardas, y ninguna es decorado:
 *  · **cada tecla va precedida de la lectura de `shopOpen`** (hook read-only). Con el diálogo
 *    cerrado se pulsan CERO teclas — que es lo que hace inocuo el cierre en el camino del
 *    `miss`/`skip`. Pulsar a ciegas NO es inocuo: la 'n' sobre el mapa es (N)ew Order
 *    (`main.ts:4297`) y abre un picker de miembro que se traga las teclas siguientes.
 *  · **presupuesto de 4 teclas**: si no cierra, se DECLARA en el log y se sigue (una parte no
 *    se cuelga por una tienda rara).
 *
 * Coste: 0 turnos y 0 reloj — `endShopConsole` (`src/main.ts:2309`) sólo suelta el prompt. Sí
 * consume el rand 1-de-4 de la despedida (0x0202), el mismo que consumiría el guion al salir.
 */
export async function closeShopDialog(page: Page, etiqueta: string, log: string[], presupuesto = 4): Promise<string[]> {
  const pulsadas: string[] = [];
  for (let i = 0; i < presupuesto; i++) {
    const fase = await page.evaluate(() => {
      const t = (window as unknown as { __u5test?: { shopOpen?: () => boolean; shopConsole?: () => { phase?: string } | null } }).__u5test;
      if (!t?.shopOpen?.()) return null; // cerrado (o nunca abierto): nada que pulsar
      return t.shopConsole?.()?.phase ?? "";
    });
    if (fase === null) break;
    const tecla = SHOP_EXIT_KEY[fase] ?? SHOP_EXIT_DEFAULT;
    pulsadas.push(tecla);
    await pressKey(page, tecla, 150);
  }
  const sigueAbierto = await page.evaluate(() =>
    Boolean((window as unknown as { __u5test?: { shopOpen?: () => boolean } }).__u5test?.shopOpen?.()),
  );
  if (sigueAbierto) {
    log.push(`SHOP-CLOSE '${etiqueta}' NO cerró el diálogo tras ${pulsadas.length} teclas [${pulsadas.join(",")}] — los ops siguientes del guion caerán DENTRO de la tienda`);
  } else if (pulsadas.length > 0) {
    log.push(`SHOP-CLOSE '${etiqueta}' diálogo cerrado con [${pulsadas.join(",")}] — el guion sigue sobre el MAPA`);
  }
  return pulsadas;
}

/**
 * ★ SONDA DE DIAGNÓSTICO `U5_ESPEJO_SONDA_ANCLA=1` — apagada por defecto, **read-only**.
 *
 * Contesta la pregunta que `poblar-deltas-acta.md` §5 dejó sin elegir para el ancla del herrero
 * de Minoc: cuando el (T)alk del ancla no engancha la tienda, ¿es que `npcAt` no encuentra al
 * mercader en la celda (hipótesis A) o que el `dialogNumber` que ve ahí no es de tienda
 * (hipótesis B)? La sonda declara, en el instante INMEDIATAMENTE ANTERIOR al primer `t` y sobre
 * la celda EXACTA a la que apuntará la dirección del Talk:
 *   · la **hora** del reloj de juego (el mecanismo de la celda compartida sólo tapa al mercader
 *     en 5 horas de las 10 en las que está en 27,26 — `re/notes/ancla-herrero-preregistro.md` §1),
 *   · lo que devuelve **`npcAt`** ahí (slot + dialogNumber) — la MISMA llamada que hace
 *     `startTalk` (`src/main.ts:2406`), no una reimplementación,
 *   · **todos** los ocupantes de esa celda con su slot, que es donde se ve el apilamiento,
 *   · y el **transporte** de la party: la guarda #170 (`tryTalkMountedMerchant`,
 *     `src/core/game.ts:4609`, TALK.OVL 0x00f0) hace que un mercader VÁLIDO y SOLO en su celda
 *     no abra tienda si la party va montada. Es la tercera rama, y sin este campo el diagnóstico
 *     se queda en «el mercader está y aun así no engancha».
 *
 * ★★ SUMIDEROS VIVOS (carril `tercera-rama`, ficha AH-1). Los campos de arriba miden EL MUNDO;
 * si el mundo está bien y la tienda no abre, la `t` no llegó al despachador de mapa — y eso lo
 * decide `handleGameKey`, no `npcAt`. Por eso la sonda declara además `inputSinks()` (el MISMO
 * hook read-only que ya usa la espera de costura): el `prompt` vivo, los pacers y los bucles
 * que se quedan el teclado. Es el campo que adjudica la clase de fallo, porque el `Escape ×2`
 * de la limpieza pre-Talk **no cierra un `yesno` de Flow 2** (`prompt-manager.ts:210-213`: el
 * ESC sólo resuelve `yesno-esc`; en `yesno` se ignora y la tecla se CONSUME) — tributo de
 * guardia y arresto son de esa clase, y el runner no los resuelve, sólo los clasifica.
 *
 * NO cambia conducta: `page.evaluate` sobre `__u5test.game` (ya expuesto, ya usado por
 * `liveNpcs`), cero teclas, cero turnos, cero rand. Con la env var apagada ni siquiera se llama
 * al navegador.
 */
async function sondaAncla(
  page: Page,
  etiqueta: string,
  party: { x: number; y: number },
  celdaNpc: { x: number; y: number },
  log: string[],
): Promise<void> {
  if (process.env.U5_ESPEJO_SONDA_ANCLA !== "1") return;
  const d = await page.evaluate(
    ({ tx, ty }) => {
      const g = (
        window as unknown as {
          __u5test?: {
            game?: {
              npcManager?: {
                npcAt: (l: number, f: number, x: number, y: number) => { slot: number; dialogNumber: number } | null;
                npcsAt: (l: number, f: number) => Array<{ slot: number; x: number; y: number; dialogNumber: number; aiTypes: number[] }>;
              };
              state?: { position: { location: number; floor: number; x: number; y: number }; time: { hour: number; minute: number }; transportTile?: number };
            };
          };
        }
      ).__u5test?.game;
      const p = g?.state?.position;
      if (!g || !p || !g.npcManager) return null;
      const hit = g.npcManager.npcAt(p.location, p.floor, tx, ty);
      const celda = g.npcManager
        .npcsAt(p.location, p.floor)
        .filter((n) => n.x === tx && n.y === ty)
        .map((n) => ({ slot: n.slot, dlg: n.dialogNumber }));
      const transporte = g.state!.transportTile ?? 0;
      return { loc: p.location, floor: p.floor, px: p.x, py: p.y, hour: g.state!.time.hour, minute: g.state!.time.minute, transporte, montado: (transporte & 0xfe) === 0x12, hit: hit ? { slot: hit.slot, dlg: hit.dialogNumber } : null, celda };
    },
    { tx: celdaNpc.x, ty: celdaNpc.y },
  );
  if (!d) {
    log.push(`SONDA-ANCLA '${etiqueta}' — 🔴 hooks no disponibles (__u5test.game/npcManager): la sonda NO midió`);
    return;
  }
  const quien = d.hit ? `slot ${d.hit.slot} dlg 0x${d.hit.dlg.toString(16)}` : "NULL (celda vacía)";
  const pila = d.celda.map((o) => `slot ${o.slot} dlg 0x${o.dlg.toString(16)}`).join(" | ") || "(vacía)";
  // Sumideros VIVOS en el MISMO instante (read-only, hook ya existente). Sólo se nombran los
  // que están puestos: en mapa limpio la coletilla es «sumideros: (ninguno)».
  const sinks = await inputSinks(page);
  const vivos = Object.entries(sinks)
    .filter(([, v]) => v !== false && v !== null && v !== undefined)
    .map(([k, v]) => (v === true ? k : `${k}=${String(v)}`));
  log.push(
    `SONDA-ANCLA '${etiqueta}' loc${d.loc} planta${d.floor} reloj ${String(d.hour).padStart(2, "0")}:${String(d.minute).padStart(2, "0")} · party ${d.px},${d.py} (esperada ${party.x},${party.y}) · Talk apunta a ${celdaNpc.x},${celdaNpc.y} · npcAt→ ${quien} · ocupantes: ${pila} · transporte 0x${d.transporte.toString(16)}${d.montado ? " 🐴 MONTADO (guarda #170: el mercader NO atiende a caballo salvo HorseSeller 0x83)" : ""} · sumideros: ${vivos.length ? vivos.join(", ") : "(ninguno)"}${sinks.prompt === "yesno" ? " 🔴 yesno de Flow 2: el Escape ×2 NO lo cierra y se traga la t y la flecha" : ""}`,
  );
}

/** RESYNC de ANCLA-NPC: planta la party en la celda PISABLE adyacente al NPC vivo que casa
 *  `match` (guardia de peaje / mercader), para que el beat de transacción DISPARE (peaje,
 *  compra) y el ledger cobre vida. Gemela de resyncToAnchor; NPC-ANCHOR-MISS = el NPC del LP
 *  no está (beat no alcanzado / divergencia real, no se fabrica la transacción). */
export async function resyncToNpcAnchor(
  page: Page,
  anchor: NpcAnchor,
  log: string[],
  /** ★ F-A3 — dirección del (T)alk QUE TRAE EL GUION (la tecla-flecha que pulsó el humano).
   *  Sin ella la conducta es la histórica: celda adyacente más cercana al replay. */
  preferDir?: Dir4,
): Promise<AnchorOutcome> {
  const pos = await getPos(page);
  if (pos.location === 0) {
    log.push(`npc-anchor '${anchor.match}': skip (overworld, sin resync fino)`);
    return { status: "skip", drift: 0 };
  }
  const npcs = await liveNpcs(page); // TODAS las plantas
  // Fase 1: identifica el NPC (por shopType/match) y su PLANTA — SIN snap (el NPC puede estar en
  // otra planta cuyo grid aún no es leíble; `activeMap` es la planta actual de la party).
  const pick = resolveNpcAnchor(npcs, anchor, { x: pos.x, y: pos.y });
  if (pick.status === "miss") {
    log.push(`NPC-ANCHOR-MISS '${anchor.match}' @loc${pos.location} — NPC ausente en el mapa vivo (beat no alcanzado / divergencia)`);
    return { status: "miss", drift: 0 };
  }
  if (pick.status === "ambiguous") {
    log.push(`npc-anchor-ambiguo '${anchor.match}' (${pick.candidates} NPCs) — resync declinado`);
    return { status: "ambiguous", drift: 0 };
  }
  const npcFloor = pick.npcFloor ?? pos.floor;
  const npcCell = pick.npcCell!;
  // ★★ Fase 2: TELEPORT DE SONDEO, y RE-LECTURA de los NPC DESPUÉS de él.
  //
  // El teleport pasa por `__u5debug.teleportSmallMap`, que llama a `npcManager.enterMap`
  // (`src/debug/debugApi.ts:337`), y `enterMap` RECONSTRUYE cada NPC en su celda de HORARIO
  // (`src/core/npc/manager.ts:186-199`: `x: s.x[idx], y: s.y[idx]`), descartando la posición a
  // la que hubiera derivado por wander o por un cambio de tramo de horario. O sea: el teleport
  // INVALIDA la lectura de `liveNpcs` que hay arriba. Cuando la party se plantaba adyacente a
  // la celda LEÍDA, aterrizaba junto a una celda que el propio teleport acababa de vaciar, el
  // (T)alk caía al aire («Funny, no response!» en el transcript del port) y `shopOpen()` salía
  // falso: eso era el 100 % de los `ANCHOR-MISS` del corpus AD (ventana `anclas-f4`).
  //
  // El teleport de sondeo va SIEMPRE, aunque la planta no cambie: lo que hace falta no es
  // cambiar de planta, es que la lectura de abajo sea la de DESPUÉS del reset. Es idempotente
  // (`enterMap` sólo depende de location + hora + npcDead), así que el teleport final deja a
  // los NPC exactamente donde los vio esta lectura.
  await teleportSmall(page, pos.location, npcFloor, pos.x, pos.y);
  await page.waitForTimeout(80);
  const snap = await gridSnapshot(page); // ahora activeMap = planta del NPC
  const npcsTrasReset = await liveNpcs(page); // lectura AUTORITATIVA: post-enterMap
  const res = resolveNpcAnchor(
    npcsTrasReset.filter((n) => (n.floor ?? npcFloor) === npcFloor),
    anchor,
    { x: npcCell.x, y: npcCell.y },
    { snap, standable: standableTile, ...(preferDir ? { preferDir } : {}) },
  );
  // La celda del NPC que manda es la de la RE-LECTURA (`npcCell` de arriba es la que el
  // teleport invalidó): de ella salen tanto la celda donde plantarse como la DIRECCIÓN del Talk.
  const npcCellReal = res.npcCell ?? npcCell;
  const cell = res.cell ?? { x: npcCellReal.x, y: npcCellReal.y - 1 };
  await teleportSmall(page, pos.location, npcFloor, cell.x, cell.y);
  await page.waitForTimeout(120);
  const floorMsg = npcFloor !== pos.floor ? ` [planta ${pos.floor}→${npcFloor}]` : "";
  const movidoMsg =
    npcCellReal.x !== npcCell.x || npcCellReal.y !== npcCell.y
      ? ` [el NPC estaba en ${npcCell.x},${npcCell.y} y el enterMap del teleport lo devolvió a su puesto]`
      : "";
  const dirMsg = !preferDir
    ? ""
    : res.dirPedidaNoPisable
      ? ` [guion pedía t+${preferDir} pero esa celda NO es pisable — se cae a la más cercana]`
      : ` [celda del GUION: t+${preferDir}]`;
  log.push(`NPC-RESYNC '${anchor.match}' ${pos.x},${pos.y}→${cell.x},${cell.y}${floorMsg} (adyacente a NPC ${npcCellReal.x},${npcCellReal.y})${movidoMsg}${dirMsg}`);
  // ABRE el diálogo de transacción con un (T)alk hacia el NPC. El resync sólo PLANTA la party
  // ADYACENTE; sin este Talk las teclas de compra/venta del guion caen sobre el MAPA → la
  // transacción no dispara y el ledger mide delta 0. Sólo cmds de diálogo (buy/sell/talk); un
  // peaje de guardia no se abre con Talk. Dirección = party→NPC.
  if (/^(buy|sell|talk)$/i.test(anchor.cmd)) {
    // ★ F-A3 — la fórmula vive en `anchors.ts` (`dirFromCellToNpc`) y la comparten el chooser de
    // celda y este emisor de tecla: si divergieran, el arnés se plantaría en un sitio y hablaría
    // hacia otro. Antes había aquí una copia literal.
    // `let` y no `const`: la verificación EN EL INSTANTE DE PULSAR (dentro del bucle de
    // intentos, ficha E2) puede re-derivar celda y dirección si el NPC wandereó entre tanto.
    let cellViva = cell;
    let npcViva = npcCellReal;
    let dir = dirFromCellToNpc(cellViva, npcViva);
    // LIMPIEZA PRE-TALK: bajo deriva, los `typed` de conversaciones NO-conectadas caen en el
    // mapa como comandos y dejan MODOS VIVOS (getstring de Yell «Yell what?», picker de Ready
    // «Item:», party-select…) que se TRAGAN la 't' — evidencia del run part05: «Yell what?
    // :EARS» y «Item:» alrededor del beat del guild con delta 0 pese al Talk. Escape ×2 los
    // cierra; en mapa limpio es no-op/«Cancelled.» (cero estado de juego).
    //
    // ★★ Pero un `yesno` de Flow 2 (tributo de guardia / arresto / getYN) IGNORA el Escape y
    // CONSUME la tecla: hay que CONTESTARLO o los dos Escape, la 't' y la flecha se los traga
    // él — la ficha AH-1 (`ad04-g34` `shop:MagicSeller`) era exactamente eso, y la sonda no lo
    // veía porque `npcAt` se lee por `page.evaluate`, no por tecla. Va ANTES del Escape ×2, y
    // ANTES del `ledgerArm` del bucle de ops, así que el oro del tributo NO entra en ningún
    // delta armado. Ver `resolveBlockingYesNo`.
    // ★★ PIEZA 1 DE 2 DEL ARREGLO DE LA FICHA #12 — CIERRA LA CONSOLA DE TIENDA **RANCIA**.
    //
    // Nace de una medición, no de una historia: en `ad06-g34` la consola del CURANDERO —abierta
    // por la tecla `t` del PROPIO op del ancla de saludo anterior, que corre DESPUÉS del
    // `closeShopDialog` de esa ancla— sigue viva 43 teclas después y se traga entero el bloque de
    // venta del herrero (0 teclas de 140 llegan a `sell-list`/`sell-deal`). Intervención dirigida
    // medida: delta `+220` → `0`, con `part04-g03` byte-idéntico como control negativo.
    //
    // Rancia por CONSTRUCCIÓN: aquí el resync ya ha teleportado la party a otra celda y el Talk de
    // esta ancla todavía no ha corrido, así que cualquier consola viva en este instante es de
    // ANTES del salto. La suya la abre el Talk de abajo.
    const rancia = await page.evaluate(
      () =>
        (window as unknown as { __u5test?: { shopConsole?: () => { type?: string } | null } }).__u5test?.shopConsole?.()
          ?.type ?? null,
    );
    if (rancia) {
      log.push(`SHOP-RANCIA '${rancia}' viva ANTES del Talk de '${anchor.match}' — se cierra`);
      await closeShopDialog(page, `RANCIA:${rancia}`, log);
    }
    await resolveBlockingYesNo(page, log);
    await pressKey(page, "Escape", 150);
    await pressKey(page, "Escape", 150);
    // Una charla colgada ya no muere con ESC (kernel 0x3b1c): la 't' de abajo caería
    // DENTRO de su buffer. Se drena con Enter vacío ANTES (mismo helper que la purga).
    await drainConversationGetstring(page, log);
    const isShop = anchorIsShop(anchor);
    // TIPO de tienda que el ancla PIDE. Vacío cuando el match no lo dice (`d129`, dialogNumber
    // exacto): ahí no hay tipo que exigir y el predicado cae al `shopOpen()` de siempre — la
    // exención está APLICADA en el `||` de abajo, no sólo declarada aquí.
    const pedido = anchor.match.toLowerCase().startsWith("shop:") ? anchor.match.slice(5) : "";
    await sondaAncla(page, anchor.match, cell, { x: npcCellReal.x, y: npcCellReal.y }, log);
    let engaged = false;
    /** lo último que se LEYÓ del mundo, para que el mensaje del miss pueda nombrar el motivo. */
    let ultimoVivo: { abierta: boolean; tipo: string | null } = { abierta: false, tipo: null };
    for (let attempt = 0; attempt < 2 && !engaged; attempt++) {
      // ★★ FICHA E2 (espejo-auditor 21-08) — LA ADYACENCIA SE VERIFICA EN EL INSTANTE DE
      // PULSAR, no en el del resync. Entre la lectura autoritativa de la Fase 2 y esta 't'
      // corren teclas que CONSUMEN TURNO (el cierre de la consola RANCIA, el 'y' del tributo
      // de `resolveBlockingYesNo`, y en el 2º intento el Talk fallido y su Escape), y cada
      // turno consumido corre npc_tick_all (`game.ts` townTurn → afterHousekeeping →
      // `tickNpcs`): un mercader con AI de wander puede ya no estar en `npcCellReal` cuando
      // la 't' sale — el resync cantaba verde y el Talk caía al aire («Funny, no response!»),
      // y las teclas de la transacción median deltas falsos. La re-lectura va AQUÍ, pegada a
      // la tecla: entre ella y la 't' no entra ninguna otra tecla.
      const frescos = (await liveNpcs(page)).filter((n) => (n.floor ?? npcFloor) === npcFloor);
      const resAhora = resolveNpcAnchor(frescos, anchor, { x: npcViva.x, y: npcViva.y }, { snap, standable: standableTile, ...(preferDir ? { preferDir } : {}) });
      if (resAhora.npcCell && (resAhora.npcCell.x !== npcViva.x || resAhora.npcCell.y !== npcViva.y)) {
        const desviado = resAhora.npcCell;
        // Teleport correctivo: por la MISMA física de la Fase 2 (`teleportSmallMap` →
        // `enterMap`), devuelve a los NPC a su celda de HORARIO — y se RE-LEE tras él (un
        // turno consumido pudo cruzar de tramo horario y mover el puesto del mercader).
        await teleportSmall(page, pos.location, npcFloor, cellViva.x, cellViva.y);
        await page.waitForTimeout(80);
        const tras = (await liveNpcs(page)).filter((n) => (n.floor ?? npcFloor) === npcFloor);
        const resTras = resolveNpcAnchor(tras, anchor, { x: npcViva.x, y: npcViva.y }, { snap, standable: standableTile, ...(preferDir ? { preferDir } : {}) });
        if (resTras.status === "resolved" && resTras.npcCell) {
          npcViva = resTras.npcCell;
          const nueva = resTras.cell ?? cellViva;
          if (nueva.x !== cellViva.x || nueva.y !== cellViva.y) {
            cellViva = nueva;
            await teleportSmall(page, pos.location, npcFloor, cellViva.x, cellViva.y);
            await page.waitForTimeout(80);
          }
          dir = dirFromCellToNpc(cellViva, npcViva);
        }
        log.push(
          `NPC-PRESS-RESYNC '${anchor.match}' intento ${attempt + 1}: el NPC había derivado a ${desviado.x},${desviado.y} tras las teclas de limpieza (turnos consumidos → wander) — teleport correctivo, el Talk apunta a ${npcViva.x},${npcViva.y} desde ${cellViva.x},${cellViva.y}`,
        );
      }
      await pressKey(page, "t");
      await pressKey(page, ARROW[dir]!);
      await page.waitForTimeout(400); // el saludo del mercader tarda en pintarse; sin este settle
      //                                 la 1ª tecla de compra cae antes de que el diálogo esté listo.
      if (!isShop) {
        engaged = true; // conversación normal: sin hook de verificación, un intento
        break;
      }
      // VERIFICACIÓN: ¿la tienda ENGANCHÓ? (hook read-only del arnés). Sin esto las teclas
      // de compra caen al mapa y el ledger mide 0 en silencio.
      //
      // ★★ PIEZA 2 DE 2 — EL PREDICADO COMPARA EL **TIPO**, NO SÓLO «¿HAY ALGUNA ABIERTA?».
      //
      // Lo de antes era `engaged = shopOpen()`, y `shopOpen()` es `shopConsole != null`: un gate
      // SIN DIENTES que no puede distinguir la tienda pedida de cualquier otra. Con la consola del
      // curandero viva, `ad06-g34` cantaba `[shopOpen✓]` mientras el herrero no había abierto —
      // y el `0` de su ledger se contó como divergencia de FIDELIDAD DEL PORT durante toda la
      // ficha #12. No lo era: el port vende bien en cuanto se le pide.
      //
      // 🔴 Esto DESTAPA anclas que hoy salen en verde falso: pasan a `NPC-ANCHOR-MISS` ruidosas.
      // Es lo que se quiere (un miss lo cuenta el arnés; un verde falso se publica como deuda),
      // y la cifra pre/post está medida sobre las 49 partes en `ad06-teclas-acta.md` §9/§10.
      const vivo = await page.evaluate(() => {
        const t = (
          window as unknown as { __u5test?: { shopOpen?: () => boolean; shopConsole?: () => { type?: string } | null } }
        ).__u5test;
        return { abierta: Boolean(t?.shopOpen?.()), tipo: t?.shopConsole?.()?.type ?? null };
      });
      ultimoVivo = vivo;
      const casa = pedido !== "" && (vivo.tipo ?? "").toLowerCase() === pedido.toLowerCase();
      engaged = vivo.abierta && (pedido === "" || casa);
      // ★ CENSO `U5_TECLAS_CENSO=1` (carril `ad06-teclas`, ficha #12) — PURA OBSERVACIÓN: declara
      // al lado qué tienda hay viva de verdad, sin tocar `engaged`. Es el instrumento que produjo
      // la cifra PRE-fix, y el mismo que produce la POST: si cambiase entre las dos, las dos
      // cifras no serían comparables. El `page.evaluate` es el de la verificación (una sola ida y
      // vuelta): el censo no añade round-trips, así que no desplaza el pacing de las teclas.
      if (process.env.U5_TECLAS_CENSO === "1") {
        // `SIN-TIPO` / `NINGUNA` en vez de paréntesis con espacios: la línea la parsea
        // `censo_anclas.mjs` por tokens, y un valor con espacio rompería el reparto en silencio.
        const veredicto = !vivo.abierta ? "MISS" : pedido === "" ? "SIN-TIPO" : casa ? "OK" : "VERDE-FALSO";
        log.push(
          `CENSO-ANCLA match=${anchor.match} cmd=${anchor.cmd} intento=${attempt + 1} pedido=${pedido || "SIN-TIPO"} vivo=${vivo.tipo ?? "NINGUNA"} veredicto=${veredicto}`,
        );
      }
      if (!engaged) await pressKey(page, "Escape", 150); // limpia el residuo y reintenta
    }
    if (isShop && !engaged) {
      // El motivo se NOMBRA: «no abrió NINGUNA» y «abrió OTRA» son dos fallos distintos, y el
      // segundo es el que hasta ahora salía en verde. Un miss sin motivo obliga a re-investigar.
      const motivo = ultimoVivo.abierta
        ? `enganchó OTRA tienda ('${ultimoVivo.tipo ?? "?"}' viva, se pedía '${pedido}')`
        : "shopOpen=false";
      log.push(`NPC-TALK '${anchor.match}' t+${dir} NO enganchó la tienda (${motivo}, tras 2 intentos) — las teclas de compra NO se fabricarán sobre el mapa`);
      return { status: "miss", drift: pick.drift ?? 0 };
    }
    log.push(`NPC-TALK '${anchor.match}' t+${dir} → abre diálogo de transacción (mercader/guild)${isShop ? " [shopOpen✓]" : ""}`);
    // ★★ CIERRE del diálogo que este Talk acaba de abrir — SÓLO en las anclas de SALUDO.
    //
    // La partición del corpus es limpia y está censada (`censo_anclas_f4.mjs`): de las 69 anclas
    // NPC de los dos corpus, 66 son `cmd:"talk"` SIN `expectDelta` (el ancla deriva del bloque de
    // saludo del LP y su único cometido es que el saludo se EMITA) y 3 son `buy`/`sell` CON
    // `expectDelta` (las de ledger: +36 part04-g03, −954 part05-g05, y la de AD). En las de
    // saludo, todo lo que viene después en el guion es material de MAPA y el diálogo abierto se
    // lo traga (§5.4-bis). En las de transacción pasa lo contrario: las teclas de compra del
    // guion NECESITAN el diálogo abierto, y cerrarlo pondría los deltas del ledger a 0.
    // Por eso el cierre se condiciona al ancla, no al tipo de tienda.
    if (isShop && engaged && anchor.expectDelta == null && /^talk$/i.test(anchor.cmd)) {
      await closeShopDialog(page, anchor.match, log);
    }
  }
  return { status: "resolved-jump", drift: pick.drift ?? 0 };
}

/** Teleport de re-anclaje a (location, floor, x, y) por la costura sancionada cero-rand
 *  `__u5debug.teleportSmallMap` (instrumento de re-sincronización, no afirmación de gameplay). */
async function teleportSmall(page: Page, loc: number, floor: number, x: number, y: number): Promise<void> {
  await page.evaluate(
    ({ loc, floor, x, y }) => {
      (window as unknown as { __u5debug?: { teleportSmallMap?: (l: number, f: number, x: number, y: number) => void } }).__u5debug?.teleportSmallMap?.(loc, floor, x, y);
    },
    { loc, floor, x, y },
  );
}

export interface RunSegmentResult {
  report: SegmentReport;
  portLines: string[];
}

/** Plan de ejecución de un segmento (motor de decisión PURO, testeable offline). Un
 *  segmento marcado `skip:"pendiente-runner"` (interior de mazmorra que el runner AÚN
 *  no reproduce) se ATRAVIESA en modo `nav-only`: se reproduce solo el movimiento (para
 *  no desincronizar la posición de la cadena al cruzarlo) y NO se conduce combate ni se
 *  hace diff/aserción. El resto va en modo `full` (costura + script completo + diff). */
export interface ExecPlan {
  mode: "full" | "nav-only";
  skip?: string;
  resolveCombat: boolean;
  diff: boolean;
  enterSeam: boolean;
  navOps: Op[];
  sceneOps: Op[];
}
export function planSegment(seg: Segment): ExecPlan {
  const navOnly = seg.skip != null;
  return {
    mode: navOnly ? "nav-only" : "full",
    skip: seg.skip,
    resolveCombat: !navOnly,
    diff: !navOnly,
    enterSeam: !navOnly,
    navOps: seg.script.filter((o) => o.nav),
    sceneOps: seg.script.filter((o) => !o.nav),
  };
}

/** Ejecuta un segmento: costura de entrada → script → captura → diff. Si el plan es
 *  nav-only (skip), lo atraviesa sin conducir combate ni asertar (ver planSegment). */
export async function runSegment(
  page: Page,
  seg: Segment,
  opts: {
    stepMs?: number;
    /** FASE 3e-a: acumulador del filtro de localización, propiedad de la PARTE (el presupuesto no
     *  lo da un segmento suelto — ver `DngFilter`). Si no se pasa, el filtro no actúa. */
    dngFilter?: DngFilter;
    /** grid estático de la mazmorra por planta (assets/maps/dungeons.json), para el filtro */
    dngGrid?: (dungeon: number, floor: number) => DngFloorGrid | null;
    /** ★ tarjeta `ad18-g11`: el segmento ANTERIOR abandonó el 3D (`floorUnknown > 0`). Es el ÚNICO
     *  dato con el que una costura de salida puede atribuir su `layer-mismatch` en vez de
     *  afirmar una causa que no observa. Lo rellena la spec, que es quien tiene el report previo. */
    interiorAbandonedBefore?: { abandonedIn: string };
    /** CONDUCIR EL VEHÍCULO (carril `espejo-vuelo`): acumulador de la PARTE. Si no se pasa,
     *  el `v` de la ruta no se conduce y el camino es el histórico, bit a bit. */
    vehiculo?: VehiculoReport;
  } = {},
): Promise<RunSegmentResult> {
  // 95 ms es la cadencia de paso del régimen test; en cine, la humana medida.
  const stepMs = tecla(opts.stepMs ?? 95);
  const plan = planSegment(seg);
  const resyncs: string[] = [];
  /** Conduce el `v` del run ANTES de pisar sus teclas (ver `vehiculo.ts`). No-op sin acumulador. */
  const conduceVehiculo = async (run: NavRun): Promise<void> => {
    const rep = opts.vehiculo;
    if (!rep) return;
    const vivo = await sondaVehiculo(page);
    const planV = decideVehiculo(run.v, vivo, run.m, rep.habilitado);
    acumulaVehiculo(rep, planV);
    if (!planV.aplica) return;
    const ap = await aplicaVehiculo(page, planV, rep.reponInventario);
    acumulaInventario(rep, ap);
    resyncs.push(
      `VEHICULO ${planV.motivo} (v=${run.v}, via=${planV.via}) tile 0x${ap.tileAntes.toString(16)}→0x${ap.tileDespues.toString(16)}` +
        ` carpets ${ap.carpetsAntes}→${ap.carpetsDespues}` +
        ` casco ${ap.hullAntes}→${ap.hullDespues} esquifes ${ap.skiffsAntes}→${ap.skiffsDespues}` +
        (ap.echo.length ? ` eco[${ap.echo.join(" ")}]` : "") +
        (planV.fabricado ? ` · 🔴 FABRICADO: ${planV.fabricado}` : ""),
    );
  };
  let combatRounds = 0;
  let todosSkipped = 0;
  let typedSkipped = 0;
  /** `typed` de eco RÚNICO invertidos a sus pulsaciones antes de teclearlos (declarado en
   *  `resyncs` al cerrar el segmento; no entra al informe para no mover su esquema). */
  let runeEchoTranslated = 0;
  const combatGuard: CombatGuard = { stuck: false }; // guard anti-thrash por segmento
  let txnGoldBefore: number | null = null; // oro justo antes de una transacción anclada
  let txnExpectDelta = 0; // delta esperado de esa transacción (del ancla NPC o del op suelto)
  // llaves y gemas: lectura de partida (puede ser ILEGIBLE = null) + delta esperado
  let txnKeys: { before: number | null; expected: number } | null = null;
  let txnGems: { before: number | null; expected: number } | null = null;
  let skipTxnKeys = false; // ancla-NPC de txn FALLÓ → no fabricar sus teclas sobre el mapa
  /** Desenlace del ancla de la transacción ARMADA (`null` = armada por un op suelto, sin ancla:
   *  peaje/tributo). Lo lee `ledgerTxnVerdict` al cerrar para no acusar al port de una
   *  divergencia cuando la transacción no llegó a conducirse. */
  let txnAnchorStatus: AnchorStatus | null = null;
  const anchorOutcomes: AnchorOutcome[] = [];
  // FASE 3 — interior: ops conducidas, costuras de congelado del errante y rastreo de PLANTA.
  let dngOps = 0;
  let wandererFrozen = 0;
  let interiorLive = false; // ¿la party está DENTRO del 3D? (guarda de las teclas del pasillo)
  // FASE 3e-a — contadores del FILTRO. `filterFed` es la prueba de EJECUCIÓN: si el cableado
  // existiera y no corriera, se quedaría en 0 y el reporte lo delataría (blindado por unit test).
  let filterFed = 0;
  let filterCandidates = 0;
  let filterApplied = 0;
  let filterStatus = "";
  let salaOpsSkipped = 0; // ops 2D/de sala NO conducidas dentro de un interior abierto (declarado)
  const floor: FloorTrack = { expected: null, matches: 0, resyncs: 0, exits: 0 };
  const mark = await accLength(page);
  // ★ carril `ad06-teclas` (ficha #12) — CAPA A del instrumento: lo que el arnés DECIDE hacer
  // con cada op del guion. La capa B (lo que el juego RECIBE) vive en `armKeyLog`. Las dos
  // juntas son las que separan «la tecla no se envió» de «se envió y se la tragó otro
  // sumidero» — distinción que ningún transcript puede hacer. Apagado salvo `U5_TECLAS_SEG`.
  const TEC = process.env.U5_TECLAS_SEG === seg.id || process.env.U5_TECLAS_SEG === "*";
  const tecMark = TEC ? await keyLogLength(page) : 0;
  const tecOps: string[] = [];
  const tec = (linea: string): void => {
    if (TEC) tecOps.push(linea);
  };

  // ---- SKIP: interior de mazmorra pendiente-runner → nav-only, sin diff/combate
  if (plan.mode === "nav-only") {
    resyncs.push(`[SKIP:pendiente-runner] ${seg.skip}: atravesado nav-only (sin diff/combate)`);
    await purgeLiveModes(page, resyncs); // un modo colgado del segmento anterior se comería el nav
    for (const op of seg.script) {
      if (op.nav) {
        for (const run of op.nav) {
          await conduceVehiculo(run);
          for (let i = 0; i < run.n; i++) {
            await page.keyboard.press(ARROW[run.m]!);
            await page.waitForTimeout(stepMs);
          }
        }
      } else if (op.gap !== undefined) {
        resyncs.push(`hueco OCR ~${op.gap} (ocr:${op.ocrLn})`);
      } else {
        todosSkipped++;
      }
    }
    await page.waitForTimeout(200);
    const portLines = await accSlice(page, mark);
    return {
      report: { id: seg.id, ctx: seg.ctx, seam: seg.seam, comparable: 0, matched: 0, conformity: null, presentacion: 0, ocrPartial: 0, ocrGhost: 0, ocrGarbage: 0, covered: 0, combatRng: 0, combatRosterTail: 0, combatCurated: 0, combatOutcomeRng: 0, shopGreetingRng: 0, resyncs, combatRounds: 0, todosSkipped, typedSkipped: 0, anchorsResolved: 0, anchorsJumped: 0, anchorsMissed: 0, anchorsAmbiguous: 0, drifts: [], salaDeferred: 0, dngOps: 0, wandererFrozen: 0, floorMatches: 0, floorResyncs: 0, floorUnknown: 0, salaOpsSkipped: 0, blocks: [] },
      portLines,
    };
  }

  // ---- ESPERA A LOS PACERS A RELOJ DE PARED del segmento anterior. VA ANTES del Escape ×2
  //  A PROPÓSITO: `refuging`/`camping`/`moongate`/`trollSneak`/`endgame` se tragan el teclado
  //  entero (main.ts `handleGameKey`), así que la purga NO los toca — y el refuge, al terminar,
  //  TELETRANSPORTA a la party al castillo de LB, pisando el resync de location que viene
  //  justo debajo. Ver `waitOutSeamPacers` (medido en `ad06-g18`).
  await waitOutSeamPacers(page, resyncs);
  // ---- PURGA DE MODOS del segmento anterior (Escape ×2): sin esto, un picker/getstring
  //  colgado se traga la costura y el guion entero del segmento (atasco medido en AD).
  await purgeLiveModes(page, resyncs);

  // ---- costura de entrada (RESYNC RESILIENTE: un fallo de resync NO aborta la parte;
  //  se anota como RESYNC-FAIL y la calibración continúa — es la lista de puntos a afinar).
  // RESYNC DE LOCATION POR COSTURA (relevo-3), dos huecos que la deriva de LOCATION explotaba:
  //  (a) costura `enter` con `loc:null` (banner demasiado corrupto para el segmentador) → se
  //      resuelve el id DESDE EL BANNER contra la tabla viva `locationNames` + keeps;
  //  (b) costura `exit`/`overworld` → se COMPRUEBA que la party salió; si no, resync al
  //      tile-entrada del overworld de la location en la que se quedó.
  let enterLoc = seg.enter?.loc ?? null;
  if (enterLoc == null && seg.enter?.banner && !seg.enter.overworld && !seg.enter.shrine) {
    const derived = seamLocationFromBanner(seg.enter.banner, await liveLocationNames(page));
    if (derived != null) {
      enterLoc = derived;
      resyncs.push(`costura: banner '${seg.enter.banner.slice(0, 34)}' → loc=${derived} (resuelto en runtime; la ruta lo traía null)`);
    } else {
      resyncs.push(`costura: banner '${seg.enter.banner.slice(0, 34)}' NO resoluble a loc (sin resync de location — no se adivina)`);
    }
  }
  // COSTURA DE MAZMORRA (FASE 3b). `loc` 33..40 NO es un small map: `goToLocation` dejaría un
  // estado imposible (position.location=33 sin mapa). La costura es `setDungeonPos` (cero-rand):
  // si la party no está DENTRO de esa mazmorra, se la pone en su celda de entrada de superficie
  // (la escalera-arriba de la planta 0, la MISMA regla de enterDungeon) mirando al SUR (el
  // facing de entrada del binario, `facing: "south"`). El errante queda congelado (ruling A).
  if (seg.enter?.dungeon && seg.enter.loc != null && !seg.enter.carryover) {
    const dp = await dungeonPos(page);
    if (dp?.dungeon !== seg.enter.loc) {
      const cell = await dungeonEntryCell(page, seg.enter.loc);
      await setDungeonPosSeam(page, seg.enter.loc, 0, cell.x, cell.y, "south");
      resyncs.push(
        `costura dungeon ${seg.enter.banner ?? seg.enter.loc}: setDungeonPos(${seg.enter.loc}, f0, ${cell.x},${cell.y}, south) — cero-rand (estaba en ${dp ? `dng ${dp.dungeon} f${dp.floor}` : "fuera del 3D"})`,
      );
    }
    const live = await dungeonPos(page);
    floor.expected = live?.floor ?? 0;
    interiorLive = live != null;
    if (await freezeWanderer(page)) wandererFrozen++;
  }
  // COSTURA `carryover` DE MAZMORRA (FASE 3d, los `post-combat`). Un post-combat es la
  // CONTINUACIÓN de la misma visita tras un combate de sala: el segmentador cortó por el
  // `VICTORY!`, no por un banner. Así que aquí NO se teletransporta nada — la única celda que
  // la costura de 3b sabe fijar es la de ENTRADA de la mazmorra, y a mitad de visita el LP no
  // está ahí: ponerlo sería FABRICAR posición (la celda real no es derivable hoy, ver el
  // PENDIENTE de la planta de entrada en design-interiores §9).
  //
  // Lo que sí se hace es COMPROBAR: ¿sigue la party dentro de ESTA mazmorra? Si sí, se lee la
  // planta viva como esperada y se congela el errante (ruling A). Si no —porque el replay la
  // sacó, o porque nunca llegó— el segmento NO se conduce y se DECLARA. Ése es exactamente el
  // gate que el deber previo nº2 pide: sin él, 209 segmentos pulsarían las teclas del pasillo
  // sobre el overworld (la rotura nº1 de 3b, multiplicada).
  if (seg.enter?.dungeon && seg.enter.loc != null && seg.enter.carryover) {
    // `post-combat` significa literalmente «con el combate YA resuelto»: el LP acababa de salir
    // de la sala. En el port, el `advance` del segmento anterior puede haber pisado la sala y
    // dejado el combate VIVO (`purgeLiveModes` sólo hace Escape ×2, que no lo cierra). Si se
    // leyera `dungeonPos` con el combate encima, el bucle de combate se comería las primeras ops
    // del pasillo. Se resuelve con la política del segmento —la costura sancionada de siempre—
    // ANTES de leer la posición, que es el mismo orden que el LP.
    combatRounds += await resolveCombatIfAny(page, seg.policy, resyncs, combatGuard);
    const live = await dungeonPos(page);
    interiorLive = carryoverInteriorLive(live, seg.enter.loc);
    if (interiorLive) {
      floor.expected = live!.floor;
      if (await freezeWanderer(page)) wandererFrozen++;
      resyncs.push(
        `costura carryover dungeon ${seg.enter.loc}: la party SIGUE dentro (f${live!.floor} @${live!.x},${live!.y} mirando ${live!.facing}) — NO se teletransporta (la celda del LP a mitad de visita no es derivable)`,
      );
    } else {
      resyncs.push(
        `costura carryover dungeon ${seg.enter.loc}: la party NO está en esa mazmorra (${live ? `está en dng ${live.dungeon} f${live.floor}` : "fuera del 3D"}) — el segmento NO se conduce (no se fabrica posición)`,
      );
    }
  }
  if (seg.openedBy && !interiorLive) {
    // No se ha podido poner la party dentro del 3D: el segmento NO se conduce (ver la guarda del
    // op `dng`). Se AFLORA, no se silencia: un interior abierto que no midió nada es un dato.
    resyncs.push(
      `INTERIOR-SIN-MAZMORRA ${seg.id}: la costura no dejó a la party dentro del 3D (enter.loc=${seg.enter?.loc ?? "null"}) → ops de pasillo NO conducidas`,
    );
  }
  if (seg.enter?.overworld && !seg.enter.carryover) {
    const action = exitSeamAction(await getPos(page), seg.enter, await dungeonPos(page), opts.interiorAbandonedBefore);
    if (action.kind === "resync") {
      if (action.porqueMazmorra) {
        // Se DECLARA por qué: con `position` sola esta costura no disparaba nunca (el arnés la
        // dejó en el tile de superficie), así que un lector que compare con corridas viejas
        // tiene que poder ver que el disparo es nuevo y de dónde sale.
        resyncs.push(`RESYNC exit: la party sigue DENTRO de la mazmorra ${action.fromLoc} (dungeonState vivo; state.position dice loc 0 porque setDungeonPos la aparca ahí)`);
      }
      await resyncExitToOverworld(page, action.fromLoc, resyncs, action.underworld);
    } else if (action.kind === "layer-mismatch") {
      // NO se corrige (ver `exitSeamAction`): se AFLORA. Y se AFLORA SIN NOMBRAR LA CAUSA salvo
      // cuando se conoce: la línea vieja afirmaba «el replay salió por su cuenta», que este
      // call-site no observa (tarjeta `ad18-g11`, punto 3 de `exitSeamAction`).
      const hecho = `CAPA-EXIT ${seg.id}: el port está en ${layerName(action.got)} (floor=${action.got}) y la costura declara ${layerName(action.want ? UNDERWORLD_FLOOR : 0)} — el segmento se mide en la capa EQUIVOCADA`;
      resyncs.push(
        action.abandonedIn
          ? `${hecho}. CAUSA: la party fue EXPULSADA del 3D en ${action.abandonedIn} (PLANTA-DESCONOCIDA), no salió por su cuenta`
          : `${hecho}. CAUSA NO OBSERVADA aquí: mira PLANTA-DESCONOCIDA / RESYNC exit de los segmentos anteriores antes de leerlo como divergencia del port`,
      );
    }
  }
  // (las costuras de MAZMORRA ya se resolvieron arriba con setDungeonPos: goToLocation NO
  //  sirve para loc 33..40 — no son small maps)
  if (enterLoc != null && !seg.enter?.carryover && !seg.enter?.dungeon) {
    const pos = await getPos(page);
    if (pos.location !== enterLoc) {
      try {
        if (pos.location === 0 && !seg.enter?.noEnterEcho) {
          // ¿ya estamos SOBRE la entrada por el replay? entonces la (E) real basta (entrada
          // NATURAL, sin arnés); si no entró, resync determinista por goToLocation.
          await pressKey(page, "e", 350);
          const p2 = await getPos(page);
          if (p2.location !== enterLoc) {
            await resyncEnterLocation(page, enterLoc);
            resyncs.push(`enter ${seg.enter?.banner}: resync por goToLocation (replay dejó la party en ${pos.x},${pos.y})`);
          }
        } else if (!seg.enter?.noEnterEcho) {
          // party dentro de OTRA location (el replay no salió) o estado no-overworld →
          // resync determinista (goToLocation fuerza la entrada correcta desde cualquier estado)
          await resyncEnterLocation(page, enterLoc);
          resyncs.push(`enter ${seg.enter?.banner}: resync goToLocation desde location=${pos.location}`);
        }
      } catch (e) {
        resyncs.push(
          `RESYNC-FAIL enter ${seg.enter?.banner ?? enterLoc} (loc esperada=${enterLoc}, party en location=${pos.location} @${pos.x},${pos.y}): ${(e as Error).message?.slice(0, 90)}`,
        );
      }
    }
  }

  // ---- script
  // Bucle INDEXADO (antes era `for (const op of …)`) porque el ancla de NPC necesita mirar al op
  // SIGUIENTE: ahí está la tecla-flecha con la dirección que pulsó el humano (ficha F-A3).
  for (let opIdx = 0; opIdx < seg.script.length; opIdx++) {
    const op = seg.script[opIdx]!;
    /** Desenlace del ancla de NPC de ESTE op, para que el armado del ledger que viene detrás
     *  sepa si la transacción llegó a conducirse. Per-iteración a propósito: leer el último de
     *  `anchorOutcomes` mezclaría el ancla de `face` de un op anterior. */
    let opNpcStatus: AnchorStatus | null = null;
    // INTERIOR ABIERTO: SÓLO se conducen las ops de PASILLO (`dng`). Las `nav`/`key`/`typed` que
    // el curate dejó en el segmento son del material 2D de SALA (el segmentador convirtió los
    // `East`/`West`/`South` del combate de sala en runs de nav), y DENTRO del 3D una flecha no es
    // un paso al este: es `Advance`/`Turn`. Medido en ad15-g02 (21 nav + 14 key legacy): esas
    // teclas sacaron a la party de la mazmorra («Klimb-U/D- / Up! / Exit to Britannia!») y el
    // resto del segmento se caminó por el OVERWORLD («Very slow!»). El material de sala está
    // diferido a 3c en la MÉTRICA (`sala-diferida`); tiene que estarlo también en la CONDUCCIÓN.
    if (seg.openedBy && !op.dng && (op.nav || op.key || op.typed !== undefined || op.type !== undefined || op.use)) {
      salaOpsSkipped++;
      continue;
    }
    // COSTURA INTERNA (`enterLoc` / `exitOverworld`): cambia de location a MITAD de segmento.
    // Va la PRIMERA del bucle, antes del bloque de anclas y antes de `ledgerArm`: el ancla de NPC
    // que viene detrás tiene que leer la location YA cambiada — sin eso se abstiene por diseño
    // (`if (pos.location === 0) → skip`) y el ledger no puede armar. Ver `applyInternalSeam`.
    if (await applyInternalSeam(page, op, resyncs)) continue;
    // Fase C: RESYNC POR-INTERACCIÓN — si el op lleva ancla, alinea la posición a la celda
    // del LP ANTES de ejecutarlo (teleport sancionado). Colapsa la deriva del replay para
    // que la interacción REAL (Look/Get/peaje/compra) caiga en la celda correcta.
    if (op.anchor && op.anchor.kind === "face") {
      anchorOutcomes.push(await resyncToAnchor(page, op.anchor, resyncs));
    } else if (op.anchor && op.anchor.kind === "npc") {
      // ★ F-A3 — LA DIRECCIÓN DEL (T)alk LA TRAE EL GUION: el op del ancla va seguido de la
      // tecla-flecha que pulsó el humano, con el MISMO `ocrLn`. Se lee AQUÍ (mirando al op
      // siguiente) y no del ancla, para no tener que re-derivar el corpus: `derive-anchors.mjs`
      // no la mete en el objeto `anchor` y regenerar el corpus movería cifras publicadas.
      const sig = seg.script[opIdx + 1] as { key?: string; ocrLn?: number } | undefined;
      const preferDir =
        sig?.key && ARROW_TO_DIR[sig.key] && (sig.ocrLn == null || sig.ocrLn === op.ocrLn)
          ? ARROW_TO_DIR[sig.key]
          : undefined;
      const outcome = await resyncToNpcAnchor(page, op.anchor, resyncs, preferDir);
      anchorOutcomes.push(outcome);
      opNpcStatus = outcome.status;
      if (op.anchor.expectDelta != null) {
        // Si el ancla NO enganchó (NPC ausente, tienda sin abrir, o el ancla se ABSTUVO), las
        // teclas del guion de compra/venta NO se fabrican sobre el mapa (caerían como
        // Yell/Board/… y ensuciarían estado); el ledger igualmente mide y reporta el delta con
        // la causa en resyncs — ahora también en su ETIQUETA (ver `ledgerTxnVerdict`).
        // ★★ La pregunta va por `anchorEngaged` (LISTA BLANCA) y no por una enumeración de los
        // fallos: la forma anterior era `status === "miss" || status === "ambiguous"` y dejaba
        // `skip` cayendo por el lado de «enganchó». Medido en `ad09-g04` antes de la costura
        // interna: las 14 teclas de la compra caían sobre el mapa y el port emitía
        // `New Order / Swap — who?` y `Talk- / Funny, no response!` (acta `teclas-ad09` §6.2).
        skipTxnKeys = !anchorEngaged(outcome.status);
        tec(`op[${opIdx}] ANCLA-TXN '${op.anchor.match}' cmd=${op.anchor.cmd} expectDelta=${op.anchor.expectDelta} → status=${outcome.status} skipTxnKeys=${skipTxnKeys}`);
      } else {
        tec(`op[${opIdx}] ANCLA-NPC '${op.anchor.match}' cmd=${op.anchor.cmd} (sin expectDelta) → status=${outcome.status}`);
      }
    } else if (skipTxnKeys && !op.key) {
      skipTxnKeys = false; // fin de la ráfaga de teclas de la transacción fallida
      tec(`op[${opIdx}] ${Object.keys(op).filter((k) => k !== "src" && k !== "ocrLn")[0] ?? "?"} → CIERRA la ráfaga: skipTxnKeys=false`);
    }
    // ARMADO DEL LEDGER (ver `ledgerArm`). Va DESPUÉS del bloque de anclas a propósito: el oro
    // se captura tras el resync del ancla y antes de las teclas de la transacción, que es el
    // orden con el que se midieron los dos deltas verdes de LP1 (+36 part04, −954 part05).
    // UNA transacción por segmento: si un segundo op re-arma, el primero queda sin medir y eso
    // se DECLARA en vez de tragarse (el segmentador debería partir esos beats en dos).
    const arm = ledgerArm(op);
    if (arm) {
      const origen = op.anchor ? "tras el resync del ancla" : "op suelto: sin ancla — peaje/tributo";
      // ★ El desenlace del ancla viaja CON el armado, no aparte: es lo que al cerrar decide si
      // el delta mide la mecánica del port o si el port no llegó a ver la tienda. `null` = op
      // suelto (peaje/tributo): no hay mercader al que anclarse ⇒ conducido por construcción.
      txnAnchorStatus = opNpcStatus;
      if (op.ledgerCite) resyncs.push(`LEDGER-CITA: ${op.ledgerCite}`);
      if (arm.gold != null) {
        if (txnGoldBefore != null) resyncs.push(`LEDGER-REARM: un segundo op arma el oro (esperado ${arm.gold}); el delta anterior (${txnExpectDelta}) queda SIN MEDIR`);
        txnGoldBefore = await readGold(page);
        txnExpectDelta = arm.gold;
        resyncs.push(`LEDGER-ARM oro: esperado ${arm.gold} desde ${txnGoldBefore} (${origen})`);
      }
      if (arm.keys != null) {
        if (txnKeys != null) resyncs.push(`LEDGER-REARM: un segundo op arma las llaves (esperado ${arm.keys}); el delta anterior (${txnKeys.expected}) queda SIN MEDIR`);
        txnKeys = { before: await readCounter(page, "keys"), expected: arm.keys };
        resyncs.push(`LEDGER-ARM llaves: esperado ${arm.keys} desde ${txnKeys.before ?? "ILEGIBLE"} (${origen})`);
      }
      if (arm.gems != null) {
        if (txnGems != null) resyncs.push(`LEDGER-REARM: un segundo op arma las gemas (esperado ${arm.gems}); el delta anterior (${txnGems.expected}) queda SIN MEDIR`);
        txnGems = { before: await readCounter(page, "gems"), expected: arm.gems };
        resyncs.push(`LEDGER-ARM gemas: esperado ${arm.gems} desde ${txnGems.before ?? "ILEGIBLE"} (${origen})`);
      }
    }
    if (op.seedGold != null) {
      await seedGold(page, op.seedGold);
      resyncs.push(`seedGold ${op.seedGold} (arnés solvencia para el buy)`);
      continue;
    }
    if (op.seedInt != null) {
      await seedInt(page, op.seedInt);
      resyncs.push(`seedInt ${op.seedInt} (arnés negociador: INT del avatar del LP — careo -954)`);
      continue;
    }
    if (op.seedStr != null) {
      const targets = await seedStr(page, op.seedStr);
      resyncs.push(
        targets.length
          ? `seedStr ${op.seedStr} en los miembros conscientes [${targets.join(",")}] (arnés del peaje: el importe es 99−3·STR)`
          : `seedStr ${op.seedStr} SIN EFECTO: ningún miembro consciente al que sembrar — el importe del peaje NO queda comparable`,
      );
      continue;
    }
    if (op.seedEquip != null) {
      await seedEquip(page, op.seedEquip.id, op.seedEquip.qty);
      resyncs.push(`seedEquip id=${op.seedEquip.id} ×${op.seedEquip.qty} (arnés inventario para la venta)`);
      continue;
    }
    if (op.nav) {
      for (const run of op.nav) {
        await conduceVehiculo(run);
        for (let i = 0; i < run.n; i++) {
          await page.keyboard.press(ARROW[run.m]!);
          await page.waitForTimeout(stepMs);
          combatRounds += await resolveCombatIfAny(page, seg.policy, resyncs, combatGuard);
        }
      }
      continue;
    }
    // FASE 3b — OP DE INTERIOR: teclas REALES del pasillo 3D (ver runDungeonOp). Tras cada op:
    // (1) el combate que la op haya disparado se resuelve con la política del segmento (una sala
    // pisada arranca combate y el bucle de combate se queda el teclado); (2) se RE-CONGELA el
    // errante (el core lo re-arma en cada cambio de planta/foso/post-combate); (3) si la op fue
    // un Klimb, se coteja la PLANTA viva contra la esperada por CONTEO de los ecos del LP — el
    // ANCLA PRIMARIA del modelo de interior — y si no casa se resincroniza SÓLO la planta
    // (legítimo: el Klimb conserva la celda, así que x,y son los mismos).
    if (op.dng) {
      // GUARDA MEDIDA (1ª corrida de 3b, ad23): sin la costura de mazmorra resuelta, el runner
      // pulsaba las teclas del pasillo SOBRE EL OVERWORLD — el transcript del port lo delató
      // («North / Blocked! / East / Slow progress! / Search-East»). Eso no mide el interior: mueve
      // a la party por el mapa grande y contamina la cadena. Si no estamos DENTRO del 3D, el op no
      // se ejecuta (no se fabrica movimiento) y se cuenta como todo-no-conducido.
      if (!interiorLive) {
        todosSkipped++;
        continue;
      }
      const pressed = await runDungeonOp(page, op, stepMs);
      if (pressed.length > 0) dngOps++;
      combatRounds += await resolveCombatIfAny(page, seg.policy, resyncs, combatGuard);
      if (await freezeWanderer(page)) wandererFrozen++;
      if (op.dng === "klimb") {
        const live = await dungeonPos(page);
        const dir = op.dir === "up" ? "up" : "down";
        const r = floorAfterKlimb(floor.expected, dir, live?.floor ?? null);
        floor.expected = r.expected;
        if (r.verdict === "match") floor.matches++;
        else if (r.verdict === "exited") {
          // LIMITACIÓN DECLARADA DE 3b: la costura entra por la CIMA (planta 0, la única celda de
          // entrada conocida), pero un segmento del MEDIO de una visita empieza en una planta
          // interior. Un `Klimb-Up!` del LP en la cima SALE a Britannia — o sea, el propio eco del
          // LP FALSIFICA la planta que la costura supuso, y la planta real no es derivable aquí (el
          // conteo de Klimb desde la entrada cruzaría segmentos `post-combat` que 3d aún no abre).
          // No se inventa profundidad: se deja de conducir el pasillo y se CUENTA el coste.
          floor.exits++;
          interiorLive = false;
          resyncs.push(
            `PLANTA-DESCONOCIDA klimb-${dir}: la party SALIÓ del 3D (la costura supuso la CIMA y el eco del LP la falsifica) — ops de pasillo restantes NO conducidas`,
          );
        } else if (r.verdict === "resync" && live) {
          floor.resyncs++;
          await setDungeonPosSeam(page, live.dungeon, r.expected!, live.x, live.y, live.facing);
          resyncs.push(
            `ANCLA-PLANTA klimb-${dir}: esperada f${r.expected} (conteo de Klimb del LP), viva f${live.floor} → resync de PLANTA por setDungeonPos (celda ${live.x},${live.y} intacta)`,
          );
        }
      }
      continue;
    }
    if (op.gap !== undefined) {
      resyncs.push(`hueco OCR de ~${op.gap} líneas (ocr:${op.ocrLn}) — no se inventan pasos`);
      continue;
    }
    if (op.key) {
      if (skipTxnKeys) {
        tec(`op[${opIdx}] key ${JSON.stringify(op.key)} → 🔴 NO ENVIADA (skipTxnKeys)`);
        continue; // tecla de una transacción cuyo ancla falló: no fabricar
      }
      const out = await conductKeyOp(page, op.key, resyncs);
      tec(
        `op[${opIdx}] key ${JSON.stringify(op.key)} → ${out.sent ? "enviada" : `🔴 RETENIDA (getstring ${out.heldBy} vivo — key-leak F1)`}`,
      );
      continue;
    }
    if (op.typed !== undefined || op.type !== undefined || op.typedMantra !== undefined) {
      const word = (op.typed ?? op.type ?? op.typedMantra)!;
      const outcome = await conductTypedOp(page, word, resyncs);
      if (outcome.skipped) typedSkipped++;
      if (outcome.runeTranslated) runeEchoTranslated++;
      continue;
    }
    if (op.dismiss) {
      const msg = await dismissCompanion(page, op.dismiss);
      resyncs.push(`dismiss ${op.dismiss} (arnés innLeave, tecla L del posadero): ${msg}`);
      continue;
    }
    if (op.recruit) {
      const msg = await recruitCompanion(page, op.recruit);
      resyncs.push(`recruit ${op.recruit} (arnés): ${msg}`);
      continue;
    }
    if (op.use) {
      // (U)se por picker: overlay de selección — calibración fina en Fase B
      await pressKey(page, "u", 320);
      await typeAnswer(page, op.use);
      continue;
    }
    if (op.wait) {
      tec(`op[${opIdx}] wait ${op.wait}ms`);
      await page.waitForTimeout(op.wait);
      continue;
    }
    if (op.todo !== undefined || op.todoKeep !== undefined) {
      todosSkipped++;
      continue;
    }
  }

  if (runeEchoTranslated > 0) {
    resyncs.push(`${runeEchoTranslated} typed de ECO RÚNICO invertidos a sus pulsaciones (Cast/Mix, DS:0x1b7a)`);
  }

  // ---- combate del propio segmento (ctx combat sin nav previa)
  if (seg.ctx === "combat") combatRounds += await resolveCombatIfAny(page, seg.policy, resyncs, combatGuard);

  await page.waitForTimeout(350);
  // ★ carril `ad06-teclas` — VOLCADO de las dos capas, pareadas y en el mismo sitio.
  if (TEC) {
    const recibidas = await keyLogSlice(page, tecMark);
    console.log(`\n===== TECLAS ${seg.id} — CAPA A (lo que el ARNÉS decide) =====`);
    for (const l of tecOps) console.log(`  ${l}`);
    console.log(`===== TECLAS ${seg.id} — CAPA B (lo que el JUEGO recibe: ${recibidas.length} teclas) =====`);
    for (const r of recibidas) {
      console.log(
        `  #${r.i} ${JSON.stringify(r.k).padEnd(12)} shopOpen=${r.so ? "1" : "0"}→${r.so2 ? "1" : "0"} tipo=${String(r.ty).padEnd(12)} phase=${String(r.ph).padEnd(16)}→${String(r.ph2)} prompt=${String(r.pr)}`,
      );
    }
    console.log(`===== TECLAS ${seg.id} — FIN =====\n`);
  }
  const portLines = await accSlice(page, mark);
  const diff = diffSegment(seg, portLines);
  const anchorsResolved = anchorOutcomes.filter((o) => o.status === "resolved-jump" || o.status === "resolved-hold").length;
  const anchorsJumped = anchorOutcomes.filter((o) => o.status === "resolved-jump").length;
  const anchorsMissed = anchorOutcomes.filter((o) => o.status === "miss").length;
  const anchorsAmbiguous = anchorOutcomes.filter((o) => o.status === "ambiguous").length;
  const drifts = anchorOutcomes.filter((o) => o.status === "resolved-jump").map((o) => o.drift);
  // LEDGER-DELTA de transacción anclada (comparable): oro antes (tras resync) vs oro al cierre.
  let ledgerDelta: SegmentReport["ledgerDelta"];
  if (txnGoldBefore != null) {
    ledgerDelta = ledgerDeltaResult(txnGoldBefore, await readGold(page), txnExpectDelta);
    resyncs.push(`LEDGER-DELTA txn: esperado ${ledgerDelta.expected}, obtenido ${ledgerDelta.got} ${ledgerTxnVerdict(ledgerDelta, txnAnchorStatus).label}`);
  }
  // LLAVES y GEMAS: mismo comparable que el oro, en canal PROPIO — así el reporte de un
  // segmento que sólo armó oro queda tal cual estaba (los dos verdes de LP1 no se mueven).
  let ledgerKeysDelta: SegmentReport["ledgerKeysDelta"];
  if (txnKeys) {
    // ★ MISMA puerta al mismo estado: si el ancla no enganchó, el `✗ (DIVERGENCIA DE PORT)` de
    // llaves y gemas era tan falso como el del oro. El `✓` pelado de estos dos canales se
    // conserva (no llevaba la coletilla del oro) para no mover sus transcripts.
    // [[censa-las-otras-puertas-al-mismo-estado]]
    ledgerKeysDelta = ledgerDeltaResult(txnKeys.before, await readCounter(page, "keys"), txnKeys.expected);
    const vk = ledgerTxnVerdict(ledgerKeysDelta, txnAnchorStatus);
    resyncs.push(`LEDGER-DELTA llaves: esperado ${ledgerKeysDelta.expected}, obtenido ${ledgerKeysDelta.got ?? "ILEGIBLE"} ${vk.state === "fiel" ? "✓" : vk.state === "divergencia" ? "✗ (DIVERGENCIA DE PORT)" : vk.label}`);
  }
  let ledgerGemsDelta: SegmentReport["ledgerGemsDelta"];
  if (txnGems) {
    ledgerGemsDelta = ledgerDeltaResult(txnGems.before, await readCounter(page, "gems"), txnGems.expected);
    const vg = ledgerTxnVerdict(ledgerGemsDelta, txnAnchorStatus);
    resyncs.push(`LEDGER-DELTA gemas: esperado ${ledgerGemsDelta.expected}, obtenido ${ledgerGemsDelta.got ?? "ILEGIBLE"} ${vg.state === "fiel" ? "✓" : vg.state === "divergencia" ? "✗ (DIVERGENCIA DE PORT)" : vg.label}`);
  }
  // ── FASE 3e-a: FILTRO DE LOCALIZACIÓN. Se alimenta con las observaciones DEL LP (derivadas del
  //    OCR, no del port) y, si hay presupuesto y el ancla resuelve, se resincroniza la CELDA — que
  //    es justo lo que 3d no tenía y lo que hizo inmedible a ad14 (party sellada en la escalera).
  //    El filtro REDUCE; quien decide es la cercanía (`resolveDungeonAnchor`). Declina si hay
  //    demasiadas candidatas o si no hay presupuesto, y lo DECLARA.
  if (seg.openedBy && interiorLive && opts.dngFilter && opts.dngGrid) {
    const f = opts.dngFilter;
    const live = await dungeonPos(page);
    if (live) {
      const grid = opts.dngGrid;
      // ⚠ 3e-b: se le pasa el LOOKUP POR PLANTA, no el grid de la planta viva. El segmento puede
      // CRUZAR de planta (18 klimbs en ad17, en 6 de sus 10 interiores) y cada tramo tiene que
      // aplicarse contra SU mapa; con un grid suelto los tramos de las plantas anteriores se
      // pierden y hay que reiniciar. Ver la cabecera de `stepFilterForSegment`.
      const gridFor = (floor: number): DngFloorGrid | null => grid(live.dungeon, floor);
      if (gridFor(live.floor)) {
        // Ya NO se reinicia por cambio de planta: eso lo lleva el propio filtro tramo a tramo
        // (y a través del klimb CONSERVA las candidatas, porque el klimb preserva x,y,facing).
        // Aquí sólo se reinicia al cambiar de MAZMORRA o al estrenar el acumulador.
        if (f.dungeon !== live.dungeon || f.floor === null) resetFilter(f, live.dungeon, live.floor);
        const res = stepFilterForSegment(f, gridFor, seg.script, seg.expect, live);
        filterFed = f.fed;
        filterCandidates = res.candidates;
        filterStatus = res.status;
        if (res.status === "resolved" && res.state && (res.drift ?? 0) > 0) {
          await setDungeonPosSeam(page, live.dungeon, live.floor, res.state.x, res.state.y, res.state.facing === 0 ? "north" : res.state.facing === 1 ? "east" : res.state.facing === 2 ? "south" : "west");
          f.applied++;
          filterApplied = 1;
          resyncs.push(
            `FILTRO-3e ${seg.id}: ${res.candidates} candidata(s), elegida (${res.state.x},${res.state.y}) por CERCANÍA (deriva ${res.drift}) — resync de celda${res.belowBudget ? ` ⚠ BAJO PRESUPUESTO: ${res.reason}` : ""}`,
          );
        } else {
          resyncs.push(`FILTRO-3e ${seg.id}: ${res.status} (${res.candidates} candidatas, ${f.obs.length} observaciones)${res.reason ? " — " + res.reason.slice(0, 140) : ""}`);
        }
        // contabilidad 3e-b: sin esto, «el filtro no hizo nada» no se distingue de «cruzó plantas
        // y tuvo que reiniciar», que son diagnósticos distintos con acciones distintas.
        // `combatRiskSegments` (#13) faltaba aquí (auditoría final, 01-08): es el contador de
        // las abstenciones por COMBATE EN LA COLA, y su propósito ES la auditoría — no salir en
        // la única línea que se lee lo dejaba contando para nadie, justo al lado de su hermano
        // `ghostRiskSegments`, que sí salía.
        resyncs.push(
          `FILTRO-3e/planta ${seg.id}: ${f.klimbs} klimb(s) + ${f.falls} caída(s) de foso atravesadas · ${f.runsDropped} tramo(s) descartados por planta sin grid · planta LP-vs-port ${f.floorAgree}✓/${f.floorDisagree}✗${f.floorFalsified ? ` · ${f.floorFalsified} falsificada(s) (el LP salió de la mazmorra)` : ""} · anclajes bajo-presupuesto ${f.belowBudgetAnchors} · segmentos con firma fantasma ${f.ghostRiskSegments} · segmentos con combate en la cola ${f.combatRiskSegments}`,
        );
      }
    }
  }
  if (seg.openedBy) {
    resyncs.push(
      `INTERIOR ${seg.openedBy}: ${dngOps} ops de pasillo conducidas · errante CONGELADO ${wandererFrozen}× (instrumento declarado, ruling A) · planta: ${floor.matches} casadas / ${floor.resyncs} resyncs / ${floor.exits} planta-desconocida · ${salaOpsSkipped} ops 2D de sala NO conducidas · ${diff.salaDeferred} bloques de SALA diferidos a 3c`,
    );
  }
  return {
    report: {
      ...diff,
      resyncs,
      combatRounds,
      todosSkipped,
      typedSkipped,
      anchorsResolved,
      anchorsJumped,
      anchorsMissed,
      anchorsAmbiguous,
      drifts,
      filterFed,
      filterCandidates,
      filterApplied,
      filterStatus,
      dngOps,
      wandererFrozen,
      floorMatches: floor.matches,
      floorResyncs: floor.resyncs,
      floorUnknown: floor.exits,
      salaOpsSkipped,
      ...(ledgerDelta ? { ledgerDelta } : {}),
      ...(ledgerKeysDelta ? { ledgerKeysDelta } : {}),
      ...(ledgerGemsDelta ? { ledgerGemsDelta } : {}),
    },
    portLines,
  };
}

/** ARNÉS de reclutamiento (state-resync, análogo a teleportOverworld). LLAMA al CORE
 *  (`__u5test.join` → core/party.joinByName), NO replica su lógica (ruling del lead
 *  Condición A: una réplica derivaría en silencio cuando el core evolucione). El JOIN real
 *  por Talk direccional es frágil bajo la deriva de posición del replay; esto mantiene la
 *  FIDELIDAD DEL LEDGER (party 3→5) que gatea la cadena.
 *  ⚠ INTERINO ratificado por el lead: es arnés de ESTADO, no conduce la conversación. El
 *  flujo de Talk REAL con resync-a-NPC es TICKET Fase-B (los beats de join del OCR siguen
 *  contándose como [presentacion], no se barren). */
export async function recruitCompanion(page: Page, name: string): Promise<string> {
  return page.evaluate((nm) => {
    const hook = (window as unknown as { __u5test?: { join?: (n: string) => { ok: boolean; message: string } } }).__u5test;
    if (!hook?.join) throw new Error("recruitCompanion: falta __u5test.join (build sin el hook DEV de core/party.joinByName)");
    const r = hook.join(nm);
    return `${r.message} (ok=${r.ok})`;
  }, name);
}

/**
 * ARNÉS DE SWAP DE PARTY (gemelo de `recruitCompanion`). LLAMA al CORE
 * (`__u5test.innLeave` → `core/shops.innLeave`, calco de SHOPPES3 0x02AE-0x047D: la tecla L
 * del posadero marca `partyStatus = location`, `monthsAtInn = 0`, party−1), NO replica su
 * lógica. Es INTERINO de la misma clase que `recruit` (ticket T-INN-LEAVE-REAL): el flujo
 * FIEL existe en la piel (shop-console `innLeaveYes`) y se conducirá por teclas cuando el
 * resync a la celda del posadero sea fiable; hasta entonces esto mantiene el LEDGER DE PARTY
 * del LP (los beats de la conversación del posadero SIGUEN en la ruta y se cuentan).
 */
export async function dismissCompanion(page: Page, name: string): Promise<string> {
  return page.evaluate((nm) => {
    const hook = (
      window as unknown as { __u5test?: { innLeave?: (n: string) => { ok: boolean; message: string; partySize?: number } } }
    ).__u5test;
    if (!hook?.innLeave) throw new Error("dismissCompanion: falta __u5test.innLeave (build sin el hook DEV de core/shops.innLeave)");
    const r = hook.innLeave(nm);
    return `${r.message} (ok=${r.ok}, party=${r.partySize ?? "?"})`;
  }, name);
}

/** Lee el oro vivo. */
async function readGold(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __u5test: { game: { state: { gold: number } } } }).__u5test.game.state.gold);
}
/** Lee un contador de inventario del ledger (llaves/gemas). `null` = el estado vivo no trae
 *  ese campo — «no lo sé», que NO se degrada a 0 (ver `ledgerDeltaResult`). */
async function readCounter(page: Page, which: "keys" | "gems"): Promise<number | null> {
  return page.evaluate((k) => {
    const s = (window as unknown as { __u5test: { game: { state: Record<string, unknown> } } }).__u5test.game.state;
    const v = s[k];
    return typeof v === "number" ? v : null;
  }, which);
}
/** ARNÉS DE SOLVENCIA: siembra el oro (mutación de estado sancionada, clase recruit/clock).
 *  Permite que un buy caro DISPARE bajo un balance de replay bajo (loot RNG no anclado), sin
 *  perseguir el balance del LP — el ledger mide el DELTA de la transacción, no el balance. */
async function seedGold(page: Page, amount: number): Promise<void> {
  await page.evaluate((n) => {
    (window as unknown as { __u5test: { game: { state: { gold: number } } } }).__u5test.game.state.gold = n;
  }, amount);
}
/** ARNÉS DE INVENTARIO: siembra unidades de equipo (ver doc del op `seedEquip`). */
async function seedEquip(page: Page, id: number, qty: number): Promise<void> {
  await page.evaluate(
    ({ id, qty }) => {
      const s = (window as unknown as { __u5test: { game: { state: { equipmentQuantities: number[] } } } })
        .__u5test.game.state;
      s.equipmentQuantities[id] = qty;
    },
    { id, qty },
  );
}
/** ARNÉS DE NEGOCIADOR: siembra la INT del avatar (characters[0], record+0x0E — la stat de
 *  regateo de TODAS las tiendas). Ver doc del op `seedInt` (careo del precio del guild). */
async function seedInt(page: Page, value: number): Promise<void> {
  await page.evaluate((n) => {
    const c = (window as unknown as { __u5test: { game: { state: { characters: Array<{ intelligence: number }> } } } })
      .__u5test.game.state.characters[0];
    if (c) c.intelligence = n;
  }, value);
}
/** ARNÉS DE FUERZA: siembra la STR de los miembros CONSCIENTES (ver `strSeedTargets` para el
 *  porqué de «todos» y no «el avatar»). Devuelve los índices sembrados para el reporte: si la
 *  lista sale vacía, el peaje NO queda comparable y hay que verlo, no suponerlo. */
async function seedStr(page: Page, value: number): Promise<number[]> {
  const { chars, partySize } = await page.evaluate(() => {
    const s = (
      window as unknown as { __u5test: { game: { state: { characters: Array<{ status?: string }>; partySize: number } } } }
    ).__u5test.game.state;
    return { chars: s.characters.map((c) => ({ status: c.status })), partySize: s.partySize };
  });
  const targets = strSeedTargets(chars, partySize);
  await page.evaluate(
    ({ targets, value }) => {
      const cs = (window as unknown as { __u5test: { game: { state: { characters: Array<{ strength: number }> } } } })
        .__u5test.game.state.characters;
      for (const i of targets) {
        const c = cs[i];
        if (c) c.strength = value;
      }
    },
    { targets, value },
  );
  return targets;
}

// ------------------------------------------------------------------- ledger/estado
export async function probeState(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const g = (
      window as unknown as {
        __u5test: {
          game: {
            state: {
              gold: number;
              food?: number;
              keys?: number;
              gems?: number;
              torches?: number;
              // modelo real del core: characters[] + partySize (no un array "party")
              characters: Array<{ name: string; currentHp?: number; status?: string; partyStatus?: number }>;
              partySize: number;
              time?: unknown;
              position?: unknown;
            };
          };
        };
      }
    ).__u5test.game;
    const s = g.state;
    // miembros de la party = partyStatus===0 (réplica de core/party.partyMembers), NO slice
    const party = s.characters.filter((c) => c.partyStatus === 0).slice(0, 6);
    return {
      gold: s.gold,
      food: s.food ?? null,
      keys: s.keys ?? null,
      gems: s.gems ?? null,
      torches: s.torches ?? null,
      partySize: s.partySize,
      party: party.map((p) => p.name),
      partyAlive: party.filter((p) => p.status !== "D").length,
      time: s.time ?? null,
      position: s.position ?? null,
    };
  });
}

/**
 * ★★ PROCEDENCIA DEL ARTEFACTO — QUÉ ÁRBOL PRODUJO ESTE REPORT.
 *
 * Sin esto, un `*.report.json` no puede decir de dónde sale, y el 02-08 eso costó una
 * adjudicación entera: un censo de siete corridas de `ad06` de SEIS CARRILES distintos se
 * ordenó por el `when` del report, salió `0·0·0·220·220·220·0` y se archivó como «serie
 * BIESTABLE ⇒ el sello es estocástico ⇒ hay que replicar». Etiquetada por sha era un ESCALÓN
 * MONÓTONO: cada 220 de un árbol anterior a F-A3 y cada 0 de uno posterior. La conclusión
 * fue falsa y llegó a cablearse en código (`91ec3505`, retirado en `4ad69aaf`).
 *
 * La reconstrucción a posteriori es posible —por el reflog del worktree que contiene el
 * report— pero es un rodeo que hay que ACORDARSE de dar, y el carril que censó no lo dio.
 * Con el sha DENTRO del artefacto, «presencia no es procedencia» deja de ser una advertencia
 * que hay que recordar y pasa a ser un dato que viaja con el fichero.
 *
 * `dirty` va con él a propósito: un sha sobre un árbol con cambios sin commitear identifica un
 * árbol que NO EXISTE en la historia, y una cifra así no es reproducible. Respeta `.gitignore`,
 * así que los dirs derivados de la propia corrida (los `.espejo-…` de cada ventana) no lo
 * ensucian.
 *
 * Si git no está o esto no es un repo, los dos campos salen `null` — el report se escribe
 * igual. Un fallo aquí no puede tirar una corrida de 5 minutos ya medida.
 */
export function procedencia(): { sha: string | null; dirty: boolean | null } {
  try {
    // cwd = ESTE fichero, NUNCA OUT_DIR: `ESPEJO_OUT` apunta a menudo al scratchpad, que está
    // FUERA del repo — preguntarle el sha a git desde allí daría el de otro repo, o ninguno.
    const o = { cwd: HERE, encoding: "utf8" as const };
    return {
      sha: execFileSync("git", ["rev-parse", "HEAD"], o).trim(),
      dirty: execFileSync("git", ["status", "--porcelain"], o).trim().length > 0,
    };
  } catch {
    return { sha: null, dirty: null };
  }
}

export function writeReport(report: PartReport): string {
  mkdirSync(OUT_DIR, { recursive: true });
  const p = join(OUT_DIR, `${report.part}.report.json`);
  // La procedencia se sella AQUÍ, en el único punto por el que pasan todos los reports, para
  // que ningún llamador pueda olvidarla. Y se calcula DESPUÉS de medir: no puede influir nada.
  writeFileSync(p, JSON.stringify({ ...report, ...procedencia() }, null, 2) + "\n");
  return p;
}

/** VOLCADO DEL TRANSCRIPT del port por segmento (`ESPEJO_DUMP=1`). Es el habilitador de la
 *  CALIBRACIÓN OFFLINE del comparador: con `{segId: portLines}` en disco, `diffSegment` (que
 *  es PURO) se re-corre sobre el MISMO material sin volver a gastar la ventana playwright, y
 *  el antes/después de cualquier patrón/alfabeto se mide exacto. No entra en el reporte
 *  (volumen) ni se commitea (es material derivado de una corrida). */
export function writeTranscript(part: string, bySeg: Record<string, string[]>): string {
  mkdirSync(OUT_DIR, { recursive: true });
  const p = join(OUT_DIR, `${part}.transcript.json`);
  writeFileSync(p, JSON.stringify(bySeg) + "\n");
  return p;
}

export function summarize(rep: PartReport): string {
  const segs = rep.segments
    .map((s) => {
      const c = s.conformity === null ? "—" : `${Math.round(s.conformity * 100)}%`;
      const div = s.blocks.filter((b) => b.verdict === "divergent").length;
      const anc = s.anchorsResolved || s.anchorsMissed || s.anchorsAmbiguous
        ? ` anclas=${s.anchorsResolved}✓/${s.anchorsJumped}↷${s.anchorsMissed ? `/${s.anchorsMissed}✗` : ""}${s.anchorsAmbiguous ? `/${s.anchorsAmbiguous}?` : ""}`
        : "";
      return `  ${s.id} [${s.ctx}] conf=${c} (${s.matched}/${s.comparable})${div ? ` DIVERGENTES=${div}` : ""}${s.presentacion ? ` presentacion=${s.presentacion}` : ""}${s.ocrPartial ? ` ocr-partial=${s.ocrPartial}` : ""}${s.todosSkipped ? ` todos=${s.todosSkipped}` : ""}${anc}`;
    })
    .join("\n");
  const hist = DRIFT_BUCKETS.map((b) => `${b}:${rep.driftHistogram[b]}`).join(" ");
  const anchorLine = `  anclas: ${rep.anchorsResolved} resueltas (${rep.anchorsJumped} con salto), ${rep.anchorsMissed} MISS, ${rep.anchorsAmbiguous} ambiguas | deriva[${hist}]`;
  const cal = `  perfil-OCR=${rep.ocrProfile} | covered=${rep.covered} (de los matcheados), ocr-ghost=${rep.ocrGhost}, ocr-garbage=${rep.ocrGarbage}\n  no-comparable-por-TIRADA-del-port: desenlace-combate-curado=${rep.combatOutcomeRng}, saludo-tienda=${rep.shopGreetingRng}`;
  // DOS LÍNEAS DE CONFORMIDAD, nunca fusionadas (ruling del lead): smallmap arriba, interiores
  // aparte con su instrumento declarado. Se fusionarán cuando 3c cierre y se diga explícitamente.
  const i = rep.interior;
  const pct = (v: number | null): string => (v === null ? "—" : Math.round(v * 100) + "%");
  const interiorLine =
    i.segments > 0
      ? `  conformidad-interiores ${pct(i.conformity)} (${i.matched}/${i.comparable}) en ${i.segments} segmentos · divergentes=${i.divergent} · sala-diferida=${i.salaDeferred} · ops-pasillo=${i.dngOps} · ops-sala-no-conducidas=${i.salaOpsSkipped} · errante-congelado=${i.wandererFrozen}× · planta ${i.floorMatches}✓/${i.floorResyncs}↷/${i.floorUnknown}?\n` +
        // LA DESCOMPOSICIÓN de 3c: material nuevo abierto vs patrones retirados, separados
        `  interiores-3c: material por fase [${Object.entries(i.byPhase)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}: ${v.matched}/${v.comparable} en ${v.segments} seg`)
          .join(" | ")}] · combate-retirado=${i.combatRng} (cola-armas=${i.combatRosterTail}, curado=${i.combatCurated})`
      : `  conformidad-interiores — (ningún segmento de interior abierto en esta parte)`;
  // ── SALUD Y DENOMINADOR, en el sello (adjudicación `espejo-cadena-party-muerta`, 22-08) ──
  // Informativas las dos, pero en la PRIMERA pantalla: son las que dicen si el número de
  // arriba significa algo. `party 0/6` delata una parte que corre sobre un cadáver (en el
  // binario es imposible: ULTIMA.EXE:0x39fc → MAINOUT:0x0ac2 → BLCKTHRN:0x0910), y
  // `conducidas 0/929` delata un verde que no midió una sola operación.
  const party =
    rep.partyAlive === null || rep.partySize === null
      ? "party —/— (la sonda no la trajo)"
      : `party ${rep.partyAlive}/${rep.partySize} viva${rep.partyAlive === 0 ? "  ⚠ PARTY 100% MUERTA — esta parte no mide fidelidad" : ""}`;
  const cond = rep.expectTotal
    ? `conducidas ${rep.comparable}/${rep.expectTotal} del corpus (${Math.round((rep.comparable / rep.expectTotal) * 100)}%)`
    : "conducidas —/0 (el corpus de esta parte no declara bloques expect)";
  const saludLine = `  ${party} · ${cond}`;
  // ── LA DECLARACIÓN DE RE-SIEMBRA, en la MISMA primera pantalla que la salud (§(b) del
  // reparo). Va también cuando NO se sembró: «cadena pura» es el dato que hace comparable
  // esta parte con otra, y su ausencia es lo que haría falta adivinar.
  const rs = rep.reseed;
  const reseedLine = rs
    ? `  ${resumenResiembra(rs)}`
    : `  re-siembra: — (reporte anterior al carril espejo-resiembra)`;
  // La serie de vivos, comprimida a los CAMBIOS: una fila por cada vez que el número se
  // mueve. Enteros son 13-20 segmentos de ruido; los cambios son el dato.
  const tray = rep.partyAliveBySegment ?? [];
  const saltos = tray.filter((v, i) => i === 0 || v.alive !== tray[i - 1]!.alive);
  const trayLine = tray.length
    ? `  vivos por segmento (sólo cambios): ${saltos.map((v) => `${v.seg}=${v.alive ?? "—"}/${v.size ?? "—"}`).join(" → ")}`
    : `  vivos por segmento: — (no medido)`;
  // ── LA DECLARACIÓN DEL VEHÍCULO, por la misma razón que la de re-siembra: cuando se
  // aplica, la conformidad de esta parte NO es comparable con una medida en cadena.
  const vh = rep.vehiculo;
  const vehLine = vh
    ? `  ${resumenVehiculo(vh)}`
    : `  vehiculo: — (reporte anterior al carril espejo-vuelo)`;
  return `${rep.part}: conformidad-smallmap ${pct(rep.conformity)} (${rep.matched}/${rep.comparable} comparables), divergentes=${rep.divergent}, presentacion=${rep.presentacion}, ocr-partial=${rep.ocrPartial}, gaps-cerrados=${rep.gapsClosed}\n${saludLine}\n${reseedLine}\n${vehLine}\n${trayLine}\n${interiorLine}\n${cal}\n${anchorLine}\n${segs}`;
}

// ── SONDA DE LA FICHA #31: ancla del sorteo de aparición ─────────────────────
/**
 * Instala el sumidero page-side `__u5spawnK` que `EnemyPool.trySpawn` rellena con
 * `k = (party − chunk_origin) & 0xff` (X e Y) por INTENTO de spawn del sobremundo.
 *
 * 🔴 POR QUÉ SE MIDE `k` Y NO LA CELDA. El binario sortea `x = rand(0,0x1f) +
 * g_chunk_origin_x` y rechaza contra `g_party_x`; o sea que el ancla real del filtro es
 * `k`. El port la tiene CLAVADA en 16 (`pickSpawnCoords`: `rand(0,31) − 16`) bajo una
 * aproximación DECLARADA —«party ≈ chunk_origin+16»— cuya premisa nadie había medido.
 * Analíticamente el conjunto de `rand` aceptados coincide con el del binario SÓLO en
 * k=16: de las 22 posiciones que permite la histéresis (k ∈ [5,26]) el port acierta UNA.
 * Por eso la pregunta que decide la ventana no es «¿cuántas tiradas?» sino «¿QUÉ k pisa
 * el corpus?» — de ahí que el registro sea el ancla y no el resultado.
 *
 * Opt-in por el llamador (como `armKeyLog`): sin esta llamada el sumidero no existe y el
 * juego sólo hace UNA lectura de propiedad por intento — camino idéntico al de main, que
 * es algo VERIFICADO con la suite completa, no prometido.
 */
export async function armSpawnLog(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __u5spawnK: number[] }).__u5spawnK = [];
  });
}

/** Vuelca (y NO borra) el registro de anclas de spawn. Pares [kx, ky] por intento. */
export async function spawnLogSlice(page: Page, from: number): Promise<number[]> {
  return page.evaluate(
    (f) => ((window as unknown as { __u5spawnK?: number[] }).__u5spawnK ?? []).slice(f),
    from,
  );
}

/** Longitud viva del registro de spawn (0 si el instrumento no está armado). */
export async function spawnLogLength(page: Page): Promise<number> {
  return page.evaluate(
    () => ((window as unknown as { __u5spawnK?: number[] }).__u5spawnK ?? []).length,
  );
}

/**
 * Contador de PASOS DEL STREAM de RNG — la sonda que `armSpawnLog` no era.
 *
 * 🔴 POR QUÉ EXISTE, dicho contra mi propio texto de arriba. El docblock de `armSpawnLog`
 * afirma que «la pregunta que decide la ventana no es ¿cuántas tiradas? sino ¿qué k pisa
 * el corpus?». Eso valía para DIMENSIONAR la ventana (¿toca el defecto al corpus?) y NO
 * vale para ADJUDICARLA (¿se movió el stream?): `k` sale de la posición del grupo, que la
 * conduce la ruta de teclas ESCRITA, así que sería idéntico se mueva o no el stream. La
 * magnitud que responde a la segunda pregunta es el nº de pasos del generador.
 *
 * Y hacía falta porque los cinco sellos comparan TEXTO contra el original: un movimiento
 * de stream cuyo efecto no llegue a lo impreso los deja INTACTOS. `EXIT 0` acredita que
 * no se rompió nada visible, no que el stream esté quieto — son dos cosas distintas y
 * este contador es lo único que separa una de otra.
 *
 * Opt-in igual que las otras dos sondas: sin esta llamada el sumidero no existe. Y que eso
 * no perturba el generador está MEDIDO, no afirmado: `game/tests/rng-sonda-inerte.test.ts`
 * compara la secuencia emitida con y sin sumidero (mutante comprobado — al hacer que la
 * sonda gaste un paso, 3 de sus 7 casos se ponen rojos). Lo que NO es cero se declara ahí:
 * sin sumidero queda una lectura de propiedad por paso, que es camino, no comportamiento.
 *
 * ── CÓMO SE USA: el método, no sólo el contador ────────────────────────────────────────
 * Un número de tiradas suelto no dice nada; lo que adjudica es la COMPARACIÓN. La receta
 * que cerró #31, y que conviene repetir tal cual:
 *
 *  1. DOS RAMAS que difieran SÓLO por el cambio a evaluar — la de trabajo y su PADRE, con
 *     esta misma sonda aplicada a las dos. Verifica el par con `git diff --stat` entre
 *     ellas: tiene que nombrar exactamente los ficheros del cambio y ninguno más.
 *     🔴 El «antes» y el «después» sólo comparan si comparten base: una corrida contra otro
 *     padre atribuye al cambio lo que aterrizó en medio.
 *  2. CORRIDAS SERIALES, con puerto y directorio de salida propios, encadenadas por el
 *     fichero de salida de la primera para que ninguna mida bajo la carga de la otra.
 *  3. UNA PARTE SIN EL FENÓMENO COMO CONTROL INTERNO. En #31 fue `part04`, sin un solo
 *     intento de spawn: sus tiradas salieron IDÉNTICAS al dígito en las dos ramas
 *     (869 / seed 0x9565), y eso es lo que da derecho a leer las diferencias de las demás
 *     como efecto del cambio. Sin control, una diferencia global no distingue el cambio
 *     de un instrumento que miente.
 *  4. LEE LAS DOS COLUMNAS. `tiradas` y `seed` final tienen que moverse juntas: la semilla
 *     es función pura del nº de pasos desde la siembra, así que tiradas iguales con semilla
 *     distinta (o al revés) acusan al instrumento, no al árbol.
 *
 * 🔴 Y el nº de INTENTOS de un subsistema NO es un proxy del stream: en #31 la parte `ad21`
 * dio los mismos 8 intentos de spawn en las dos ramas y aun así 2345→2419 tiradas.
 */
export async function armRngCount(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __u5rng: { n: number; seed: number } }).__u5rng = { n: 0, seed: -1 };
  });
}

/** Lee el contador de pasos y la semilla viva (`n=-1` si el instrumento no está armado). */
export async function rngCountRead(page: Page): Promise<{ n: number; seed: number }> {
  return page.evaluate(
    () =>
      (window as unknown as { __u5rng?: { n: number; seed: number } }).__u5rng ?? {
        n: -1,
        seed: -1,
      },
  );
}
