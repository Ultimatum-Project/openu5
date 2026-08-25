/**
 * VISIBILIDAD DE UN GUIÓN — el instrumento que la regla del MANIFIESTO ORDENA usar
 * («Antes de grabar un guión nuevo, pásalo por la visibilidad del port»,
 * `game/partidas/MANIFIESTO.md` §los-que-se-grabaron-y-NO-se-publican). Ficha #255:
 * la regla existía y la herramienta que la cumple no, porque murió con el scratchpad
 * del carril que la escribió.
 *
 * ── QUÉ CONTESTA ─────────────────────────────────────────────────────────────────────
 * (a) `--mapa`: el mapa 32×32 con las CELDAS VISIBLES que la party vería desde cada
 *     casilla. Es el que dice de un vistazo dónde están los claros y dónde el bosque
 *     cerrado (9 de 121) que dejó negro el póster del guión retirado del 13-08.
 * (b) por defecto: la SIMULACIÓN del guión tecla a tecla —
 *     `paso · tecla · acción · posición · tile · visibles/121 · BLOQUEADO` — y al final
 *     las CUATRO magnitudes con las que el MANIFIESTO carea un itinerario contra otro:
 *     mínimo, media, pasos por debajo del umbral y «Blocked!».
 *
 * ── EL RÉGIMEN NO SE ELIGE AQUÍ: SE LEE DEL PORT ─────────────────────────────────────
 * La cifra la produce `computeVisibleWindow` (`game/src/core/world/visibility.ts`), el
 * MISMO módulo que censura la ventana que pinta el juego, sobre el MISMO
 * `smallmaps.json` de la extracción. La luz sale de `lightLevel()` con el reloj del
 * momento (8:35 → 0x32 = 50 en el momento-01), no de un 50 escrito a mano; `--luz N`
 * la fuerza para explorar otros regímenes. Los pasos los adjudica `resolveStep()` y las
 * puertas `DoorManager`, las dos clases del port: esta herramienta no reimplementa
 * ninguna regla del juego, sólo las encadena.
 *
 * ── LAS DOS TRAMPAS QUE MORDIERON AL AUTOR ORIGINAL, Y CÓMO SE EVITAN ────────────────
 * 🔴 (O)pen y (L)ook son los DOS direccionales: la flecha que va detrás de un comando
 *    direccional ES SU ARGUMENTO, no un paso. El guión de `regreso` lleva SEIS Looks, así
 *    que quien cuente toda flecha como paso simula una ruta desplazada seis casillas —
 *    y no falla: da un itinerario plausible y equivocado. Aquí el conjunto de teclas
 *    direccionales NO está copiado a mano: se DERIVA de `game/src/main.ts` (los bloques
 *    `if (key === "x")` que asignan `pendingDirCommand`), y si esa derivación devuelve
 *    menos de cinco teclas o pierde la (o)/(l), el programa ABORTA en vez de simular con
 *    un censo vacío. Una tecla que el guión use y esta herramienta no sepa modelar sale
 *    marcada `⚠ NO MODELADO` y el proceso termina con exit 3: una ruta que puede estar
 *    desplazada no se entrega en verde.
 * 🔴 El relleno de fuera del mapa NO es `TOWN_EDGE_FILLER_TILE`, y creer que sí mueve la
 *    cifra publicada. La ficha #255 lo enunciaba como «el relleno fuera-de-mapa es
 *    TOWN_EDGE_FILLER_TILE = 5 (hierba, transparente): las casillas del borde miden alto
 *    sin ser un claro» — y **en la cabaña de Iolo eso es falso y además invertido**. Son
 *    DOS reglas distintas del binario:
 *      · el PASO usa la constante 5 (`movement.ts:99`; sustituirla por el mapa mete una
 *        divergencia — ficha #42), y por eso el borde SE PUEDE cruzar;
 *      · la VISTA usa `map.edgeFillTile` = la celda (31,31) del propio mapa (kernel
 *        0x4402 → puntero fijo 0x6A07), que es lo que hace `terrainAt` en
 *        `skin/coreview.ts:1002-1012` y lo que se calca aquí.
 *    MEDIDO en loc 13 z0: (31,31) = 0x09 Forest3, que está en `ALWAYS_OPAQUE` ⇒ el relleno
 *    de este mapa TAPA, no deja ver. Las filas/columnas 0 y 31 del volcado se marcan con
 *    `·` y la leyenda dice cuál de las dos cosas hace el relleno EN ESTE mapa, en vez de
 *    afirmarlo de todos.
 *    ★ Y la diferencia no es teórica: con el relleno del port la media de `regreso` sale
 *    91,9 por tecla, y forzando el 5 sale 93,99 — que es la cifra «media 55,8/93,9» que
 *    hoy publica la tabla del MANIFIESTO. `--relleno <tile>` existe para CAREAR con
 *    mediciones viejas hechas bajo ese otro régimen; el defecto es el del port.
 *    (Las otras tres magnitudes de la fila —mínimo 57, 0 pasos bajo 40, 0 «Blocked!»— son
 *    IGUALES bajo los dos regímenes: lo que el MANIFIESTO decide con ellas no se mueve.)
 *
 * ── LO QUE ESTA HERRAMIENTA NO MODELA (declarado, no omitido) ────────────────────────
 * · NPCs: en el port un NPC en la casilla destino bloquea el paso SIN mensaje
 *   (`game.ts:1230`). Aquí no corre la IA (necesita el stream vivo del RNG), así que se
 *   imprime el CENSO de puestos de horario de la localización y se marca `⚑` el paso que
 *   caiga sobre uno: el tamaño de la omisión queda a la vista en vez de en el olvido.
 * · Capa de objetos de mundo (cofres/antorchas sueltas/naves) y overrides de partida:
 *   viven en `Game`, no en el mapa estático. Un guión que abra cofres no se simula aquí.
 * · La capa horaria de rejas SÍ se modela (`TownHourTiles`, la clase del port).
 *
 * Uso (desde la raíz del worktree):
 *   node --import tsx game/tools/guion-visibilidad.mjs game/partidas/guiones/regreso.txt
 *   node --import tsx game/tools/guion-visibilidad.mjs game/partidas/guiones/regreso.txt --mapa
 *   node --import tsx game/tools/guion-visibilidad.mjs --momento momento-01 --control-muro
 *
 * El momento se deduce del `game/partidas/<id>.json` hermano del guión; para un guión
 * NUEVO (que aún no tiene partida) se nombra con `--momento <id>`. Otras banderas:
 * `--luz N` (fuerza el nivel de luz), `--umbral N` (el 40 de la tabla del MANIFIESTO),
 * `--relleno <tile>` (careo con mediciones viejas, ver arriba).
 *
 * 🔴 En zsh, `node … $VAR` con VAR="--relleno 5" NO parte la variable en dos argumentos
 * (zsh no hace word-splitting): la bandera llega pegada, no casa con ninguna, y la corrida
 * sale con el DEFECTO puesto y sin avisar. Me pasó midiendo justo esto: dos regímenes
 * distintos dieron cifras idénticas y la primera lectura fue «el relleno da igual».
 * Escribe las banderas literales en la línea de órdenes, o usa un array.
 *
 * 🔴 Depende de material de EA (`game/assets`, gitignored) ⇒ NO va en la batería.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { getActiveMap } from "../src/core/world/map.js";
import {
  computeVisibleWindow,
  isSightBlocking,
  WINDOW,
  CENTER,
} from "../src/core/world/visibility.js";
import { DIRECTION_DELTA, isPassable, resolveStep } from "../src/core/world/movement.js";
import { DoorManager, unmagicDoorTile } from "../src/core/world/doors.js";
import { buildUseRows } from "../src/core/usePicker.js";
import { componeMomento } from "../src/momentos/compone.js";
import { TownHourTiles } from "../src/core/world/townHourTiles.js";
import { lightLevel } from "../src/core/world/survival.js";
import { tileInfo } from "../src/core/tiles.js";
import { momentoPorId } from "../src/momentos/defs.js";
import { scheduleIndex } from "../src/core/time.js";

const ROOT = new URL("../..", import.meta.url).pathname;
const CELLS = WINDOW * WINDOW; // 121

// ── ARGUMENTOS ───────────────────────────────────────────────────────────────────────
const VALUE_FLAGS = new Set(["--momento", "--luz", "--umbral", "--relleno"]);
const flags = new Map();
const positional = [];
for (let i = 0; i < process.argv.length - 2; i++) {
  const a = process.argv[i + 2];
  if (VALUE_FLAGS.has(a)) flags.set(a, process.argv[i + 3]), i++;
  else if (a.startsWith("--")) flags.set(a, true);
  else positional.push(a);
}
const flagValue = (name) => (flags.has(name) ? flags.get(name) : null);
const scriptPath = positional[0] ?? null;
const wantMap = flags.has("--mapa");
const wantWallControl = flags.has("--control-muro");
const threshold = Number(flagValue("--umbral") ?? 40);

if (!scriptPath && !wantWallControl) {
  console.error(
    "uso: node --import tsx game/tools/guion-visibilidad.mjs <guion.txt> [--momento <id>]\n" +
      "                                                    [--mapa] [--luz N] [--umbral N]\n" +
      "     node --import tsx game/tools/guion-visibilidad.mjs --momento <id> --control-muro",
  );
  process.exit(2);
}

// ── EL MOMENTO: de dónde arranca la party ────────────────────────────────────────────
// Si no se nombra, se deriva del `game/partidas/<id>.json` hermano del guión (su `base.id`),
// que es el mismo emparejamiento que usa `partida-graba.mjs <id-partida> <id-momento>`.
let momentId = flagValue("--momento");
if (!momentId && scriptPath) {
  const id = basename(scriptPath).replace(/\.txt$/, "");
  const partida = resolve(ROOT, "game/partidas", `${id}.json`);
  if (existsSync(partida)) momentId = JSON.parse(readFileSync(partida, "utf8")).base?.id ?? null;
}
if (!momentId) {
  console.error(
    "no sé de qué momento arranca este guión: no hay `game/partidas/<id>.json` hermano.\n" +
      "Nómbralo con --momento <id-momento> (p. ej. --momento momento-01).",
  );
  process.exit(2);
}
const moment = momentoPorId(momentId);
if (!moment) {
  console.error(`momento desconocido: ${momentId}`);
  process.exit(2);
}

// ── EL MUNDO ─────────────────────────────────────────────────────────────────────────
const MAPS_FILE = resolve(ROOT, "game/assets/maps/smallmaps.json");
if (!existsSync(MAPS_FILE)) {
  console.error(`falta la extracción local: ${MAPS_FILE} (material de EA, gitignored)`);
  process.exit(2);
}
const smallMaps = new Map(
  JSON.parse(readFileSync(MAPS_FILE, "utf8")).map((loc) => [loc.id, loc]),
);
const world = { overworld: [], underworld: [], smallMaps };

const start = moment.estado.position;
if (start.location === 0) {
  console.error(
    `el momento ${momentId} arranca en mapa GRANDE (location 0) y esta herramienta simula\n` +
      "small maps 32×32 (el régimen escrito en el MANIFIESTO). No se simula.",
  );
  process.exit(2);
}
const baseMap = getActiveMap(world, start.location, start.floor);

/**
 * El INVENTARIO sale del estado COMPUESTO del momento, no de la definición: es el que
 * `buildUseRows` necesita para saber qué filas ofrece el picker de (U)se, y con él el índice
 * de la Skull Key deja de ser un número contado a mano (ficha #232 — el guión de blackthorn
 * declara «índice 16 DERIVADO» y hasta hoy nada lo comprobaba). Sin la extracción no hay
 * inventario: los campos de posición/tiempo de abajo mandan igual y el picker se declara
 * NO MODELADO en cuanto un guión lo use.
 */
const INIT_FILE = resolve(ROOT, "game/assets/initial-state.json");
const composed = existsSync(INIT_FILE)
  ? componeMomento(moment, JSON.parse(readFileSync(INIT_FILE, "utf8")))
  : null;

const state = {
  ...(composed ?? {}),
  position: { location: start.location, floor: start.floor, x: start.x, y: start.y },
  time: { ...moment.estado.time },
  transport: moment.estado.transport ?? "foot",
  transportTile: moment.estado.transportTile,
  torchTurns: moment.estado.torchTurns ?? 0,
  lightSpellMins: 0,
};

// Mapa COMPUESTO en el mismo orden que `Game.activeMap` (game.ts:897/941): capa horaria
// de rejas primero, capa de puerta-abierta encima. Sin capa de objetos ni overrides —
// declarado arriba.
const doors = new DoorManager();
const hourTiles = new TownHourTiles();
let hourLayerFor = -1;
function refreshHourLayer() {
  if (hourLayerFor === state.time.hour) return;
  hourLayerFor = state.time.hour;
  hourTiles.recompute(
    baseMap,
    start.location,
    start.floor,
    state.time.hour,
    state.position.x,
    state.position.y,
  );
}
/**
 * Terreno VOLÁTIL: el equivalente de `Game.setVolatileTerrain` (#119), el búfer vivo donde
 * la Skull Key escribe su 0xB8. Va DESPUÉS de la capa horaria y ANTES de la de puerta
 * abierta, igual que en `Game.activeMap` (game.ts:920-932: `volatileTerrain ?? overrides ??
 * baseHour`, y `doors.effectiveTile` encima).
 */
const volatileTerrain = new Map();
const map = {
  ...baseMap,
  tileAt: (x, y) => {
    const withHour = hourTiles.effectiveTile(
      start.location,
      start.floor,
      x,
      y,
      baseMap.tileAt(x, y),
    );
    const volatil = volatileTerrain.get(`${x}:${y}`) ?? withHour;
    return doors.effectiveTile(start.location, start.floor, x, y, volatil);
  },
};
refreshHourLayer();

const light = Number(flagValue("--luz") ?? lightLevel(state));

// ── LA VISIBILIDAD, CON EL SAMPLER DEL PORT ──────────────────────────────────────────
// Copia exacta de `skin/coreview.ts:1002-1012`: dentro del mapa, el tile; fuera, la celda
// (31,31) (`edgeFillTile`, kernel 0x4402 → puntero fijo 0x6A07), y sólo si no la hubiera,
// 0xff (opaco). Las moongates horneadas de aquel sampler son de overworld: aquí no aplican.
const edgeFill = flags.has("--relleno")
  ? Number(flagValue("--relleno"))
  : baseMap.edgeFillTile >= 0
    ? baseMap.edgeFillTile
    : 0xff;
function terrainSampler(cx, cy) {
  return (col, row) => {
    const tx = cx - CENTER + col;
    const ty = cy - CENTER + row;
    if (map.wraps || (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height)) {
      return map.tileAt(tx, ty);
    }
    return edgeFill;
  };
}
function visibleFrom(x, y) {
  const field = computeVisibleWindow(light, terrainSampler(x, y));
  let n = 0;
  for (const v of field) if (v) n++;
  return n;
}

function tileName(tile) {
  try {
    return tileInfo(tile & 0xff).name || `tile${tile}`;
  } catch {
    return `tile${tile}`;
  }
}
const hex = (t) => `0x${(t & 0xff).toString(16).padStart(2, "0")}`;

// ── NPCs: no se modelan, se CENSAN (puestos de horario del momento) ──────────────────
function npcPosts() {
  const file = resolve(ROOT, "game/assets/npcs.json");
  if (!existsSync(file)) return null;
  const slots = JSON.parse(readFileSync(file, "utf8"))[String(start.location)] ?? [];
  return slots
    .map((s) => {
      const k = scheduleIndex(s.times, state.time.hour);
      return { slot: s.slot, type: s.type, x: s.x[k], y: s.y[k], z: s.z[k] };
    })
    // El slot 0 con todo a cero es el hueco del fichero .NPC, no un vecino.
    .filter((n) => n.z === start.floor && !(n.x === 0 && n.y === 0 && n.type === 0));
}

// ── TECLAS: el mapa se DERIVA de main.ts, no se copia ────────────────────────────────
const MAIN_TS = resolve(ROOT, "game/src/main.ts");
const mainLines = readFileSync(MAIN_TS, "utf8").split("\n");

/** `KEY_DIRECTIONS` de main.ts — las cuatro flechas y su dirección. */
function deriveArrowKeys() {
  const out = new Map();
  const from = mainLines.findIndex((l) => l.includes("const KEY_DIRECTIONS"));
  if (from >= 0) {
    for (let i = from + 1; i < mainLines.length && !mainLines[i].startsWith("};"); i++) {
      const m = /^\s*(\w+):\s*"(\w+)"/.exec(mainLines[i]);
      if (m) out.set(m[1], m[2]);
    }
  }
  if (out.size !== 4) {
    console.error(
      `derivación ROTA: KEY_DIRECTIONS de ${MAIN_TS} dio ${out.size} entradas y son CUATRO.\n` +
        "Sin el mapa de flechas la simulación no vale; se aborta en vez de inventarlo.",
    );
    process.exit(4);
  }
  return out;
}

/**
 * Teclas de COMANDO DIRECCIONAL: los bloques `if (key === "x") { … pendingDirCommand = "cmd" }`
 * de main.ts. Se derivan porque son la trampa nº1 de esta herramienta — un conjunto copiado
 * a mano se queda rancio en cuanto la flota añade un direccional, y el síntoma sería una ruta
 * desplazada, no un error.
 */
function deriveDirCommandKeys() {
  const out = new Map();
  let currentKey = null;
  for (const line of mainLines) {
    const k = /if \(key === "(\w)"\) \{/.exec(line);
    if (k) currentKey = k[1];
    const c = /pendingDirCommand = "(\w+)"/.exec(line);
    if (c && currentKey) out.set(currentKey, c[1]);
  }
  if (out.size < 5 || !out.has("o") || !out.has("l")) {
    console.error(
      `derivación ROTA: el censo de comandos direccionales de ${MAIN_TS} dio ` +
        `${out.size} teclas (${[...out.keys()].join(",") || "ninguna"}) y faltan la (o) y/o la (l).\n` +
        "Un censo así se lee como «no hay direccionales» y desplaza la ruta entera; se aborta.",
    );
    process.exit(4);
  }
  return out;
}

const ARROWS = deriveArrowKeys();
const DIR_KEYS = deriveDirCommandKeys();
/**
 * (U)se abre un PICKER: sus flechas mueven la selección de la lista, no la party, y la
 * cierra Enter/Escape. Es el único modo no-direccional que traga flechas y está modelado
 * porque los guiones de los rituales lo usan (`faulinei`: `u` + 17 abajo + Enter).
 *
 * 🔴 Y EL PICKER NO TERMINA EN EL ENTER: hay ítems cuyo Enter abre OTRO getdir, así que la
 * flecha SIGUIENTE es el argumento del ítem y NO un paso (ficha #232). Es la trampa nº1 de
 * esta herramienta —la misma que la de (O)pen y (L)ook— por un camino que no se veía: llega
 * después de un Enter, no después de una letra. Con el modelo viejo, el guión `blackthorn`
 * daba `BLOQUEADO` en la flecha que en el motor ES el getdir de la Skull Key, y la lectura
 * natural de ese renglón era «la llave no abre» — el falso positivo entero de #232.
 * El cursor se mueve como `itemPageKey` (itemPageController.ts:63-77): ±1 por flecha,
 * ACOTADO a [0, filas-1] (no envuelve), y `Enter` elige la fila del cursor.
 */
const PICKER_KEYS = new Set(["u"]);
/**
 * Acciones de `buildUseRows` cuyo Enter deja un getdir pendiente en `main.ts`. Hoy sólo la
 * Skull Key entre las que los guiones usan; el resto de ítems del picker (pociones,
 * pergaminos, catalejo…) cierran y ejecutan sin dirección. Una acción NO listada que sí
 * pidiera dirección volvería a desplazar la ruta, así que el conjunto se DERIVA de main.ts
 * igual que los direccionales: los `a.kind === "..."` que ponen un `pendingXxx = true`.
 */
function derivePickerDirActions() {
  const out = new Set();
  for (let i = 0; i < mainLines.length; i++) {
    const m = /if \(a\.kind === "(\w+)"\)/.exec(mainLines[i]);
    if (!m) continue;
    // El cuerpo del `if` cabe en las seis líneas siguientes en todos los casos de hoy.
    const body = mainLines.slice(i + 1, i + 7).join("\n");
    if (/pending\w+ = true/.test(body)) out.add(m[1]);
  }
  return out;
}
const PICKER_DIR_ACTIONS = derivePickerDirActions();

/**
 * Filas del picker de (U)se con el inventario VIVO (`buildUseRows`, la clase del port), o
 * `null` sin extracción. Se recalcula por pulsación porque el inventario se mueve: gastar la
 * Skull Key la deja en 2, y con 0 la fila DESAPARECE de la lista — que es justo el defecto
 * que #232 documenta en el def del momento-06 («con las 0 skull keys que heredaba de
 * INIT.GAM la entrada ni siquiera aparecía en el menú»).
 */
function pickerRows() {
  if (!composed) return null;
  return buildUseRows(state);
}

// ── SIMULACIÓN ───────────────────────────────────────────────────────────────────────
function loadScript(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean);
}

function simulate(keys) {
  const posts = npcPosts() ?? [];
  const rows = [];
  // {kind:"dir", cmd} | {kind:"picker", cmd, cursor} | {kind:"useDir", action}
  let pending = null;
  let steps = 0;
  let blocked = 0;
  let unmodelled = 0;
  const counts = [];

  const record = (key, action, note = "") => {
    const { x, y } = state.position;
    const vis = visibleFrom(x, y);
    counts.push(vis);
    const onPost = posts.find((n) => n.x === x && n.y === y);
    rows.push({
      i: rows.length + 1,
      key,
      action,
      x,
      y,
      tile: map.tileAt(x, y),
      vis,
      note: (onPost ? `⚑ NPC slot ${onPost.slot} ` : "") + note,
    });
  };

  for (const key of keys) {
    // ── flechas ──
    if (ARROWS.has(key)) {
      const dir = ARROWS.get(key);
      if (pending?.kind === "dir") {
        const cmd = pending.cmd;
        pending = null;
        if (cmd === "open") {
          const { dx, dy } = DIRECTION_DELTA[dir];
          const tx = state.position.x + dx;
          const ty = state.position.y + dy;
          // Puerta: `mapTileWithOverrides` lee SIN la capa de puerta-abierta (game.ts:3167)
          // pero SÍ con la volátil — es la que trae el 0xB8 que acaba de escribir la Skull
          // Key. 🔴 Leer aquí `baseMap` a secas devolvía el 0x97 de disco y el (O)pen decía
          // «Locked!» con la puerta ya desmagificada: el instrumento contaba la misma
          // historia falsa de #232 un paso más allá.
          const target =
            volatileTerrain.get(`${tx}:${ty}`) ??
            hourTiles.effectiveTile(start.location, start.floor, tx, ty, baseMap.tileAt(tx, ty));
          const { message, opened } = doors.open(state, tx, ty, target);
          if (opened) advanceTurns(1); // turno SÓLO al abrir (game.ts:3172)
          record(key, `${cmd}-${dir}`, `${message} (${tx},${ty}) ${hex(target)}`);
        } else {
          // (L)ook y el resto de direccionales NO consumen turno en el port (no hay
          // runContextTurn en `Game.look`), así que las puertas tampoco corren.
          record(key, `${cmd}-${dir}`, "");
        }
        continue;
      }
      if (pending?.kind === "picker") {
        // Cursor de `itemPageKey` (itemPageController.ts:63-77): ±1 ACOTADO, no envuelve.
        const filas = pickerRows();
        const antes = pending.cursor;
        if (filas) {
          const delta = dir === "north" ? -1 : dir === "south" ? 1 : 0;
          pending.cursor = Math.max(0, Math.min(filas.length - 1, antes + delta));
        }
        const nota = filas
          ? `fila ${pending.cursor}/${filas.length - 1} · ${filas[pending.cursor]?.name ?? "?"}`
          : "flecha de la lista, no mueve (sin extracción: filas NO modeladas)";
        record(key, `picker(${pending.cmd})`, nota);
        continue;
      }
      if (pending?.kind === "useDir") {
        // getdir del ítem elegido (Skull Key: CAST.OVL 0x18dd). La flecha es el ARGUMENTO.
        const accion = pending.action;
        pending = null;
        if (accion === "skullKey") {
          const { dx, dy } = DIRECTION_DELTA[dir];
          const tx = state.position.x + dx;
          const ty = state.position.y + dy;
          const nuevo = unmagicDoorTile(map.tileAt(tx, ty));
          // La llave se gasta SIEMPRE (0x18c4 `dec`, ANTES del getdir y del test de tile).
          if (state.skullKeys > 0) state.skullKeys--;
          if (nuevo !== null) volatileTerrain.set(`${tx}:${ty}`, nuevo);
          record(
            key,
            `skullKey-${dir}`,
            nuevo === null
              ? `no era puerta mágica (${tx},${ty}) ${hex(map.tileAt(tx, ty))} · llave gastada igual`
              : `${hex(0x97)}→${hex(nuevo)} en (${tx},${ty}) · SIGUE CERRADA: falta (O)pen`,
          );
        } else {
          unmodelled++;
          record(key, `⚠ getdir de ${accion} NO MODELADO`, "la ruta a partir de aquí puede estar desplazada");
        }
        continue;
      }
      // ── paso de verdad ──
      // 🔴 `resolveStep` MUEVE: escribe `state.position` en su cola (movement.ts:364-365)
      // pese a llamarse «geometría de un paso» y a no devolver coordenadas. Aplicar
      // además el delta a mano —lo primero que uno escribe— DUPLICA cada paso y produce
      // una ruta que avanza de dos en dos con pinta de mapa mal extraído.
      const step = resolveStep(state, map, dir);
      if (step.moved) steps++;
      if (step.blocked) blocked++;
      if (step.minutes > 0) advanceTurns(step.minutes);
      const action = step.exitedMap
        ? "SALE DEL MAPA"
        : step.blocked
          ? "BLOQUEADO"
          : `paso ${dir}`;
      record(key, action, step.message ?? "");
      if (step.exitedMap) {
        rows[rows.length - 1].note = "el port abriría «Dost thou wish to leave?»; se para aquí";
        break;
      }
      continue;
    }
    // ── Enter/Escape: cierran el picker ──
    // 🔴 Enter ELIGE la fila del cursor, y si esa fila pide dirección deja un getdir
    // pendiente: la flecha siguiente NO es un paso (#232). Escape cierra sin elegir.
    if (key === "Enter" || key === "Escape") {
      if (key === "Enter" && pending?.kind === "picker") {
        const filas = pickerRows();
        const fila = filas?.[pending.cursor];
        if (!filas) {
          unmodelled++;
          pending = null;
          record(key, "cierra picker(u)", "⚠ sin extracción no sé QUÉ ítem se eligió: la ruta puede estar desplazada");
          continue;
        }
        const accion = fila?.action.kind;
        const pideDir = accion !== undefined && PICKER_DIR_ACTIONS.has(accion);
        pending = pideDir ? { kind: "useDir", action: accion } : null;
        record(
          key,
          `elige «${fila?.name ?? "?"}» (fila ${filas.indexOf(fila)})`,
          pideDir ? "abre getdir: la flecha siguiente es SU DIRECCIÓN, no un paso" : "",
        );
        continue;
      }
      const was = pending?.kind === "picker" ? `cierra picker(${pending.cmd})` : key;
      pending = null;
      record(key, was, "");
      continue;
    }
    // ── comandos ──
    if (DIR_KEYS.has(key)) {
      pending = { kind: "dir", cmd: DIR_KEYS.get(key) };
      record(key, `(${key}) ${DIR_KEYS.get(key)} — espera dirección`, "");
      continue;
    }
    if (PICKER_KEYS.has(key)) {
      pending = { kind: "picker", cmd: key, cursor: 0 };
      const filas = pickerRows();
      record(key, `(${key}) abre lista`, filas ? `${filas.length} filas · cursor 0` : "filas NO modeladas");
      continue;
    }
    unmodelled++;
    record(key, `⚠ NO MODELADO`, "si traga flechas, la ruta a partir de aquí está desplazada");
  }
  return { rows, steps, blocked, unmodelled, counts, posts };
}

/** Corre el reloj `n` minutos y hace correr las puertas un turno (game.ts:2196/2393). */
function advanceTurns(n) {
  const t = state.time;
  t.minute += n;
  while (t.minute >= 60) {
    t.minute -= 60;
    t.hour = (t.hour + 1) % 24;
  }
  refreshHourLayer();
  doors.tick();
}

// ── SALIDAS ──────────────────────────────────────────────────────────────────────────
function printHeader() {
  console.log(`MOMENTO      ${momentId} — ${moment.titulo.es}`);
  console.log(
    `MAPA         ${baseMap.location} ${smallMaps.get(baseMap.location).name} · planta ${baseMap.floor}` +
      ` · relleno de borde (31,31) = ${hex(baseMap.edgeFillTile)} ${tileName(baseMap.edgeFillTile)}` +
      (flags.has("--relleno") ? ` · FORZADO a ${hex(edgeFill)} ${tileName(edgeFill)} (--relleno)` : ""),
  );
  console.log(
    `RÉGIMEN      computeVisibleWindow(${light}, …) · reloj ${String(moment.estado.time.hour).padStart(2, "0")}:` +
      `${String(moment.estado.time.minute).padStart(2, "0")} · transporte ${state.transport}` +
      ` · ventana ${WINDOW}×${WINDOW} = ${CELLS} celdas`,
  );
  console.log(`ARRANQUE     (${start.x},${start.y})`);
  console.log("");
}

function printMap() {
  const W = 32;
  const fill = edgeFill;
  // ¿El relleno TAPA o deja ver? Lo contesta el predicado del port (`isSightBlocking`) con
  // radial 2 = «no adyacente», que es el régimen de una celda de fuera del mapa.
  const fillBlocks = fill >= 0 && isSightBlocking(fill, 2);
  console.log("VOLCADO DEL MAPA — celdas visibles de 121 desde cada casilla (mapa al cargar el momento)");
  console.log(
    "  «#» = casilla no transitable a pie (su cifra no se calcula).\n" +
      `  «·» = fila/columna del BORDE: su cuenta incluye el relleno de fuera del mapa, que en ESTE mapa\n` +
      `        es ${hex(fill)} ${tileName(fill)} (${fillBlocks ? "OPACO ⇒ el borde tapa" : "TRANSPARENTE ⇒ el borde mide alto sin ser un claro"}).`,
  );
  const header = "     " + Array.from({ length: W }, (_, x) => String(x).padStart(4)).join("");
  console.log(header);
  for (let y = 0; y < W; y++) {
    let line = String(y).padStart(3) + "  ";
    for (let x = 0; x < W; x++) {
      const tile = map.tileAt(x, y);
      const edge = x === 0 || y === 0 || x === W - 1 || y === W - 1;
      const cell = isPassable(tile, state.transport) ? String(visibleFrom(x, y)) : "#";
      line += (edge ? "·" : " ") + cell.padStart(3);
    }
    console.log(line);
  }
  console.log("");
}

function printSimulation(sim) {
  console.log(
    "idx  tecla        acción                       posición   tile                        vis/121",
  );
  for (const r of sim.rows) {
    console.log(
      String(r.i).padStart(3) +
        "  " +
        r.key.padEnd(12) +
        r.action.padEnd(29) +
        `(${r.x},${r.y})`.padEnd(11) +
        `${hex(r.tile)} ${tileName(r.tile)}`.padEnd(28) +
        String(r.vis).padStart(3) +
        (r.note ? `   ${r.note}` : ""),
    );
  }
  console.log("");
  const c = sim.counts;
  const moved = sim.rows.filter((r) => r.action.startsWith("paso")).map((r) => r.vis);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const min = Math.min(...c);
  const below = c.filter((v) => v < threshold).length;
  console.log("RESUMEN (mismas cuatro magnitudes que la tabla del MANIFIESTO)");
  console.log(`  teclas .................. ${c.length}   (pasos que MUEVEN: ${sim.steps})`);
  console.log(`  celdas visibles mínimo .. ${min}`);
  // 🔴 LA MEDIA LLEVA SU DENOMINADOR. Una tecla que no mueve (un Look, la flecha de un
  // Open) repite la casilla anterior, así que promediar «por tecla» pesa dos veces las
  // casillas donde el guión se para a mirar — y da una cifra DISTINTA de promediar «por
  // paso». Las dos son verdaderas y no son la misma: se imprimen las dos con su nombre.
  console.log(`  media por TECLA (${String(c.length).padStart(3)}) ..... ${mean(c).toFixed(1)}`);
  console.log(
    `  media por PASO  (${String(moved.length).padStart(3)}) ..... ` +
      (moved.length ? mean(moved).toFixed(1) : "— (ningún paso movió)"),
  );
  console.log(`  teclas con < ${String(threshold).padEnd(3)} ....... ${below}`);
  console.log(`  «Blocked!» .............. ${sim.blocked}`);
  console.log(
    `  posición final .......... (${state.position.x},${state.position.y}) ` +
      `${hex(map.tileAt(state.position.x, state.position.y))} ${tileName(map.tileAt(state.position.x, state.position.y))}`,
  );
  if (sim.posts.length) {
    console.log(
      `  NPCs de la localización . ${sim.posts.length} puestos de horario (NO simulados): ` +
        sim.posts.map((n) => `slot ${n.slot}@(${n.x},${n.y})`).join(" · "),
    );
  }
  if (sim.unmodelled) {
    console.log(
      `\n⚠ ${sim.unmodelled} tecla(s) SIN MODELAR en el guión: la ruta simulada puede estar ` +
        "desplazada.\n  Modelar su despacho en esta herramienta antes de creerse las cifras.",
    );
  }
  return sim.unmodelled ? 3 : 0;
}

// ── CONTROL NEGATIVO: la herramienta trae su propia refutación ────────────────────────
/**
 * Genera un guión SINTÉTICO que camina contra el muro más cercano al arranque y comprueba
 * que la simulación imprime BLOQUEADO en el paso EXACTO en que la party llega a él. La
 * dirección y el número de pasos se DERIVAN del mapa (no se cablean), así que el control
 * sigue valiendo si cambia la extracción. Exit 0 = el control se comporta; exit 1 = la
 * herramienta no sabe ver un muro y ninguna de sus cifras vale.
 */
function wallControl() {
  const { x: x0, y: y0 } = state.position;
  let best = null;
  for (const [arrow, dir] of ARROWS) {
    const { dx, dy } = DIRECTION_DELTA[dir];
    for (let n = 1; n <= 6; n++) {
      const tx = x0 + dx * n;
      const ty = y0 + dy * n;
      if (tx < 0 || ty < 0 || tx > 31 || ty > 31) break;
      if (!isPassable(map.tileAt(tx, ty), state.transport)) {
        // Se elige el muro MÁS LEJANO de los cuatro: así el control comprueba las DOS
        // mitades del predicado — que los n−1 pasos previos AVANZAN y que el n-ésimo se
        // bloquea. Con el muro pegado (n=1) el control pasaría sin haber movido nunca,
        // que es un verde que no distingue «sabe ver el muro» de «no sabe andar».
        if (!best || n > best.n) best = { arrow, dir, n, tx, ty };
        break;
      }
    }
  }
  if (!best) {
    console.error("control imposible: no hay muro a ≤6 casillas del arranque en línea recta.");
    return 1;
  }
  const keys = Array.from({ length: best.n }, () => best.arrow);
  console.log(
    `CONTROL NEGATIVO — guión sintético de ${keys.length} × ${best.arrow} contra el muro de ` +
      `(${best.tx},${best.ty}) ${hex(map.tileAt(best.tx, best.ty))} ${tileName(map.tileAt(best.tx, best.ty))}`,
  );
  console.log(
    best.n > 1
      ? `ESPERADO — los pasos 1..${best.n - 1} AVANZAN; el paso ${best.n} imprime BLOQUEADO.\n`
      : `ESPERADO — el paso 1 imprime BLOQUEADO (el muro está pegado al arranque).\n`,
  );
  const sim = simulate(keys);
  printSimulation(sim);
  const blockedAt = sim.rows.filter((r) => r.action === "BLOQUEADO").map((r) => r.i);
  const ok = blockedAt.length === 1 && blockedAt[0] === best.n && sim.steps === best.n - 1;
  console.log(
    ok
      ? `\nCONTROL OK — ${best.n - 1} pasos avanzan y el ${best.n} da BLOQUEADO, como se predijo.`
      : `\nCONTROL ROTO — BLOQUEADO en [${blockedAt.join(",") || "ninguno"}] (esperado [${best.n}]) ` +
          `y ${sim.steps} pasos movidos (esperados ${best.n - 1}).`,
  );
  return ok ? 0 : 1;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────────────
printHeader();
if (wantWallControl) {
  process.exit(wallControl());
}
if (wantMap) printMap();
const keys = loadScript(resolve(ROOT, scriptPath));
console.log(`GUIÓN        ${scriptPath} — ${keys.length} teclas\n`);
process.exit(printSimulation(simulate(keys)));
