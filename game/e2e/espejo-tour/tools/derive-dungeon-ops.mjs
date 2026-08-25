#!/usr/bin/env node
/**
 * WALKTHROUGH-ESPEJO — derive-dungeon-ops.mjs (FASE 3a, paso OFFLINE).
 *
 * Convierte los ecos de INTERIOR DE MAZMORRA que el OCR dejó como `todo` en OPS CONDUCIBLES.
 * Es el paso que faltaba para poder MEDIR los interiores: los 27+21 segmentos `ctx:"dungeon"`
 * marcados `skip:"pendiente-runner"` llegaban con **536 de 539 ops en `todo` y CERO nav** (censo
 * de part16-g05), así que abrirlos sin este paso habría metido ~4000 bloques en el denominador
 * con el port sin pulsar una sola tecla — conformidad 0 por INSTRUMENTO, no por el port.
 *
 * POR QUÉ ES DERIVABLE (y por qué el interior es MÁS reproducible de lo que parecía): el
 * vocabulario del pasillo 3D es RELATIVO AL FACING (`Advance`, `Turn left`, `Turn right`,
 * `Turn around.`, `Back up`), no absoluto como el `>North` del overworld. El diseño lo leyó
 * como una PÉRDIDA («el eco no dice la dirección»), pero para el REPLAY es una GANANCIA:
 * reproducir la misma secuencia relativa desde el mismo estado de entrada reproduce la ruta
 * EXACTA sin necesidad de conocer la celda. Y los ecos son literalmente los strings que el
 * port emite (DS 0x2cc0 «Advance», 0x2ce6 «Back up», 0x2d00 «Turn left», 0x2cda «Turn right»,
 * 0x2d0b «Turn around.», 0xa204 «Search...», 0x84e6 «Dir-», 0xa1a0 «Klimb-»), así que cada op
 * conducido produce su contraparte comparable.
 *
 * CONSERVADOR por diseño (misma doctrina que derive-anchors):
 *  · sólo el vocabulario CERRADO de arriba, casado por distancia de edición normalizada sobre
 *    un alfabeto plegado, con MARGEN exigido sobre el segundo candidato;
 *  · `Search`/`Look` sólo se conducen si la DIRECCIÓN del prompt «Dir-» es legible en el mismo
 *    beat (si no, la tecla de dirección sería inventada → se deja `todo`);
 *  · `(V)iew a gem!` NO se conduce (ruling del lead: la gema es 3e) — se marca `pendingGem`;
 *  · `(O)pen`: el OCR del LP1 trae «Open-What?» en el pasillo y el port NO abre prompt (su
 *    `open` de mazmorra es `openChest` directo, dungeon-cmds.ts case "open") → NO se conduce
 *    y se cuenta como `divergenceCandidate` para el informe (no se tapa, no se arregla aquí);
 *  · el DOMINIO son `ctx:"dungeon"` y las tres RANURAS NEUTRAS del `ctx` (`post-combat` desde
 *    3d; `resume` y `start` desde la ventana `clasif-discrepan` — ver el JSDoc de `CTX_NEUTRO`).
 *    `ctx:"combat"` queda FUERA: ése sí declara contexto, y su RNG es material de 3c, no de 3b.
 *    ⚠ El rótulo de esta línea decía «nada de esto toca los `post-combat`» y llevaba mintiendo
 *    desde 3d, que es precisamente quien los abrió.
 *
 * CLASIFICACIÓN (3b vs 3c): entre los `ctx:"dungeon"` hay DOS materiales distintos — pasillo
 * (navegación) y SALA (combate de sala: «Entering room..», «Attack-Aim!», «... killed!»). El
 * ruling manda medir el modelo de anclas de interior SIN el ruido del RNG de combate (3c), así
 * que sólo se ABREN los de pasillo; los de sala quedan cerrados con su razón declarada.
 *
 *   node tools/derive-dungeon-ops.mjs ad17                      # una parte
 *   node tools/derive-dungeon-ops.mjs --all --routes routes-ad   # corpus AD entero
 *   node tools/derive-dungeon-ops.mjs --all --dry                # censo sin escribir
 *   node tools/derive-dungeon-ops.mjs --all --census             # tabla de clasificación
 *   node tools/derive-dungeon-ops.mjs --all --visits             # ¿cadena de visita completa?
 *
 * La lógica PURA se exporta para los unit tests (tests/espejo-dungeon-ops.test.ts).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// ★ #55 — el reconocedor de la COLA DE ROSTER es el DE LA CASA, no uno nuevo. `isRosterTail`
// consulta `isEquipWord`, así que el vocabulario de armamento sigue siendo UNO solo: el guarda
// de aquí y el del comparador no pueden divergir. (Node 22 importa el .ts por type-stripping;
// el tool sigue corriendo como `node tools/derive-dungeon-ops.mjs` sin build.)
import { isRosterTail } from "../ocr-profile.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// --------------------------------------------------------------- alfabeto plegado
/**
 * Plegado de glifos para el casado del VOCABULARIO CERRADO. Es MÁS agresivo que el colapso
 * del comparador (ocr-profile.ts) porque aquí no se compara texto libre: se elige entre 12
 * comandos mutuamente muy distintos, así que plegar los sumideros de OCR (`8earch`/`5earch`/
 * `Seuroh`, `Advunee`/`Advanoe`, `K]lmb-Uvwn`) no puede confundir dos comandos entre sí. Se
 * aplica a AMBOS lados (también al vocabulario), como el resto del espejo.
 */
const FOLD = new Map();
for (const [chars, to] of [
  ["0o6c", "o"],
  ["1li|][!", "i"],
  ["58gs", "s"],
  ["uvy", "u"],
]) {
  for (const ch of chars) FOLD.set(ch, to);
}

/** Pliega a `[a-z]` (los dígitos ya caen en su letra por FOLD; el resto se descarta). */
export function foldEcho(s) {
  let out = "";
  for (const ch of String(s ?? "").toLowerCase()) {
    const f = FOLD.get(ch) ?? ch;
    if (f >= "a" && f <= "z") out += f;
  }
  return out;
}

/**
 * Quita la SEGUNDA PASADA FANTASMA del OCR (tokens con comillas internas: `~TnZH"FT6hE""""`)
 * y los marcadores de eco (`~`, `:`, `>`). Deja los tokens legibles en orden. Mismo criterio
 * que ocr-profile.stripGhostPass, aplicado a nivel de token de `todo`.
 */
export function echoTokens(text) {
  return String(text ?? "")
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !/[^\s"]"[^\s"]/.test(tok) && !/^"+$/.test(tok))
    .map((tok) => tok.replace(/^[~:>]+/, ""))
    .filter((tok) => tok.length > 0);
}

/** Distancia de edición (Levenshtein) — sin dependencias, strings cortos. */
export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Similitud normalizada 0..1 sobre el alfabeto plegado. */
export function echoSim(a, b) {
  const fa = foldEcho(a);
  const fb = foldEcho(b);
  if (fa.length === 0 || fb.length === 0) return 0;
  return 1 - editDistance(fa, fb) / Math.max(fa.length, fb.length);
}

// ------------------------------------------------------------------- vocabulario
/**
 * VOCABULARIO CERRADO del pasillo 3D: eco del port (con su cita) → op del runner.
 * `words` = cuántos tokens del OCR consume el eco (para armar el prefijo candidato).
 */
export const DUNGEON_VOCAB = [
  { echo: "Advance", words: 1, op: { dng: "advance" } }, // DS 0x2cc0 (move 0x0502 dir==3)
  { echo: "Back up", words: 2, op: { dng: "back" } }, // DS 0x2ce6 (dir==4)
  { echo: "Turn left", words: 2, op: { dng: "turnLeft" } }, // DS 0x2d00 (dir==1)
  { echo: "Turn right", words: 2, op: { dng: "turnRight" } }, // DS 0x2cda (dir==2)
  { echo: "Turn around.", words: 2, op: { dng: "turnAround" } }, // DS 0x2d0b (0x0533)
  // El "Klimb-" del pasillo NO lo imprime el kernel: su 0xa1a0 está tras `cmp
  // byte [g_location],0 / jne` (ULTIMA.EXE 0x32e8-0x32f3) ⇒ sólo overworld. Con
  // loc≥0x21 el kernel salta a 0x330a → DUNGEON.OVL, que tiene su propia copia
  // BYTE-IDÉNTICA. Ver re/notes/citas-109-acta.md.
  { echo: "Klimb-Up!", words: 1, op: { dng: "klimb", dir: "up" } }, // DS 0x6cce + 0x6c74 (DUNGEON.OVL 0x1efa/0x1c80)
  { echo: "Klimb-Down!", words: 1, op: { dng: "klimb", dir: "down" } }, // DS 0x6cce + 0x6c6c (DUNGEON.OVL 0x1efa/0x1c7b)
  { echo: "Search...", words: 1, op: { dng: "search" } }, // DS 0xa204 (kernel 0x3332)
  { echo: "Look...", words: 1, op: { dng: "look" } }, // DS 0xa1a8+0xa1ae (0x3310)
  { echo: "Ignite torch!", words: 2, op: { dng: "ignite" } }, // DS 0xa188 (CMDS 0x0D98)
  { echo: "Pass", words: 1, op: { dng: "pass" } }, // DS 0xa134 (kernel 0x31F4)
];

/** Ecos que NO son comando (resultado del mundo): jamás deben casar como uno. */
export const DUNGEON_RESULTS = [
  "Blocked!",
  "Not in doorway!",
  "You find:",
  "Nothing hidden",
  "A hidden door!",
  "Pit Trap!",
  "Falling...",
  "Dir-Ahead",
  "Entering room..",
  "Attack-Aim!",
  "View a gem!",
  "Use item",
  "Item: None!",
  "Open-What?",
  "Set active plr",
];

/** Umbral y margen del casado (calibrados contra el corpus real, ver unit tests). */
export const MIN_SIM = 0.62;
export const MIN_MARGIN = 0.07;

/**
 * ★ #55 — COLA DE ROSTER: el eco de comando que el LP nunca dio.
 *
 * El OCR de Diener parte el banner de roster del combate («<Nombre>, armed with <casco, izq,
 * dcha>:», main.ts:1219 / COMBAT.OVL 0x0701-0x07af) en dos lecturas, y la SEGUNDA ya no lleva
 * ni el nombre ni `armed`: sólo la lista de armas y el `:`. Cuando esa mitad huérfana queda
 * pegada detrás de una cabeza que casa el vocabulario del pasillo («Advunoe with Halberd:»),
 * el derivador emitía un op que el LP no hizo — y cada op fabricado MUEVE las candidatas del
 * filtro de mazmorra una celda de más (E-3 §5.8). Tres de la población son `klimb`, o sea
 * FRONTERAS DE PLANTA fabricadas.
 *
 * DISCRIMINA porque `isRosterTail` exige que la cola ENTERA sea vocabulario cerrado de
 * armamento terminado en `:`. Un avance REAL con el banner completo detrás
 * («Advance Barnabas, armed with Halberd:») lo conserva: `Barnabas` y `armed` no son palabras
 * de equipo. Una firma más ancha («acaba en `:`») casaba 277 colas y habría matado avances
 * verdaderos en masa para cazar uno falso.
 *
 * La cola se mide sobre `toks` —ya limpios de la re-lectura fantasma— porque `consumed` cuenta
 * TOKENS DE ÉSOS: cortar el crudo por ese índice está desalineado por construcción y deja
 * escapar los ecos con fantasma EN MEDIO (`Kllmb-Up! jTEh"H%THXFHT"" with Halberd:`).
 */
/**
 * Casado del ENCABEZADO contra el vocabulario, SIN el guarda de #55. Se separa a propósito:
 * es lo que permite AUDITAR el artefacto sin preguntarle al guarda (ver `rosterTailOf`). Un
 * censo escrito sobre `matchDungeonEcho` se absuelve solo — con el guarda puesto devuelve null,
 * el detector no ve nada y el test se pone verde sin que las rutas se hayan regenerado.
 */
function matchVocabHead(text) {
  const toks = echoTokens(text);
  if (toks.length === 0) return null;
  const scored = [];
  for (const v of DUNGEON_VOCAB) {
    const prefix = toks.slice(0, v.words).join(" ");
    scored.push({ v, sim: echoSim(prefix, v.echo) });
  }
  scored.sort((a, b) => b.sim - a.sim || b.v.words - a.v.words);
  const best = scored[0];
  const second = scored[1];
  if (!best || best.sim < MIN_SIM) return null;
  if (second && best.sim - second.sim < MIN_MARGIN) return null;
  return { toks, v: best.v, sim: best.sim };
}

/**
 * La COLA que sigue al eco reconocido, SÓLO si es una cola de roster; si no, null. Sonda de
 * auditoría del artefacto: `matchDungeonEcho` ya no las deja pasar, así que preguntarle a él
 * sería circular.
 *
 * ⚠ La cola se toma INMEDIATAMENTE tras el eco, sin saltarse tokens. Saltárselos ensancha el
 * predicado hasta romper el control negativo: `Advance MnrTnh""nrmgH"" with Magic Axe:` es el
 * banner ENTERO con `Mariah, armed` leído como fantasma (la cabecera de ocr-profile.ts documenta
 * esa lectura exacta), o sea un avance REAL — la misma forma que A.3 pina como preservable.
 */
export function rosterTailOf(text) {
  const m = matchVocabHead(text);
  if (!m) return null;
  const tail = m.toks.slice(m.v.words).join(" ");
  return isRosterTail(tail) ? tail : null;
}

/**
 * ★ #66 — DIFERIDAS del guarda de cola-de-roster, por RULING del lead (ventana #55).
 *
 * Retirar una op fusiona los dos tramos que separaba. Cuando la op es un `klimb` —o sea una
 * FRONTERA DE PLANTA— y los dos tramos TIENEN observaciones, la retirada cambia el conjunto de
 * candidatas de un tramo que hoy mide, y entonces la elección de familia deja de ser inocua:
 *   · si el eco era un resto de redibujado (F2), la fusión es correcta y estrecha con razón;
 *   · si era un `klimb` REAL (F4), se están aplicando observaciones de DOS plantas contra un
 *     solo grid — que es el fallo que el JSDoc de `ObsRun` documenta («la verdad se perdía en
 *     111 de 168 cruces») con forma de precisión.
 *
 * `ad23-g12` ln3458 es el único caso así del corpus: fusiona t2 (9 obs, 46/64) con t3 (3 obs,
 * 64/64) y el resultante queda en 38/64. El artefacto NO lo adjudica —38>0, así que no aparece
 * la contradicción que delataría una fusión errónea— y por eso NO se retira: el estado que
 * aterriza es el CONSERVADOR (la op se queda, el tramo sigue partido). Vía de adjudicación
 * anotada en la tarjeta #66, y es barata: si las 3 obs de t3 sólo casan la planta N+1, el
 * `klimb` era real.
 *
 * Va por segmento + `ocrLn`, NO por el literal: `Kllmb-Up! jTEh"H%THXFHT""` aparece también en
 * `ad18-g15` ln7066 y `ad23-g14` ln3710 con colas DISTINTAS (que no son de roster y por tanto
 * nunca estuvieron en la población). Una excepción por texto habría diferido tres ops en vez de
 * una.
 */
export const ROSTER_TAIL_DEFERRED = [
  { seg: "ad23-g12", ocrLn: 3458, ticket: "#66", dng: "klimb" },
];
const isDeferred = (segId, ocrLn) =>
  ROSTER_TAIL_DEFERRED.some((d) => d.seg === segId && d.ocrLn === ocrLn);

/**
 * Casa el ENCABEZADO de un `todo` contra el vocabulario cerrado. Devuelve
 * `{op, echo, sim, consumed}` o null. Exige (a) similitud ≥ MIN_SIM, (b) MARGEN sobre el
 * segundo mejor candidato — así un eco ambiguo se queda como `todo` en vez de inventar tecla —
 * y (c) que la COLA no sea la mitad huérfana de un banner de roster (#55).
 *
 * `allowRosterTail` levanta SÓLO (c), y existe para las diferidas de `ROSTER_TAIL_DEFERRED`.
 * Es un parámetro y no una rama interna a propósito: el reconocedor sigue siendo puro y la
 * excepción vive donde se puede auditar por identidad.
 */
export function matchDungeonEcho(text, { allowRosterTail = false } = {}) {
  const m = matchVocabHead(text);
  if (!m) return null;
  if (!allowRosterTail && isRosterTail(m.toks.slice(m.v.words).join(" "))) return null;
  return { op: { ...m.v.op }, echo: m.v.echo, sim: Number(m.sim.toFixed(3)), consumed: m.v.words };
}

/**
 * Prompt «Dir-» del (S)earch/(L)ook (DS 0x84e6 + 0x84f2/0x84fa/0x8500/0x8508 =
 * Ahead/Here/Right/Left): dirección legible EN EL MISMO beat, o null.
 *
 * Se busca en la COLA que sigue a «Dir-» y con patrones tolerantes al plegado, porque el
 * corpus trae la palabra corrupta de formas reales: `Dlr-Ahcad` (LP1: e→c, que el plegado
 * manda a o ⇒ `ahoad`), `Dir-Aheud`, `Dlr-Aheud`, `Ulr-Ahead`. Si la cola está PARTIDA
 * (`Dir-s`, `DTFzAhX%H`) devuelve null: la tecla de dirección NO se inventa.
 */
const DIR_PATTERNS = [
  [/ah.ad/, "ahead"], // ahead / ahcad→ahoad / aheud→ahaud
  [/r[iu]s?ht/, "right"], // right→risht (g→s) / rlght→risht
  [/ieft|left/, "left"], // left→ieft (l→i) / [eft→ieft
  [/h[eo]re/, "here"], // here / hcre→hore
];
export function dirFromEcho(text) {
  const folded = foldEcho(text);
  const at = folded.indexOf("dir") >= 0 ? folded.indexOf("dir") : folded.indexOf("uir"); // Ulr-
  if (at < 0) return null;
  const tail = folded.slice(at + 3, at + 3 + 8);
  for (const [re, dir] of DIR_PATTERNS) if (re.test(tail)) return dir;
  return null;
}

// ------------------------------------------------------- clasificación de segmento
/** Firma de SALA (combate de sala): su RNG no está calibrado → material de 3c/3d, no de 3b. */
const ROOM_SIGNS = ["entering room", "attack-aim", "killed!", "wounded!", "missed!", "set active plr"];

/**
 * ¿Es material de PASILLO (medible en 3b) o de SALA (diferido)? Cuenta la firma de sala y los
 * ecos de pasillo reconocidos sobre TODO el texto del segmento (todos + expects).
 */
export function classifyDungeonSegment(seg) {
  const texts = [
    // `from` = eco crudo de una op YA derivada. Sin él la clasificación NO era idempotente: tras
    // convertir, los `todo` desaparecían, navHits se hundía y un pasillo se re-clasificaba como
    // sala y se volvía a cerrar (medido: ad12-g02/ad18-g10/ad23-g12 se cerraron solos en la 2ª
    // corrida del tool). El clasificador tiene que ver el MISMO material en cada pasada.
    ...(seg.script ?? []).map((o) => o.from ?? o.todo ?? o.todoKeep ?? ""),
    ...(seg.expect ?? []).map((b) => b.text ?? ""),
  ];
  const blob = texts.join(" ").toLowerCase();
  let roomHits = 0;
  for (const s of ROOM_SIGNS) {
    const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    roomHits += (blob.match(re) ?? []).length;
  }
  let navHits = 0;
  for (const t of texts) if (matchDungeonEcho(t)) navHits++;
  // FASE 3c — el material MIXTO se ABRE. Hasta 3b, un segmento con firma de sala dominante se
  // cerraba entero porque el RNG de combate no estaba calibrado para este corpus y sus bloques
  // habrían divergido por INSTRUMENTO. Con los patrones de combate ya calibrados
  // (`AD_COMBAT_RNG` + `isRosterTail`), los bloques de combate se retiran declarados y el
  // PASILLO del mismo segmento sí es medible: cerrarlo entero pasa de prudencia a desperdicio
  // (12 segmentos con nav=6..37 estaban cerrados por la sala que los acompaña).
  //
  // `room-combat` queda para lo que de verdad no tiene pasillo que conducir (nav<3): ahí el
  // cierre sigue siendo la razón honesta, no hay nada que medir.
  if (navHits >= 3 && roomHits >= 3) return { kind: "mixed", navHits, roomHits };
  if (roomHits >= 3) return { kind: "room-combat", navHits, roomHits };
  if (navHits >= 3) return { kind: "corridor", navHits, roomHits };
  return { kind: "unclear", navHits, roomHits };
}

// --------------------------------------------------------------- derivación de ops
/**
 * Convierte el script de un segmento de mazmorra: cada `todo` cuyo encabezado case con el
 * vocabulario pasa a op `{dng:...}` (con `from` = el eco crudo, procedencia auditable). Los
 * que no casan se quedan `todo` INTACTOS. Idempotente: un op `{dng}` previo se re-deriva
 * desde su `from` (así el tool se puede re-correr tras cambiar el umbral).
 */
// ------------------------------------------------- RE-LECTURA FANTASMA (#54)
/**
 * ★ #54 — el discriminador NO es la firma de comillas, es la RE-LECTURA.
 *
 * El perfil AD relee la MISMA línea de consola con los espacios leídos como `"`. Cuando la
 * línea releída es un eco de comando, el derivador emitía DOS ops donde el LP hizo UNA, y ese
 * op fabricado MUEVE las candidatas del filtro de mazmorra una celda de más (E-3 §6.6).
 *
 * ⚠ `stripGhostPass` por sí solo NO sirve, y está medido: sobre `Advunce 6H"EhX"j%TT""""` retira
 * los tokens con comilla interna y deja `Advunce`, que sigue casando el vocabulario y sigue
 * derivando un `advance`. El predicado que el diff usa para declarar fantasma un bloque
 * (`runner.ts:749`, `collapse(strip(t)).length < 3`) tampoco lo declararía: quedan 7 caracteres.
 * Enunciar el arreglo como «que el derivador conozca stripGhostPass» habría sido INERTE sobre su
 * propio caso canónico — la misma forma que el fix de la rama sola en #32.
 *
 * Las CINCO condiciones, todas necesarias (censo en re/notes/regen-54-prerregistro.md §3). El
 * rótulo decía «CUATRO» sobre una lista de cinco desde que nació (`43c12458`), y el `.d.mts`
 * heredó el número equivocado; la numeración es LOAD-BEARING porque los latentes de la ventana
 * E-2 se citan por ella (`re/notes/latentes-e2-acta.md`):
 *   1. el eco lleva firma fantasma (`\S"\S`);
 *   2. repite el comando de la op `dng` inmediatamente anterior;
 *   3. la anterior estaba LIMPIA (si no, no es «buena + relectura»);
 *   4. a ≤2 líneas de OCR — la cola larga (85, 94, 212, 657) son avances REALES;
 *   5. y tras el strip NO queda contenido de juego: sólo el eco del comando.
 *
 * La (5) es la que salva los beats reales que viajan pegados a ruido de comillas: `ad19-g20`
 * ln5912 trae «Pit Trap! Falling... ...splut!» (y es una frontera de planta que 3e-c deriva),
 * `ad20-g19` trae «Spell name: Field destroyed» y `ad18-g12` trae «Leave!». Sin ella se
 * borrarían tres beats de juego para matar trece fantasmas.
 *
 * ═══ LOS DOS LATENTES DE LA VENTANA E-2, ADJUDICADOS (`re/notes/latentes-e2-acta.md`) ═══
 *  · **condición 1 — `ln7368/9`** («Baok up»/«Buok up», sin una sola comilla). Relajarla está
 *    REFUTADO por medida: retira **62 ops más**, **51** en segmentos que el escritor SÍ escribe, y
 *    **50 de las 62 son `advance`** — el comando cuya repetición legítima es la más frecuente del
 *    pasillo. Sin la firma de comillas NO queda testigo que separe re-lectura de pulsación real:
 *    el «input-log» de `nav` sale del MISMO OCR (`segment.mjs` toma un solo fichero) y su
 *    vocabulario es cardinal, así que no atestigua el pasillo 3D.
 *    ⚠ Y NO se arregla ensanchando la ventana «para cubrir los casos de `ad18-g14`». Medido con el
 *    peaje de partición que exige `ad18-adjudicacion-acta.md` §2.1: relajar C1 mueve el script
 *    derivado de **27 de los 646** segmentos; relajar C1 **y** ensanchar la ventana a 5 mueve
 *    **35**, retira **101** ops (80 de ellas `advance`) y sube `ghostReread` de 5 a 106 — y **no
 *    caza ninguno de los dos casos de `ad18-g14`**: a ln5983 la para la condición 2 (entre los dos
 *    `Klimb` se cuela un `back` EMITIDO, así que su hueco efectivo es 2, no 3) y a ln6209 la para
 *    la condición 5 (su cola es ROSTER, territorio del ruling #55).
 *  · **la CABEZA de la condición 5** — para ecos multi-palabra se pasa sólo `raw.split(/\s+/)[0]`,
 *    salvo el caso especial de `back`. Hueco REAL con población **VACÍA**: en todo el corpus AD
 *    hay 1 candidato multi-palabra y es el `back` ya cubierto; pasar el eco entero retira CERO
 *    ops de más. Se deja como está por eso, no por inercia.
 *  Las cifras son de `game/tests/espejo-latentes-e2.test.ts`, que se pone rojo si cambian.
 */
const GHOST_TOKEN = /[^\s"]"[^\s"]/;
export const hasGhostSignature = (s) => GHOST_TOKEN.test(s ?? "");

/** Quita los tokens de re-lectura, igual que `stripGhostPass` de ocr-profile.ts. */
export function stripGhostTokens(text) {
  return (text ?? "")
    .split(/\s+/)
    .filter((tok) => !GHOST_TOKEN.test(tok))
    .join(" ")
    .replace(/"{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ★ #71b — PLIEGUE LOCAL de `isBareEcho`: `foldEcho` MÁS `a↔u`.
 *
 * `a↔u` es la confusión DOMINANTE del OCR de AD («Advunce», «Attucked», «wlth Hulberd», «Buck
 * up») y `probeFold` (`ocr-profile.ts`:143) sí la pliega. El `FOLD` del derivador NO — y **tiene
 * que seguir sin plegarla**, porque `foldEcho` lo consume `echoSim`, que es el casado del
 * VOCABULARIO CERRADO de los 12 comandos: plegar más allí hace que comandos distintos se parezcan
 * entre sí.
 *
 * MEDIDO antes de decidir (mutante `["uvy","u"]` → `["uvya","u"]` sobre los 646 segmentos AD,
 * mismo input, dos tablas): **61 segmentos** cambian su script derivado, `pendingGem` **337 → 0**,
 * `needDirSkipped` 346 → 424, `converted` 1.953 → 1.924. Es otro derivador, no un ajuste fino.
 *
 * Por eso el pliegue vive AQUÍ y no en `FOLD`: `isBareEcho` es el único sitio donde hace falta, y
 * es un sitio donde no se elige entre comandos — se compara un residuo contra una cabeza YA
 * casada, así que plegar de más no puede confundir dos comandos. El control negativo que vigila
 * esto (`foldEcho("Buck") !== foldEcho("Back")`) está en `tests/espejo-dungeon-ops.test.ts`.
 */
const FOLD_BARE = new Map(FOLD);
FOLD_BARE.set("a", "u");

function foldBare(s) {
  let out = "";
  for (const ch of String(s ?? "").toLowerCase()) {
    const f = FOLD_BARE.get(ch) ?? ch;
    if (f >= "a" && f <= "z") out += f;
  }
  return out;
}

/**
 * ★ #71b — ¿es esta palabra CONTENIDO DE JUEGO, o ruido de la cola fantasma?
 *
 * `stripGhostTokens` sólo retira tokens con COMILLA INTERNA (`GHOST_TOKEN`). La cola de una
 * re-lectura puede traer un token sin comilla —`vWvY.` en `ad20-g03` ln2650— que por tener 4
 * letras contaba como contenido y bloqueaba el veredicto de eco pelado.
 *
 * El criterio es **tener alguna vocal**. Los otros dos candidatos se descartaron MIDIENDO:
 *  · `isGarbage` (`ocr-profile.ts`) no puede por construcción — exige que el bloque NO tenga
 *    ninguna palabra de ≥4 letras, y `vWvY` tiene exactamente 4;
 *  · «mayúscula interna ⇒ ruido» tiene un falso positivo REAL: `GeoFFrey,` (35 apariciones en
 *    AD) es contenido de juego, y retirar por ahí borraría ops REALES — la dirección peligrosa.
 *
 * ⚠ El criterio caza también `nrmgH` (867 apariciones), que es el OCR de «armed», o sea COLA DE
 * ROSTER — territorio con ruling propio (#55). Por eso se midió el efecto ANTES de implementarlo:
 * sobre los 646 segmentos AD el predicado retira **exactamente 1 op** (la de `ad20-g03`) y ninguna
 * más, así que no pisa ese ruling. Si esa cifra deja de ser 1 al regenerar, hay que volver a mirar.
 */
const isContentWord = (w) => /[aeiou]/i.test(w);

/**
 * ¿El residuo tras el strip es SÓLO el eco del comando, sin contenido de juego? Se mide por
 * palabras alfabéticas de ≥4 letras que no pertenezcan al propio eco reconocido, plegadas con
 * `foldBare` (ver arriba: `a↔u` es local a esta comparación).
 */
export function isBareEcho(raw, matchedFrom) {
  const rest = stripGhostTokens(raw);
  const head = (matchedFrom ?? "").trim();
  const words = (rest.match(/[A-Za-z]{4,}/g) ?? []).filter(isContentWord).map((w) => foldBare(w));
  const headWords = new Set((head.match(/[A-Za-z]{4,}/g) ?? []).map((w) => foldBare(w)));
  return words.every((w) => headWords.has(w));
}

/** ¿Es `op` (ya casado a `m`) una RE-LECTURA fantasma de `prev`? Las 5 condiciones de arriba. */
export function isGhostReread(m, raw, ocrLn, prev) {
  if (!prev || !prev.dng || prev.dng !== m.op.dng) return false;
  if (!hasGhostSignature(raw)) return false;
  if (hasGhostSignature(prev.from)) return false;
  const d = (ocrLn ?? 0) - (prev.ocrLn ?? 0);
  if (!(d >= 0 && d <= 2)) return false;
  return isBareEcho(raw, m.op.dng === "back" ? "Back up" : raw.split(/\s+/)[0]);
}

export function deriveDungeonOps(seg) {
  const stats = { converted: 0, kept: 0, pendingGem: 0, divergenceCandidate: 0, needDirSkipped: 0, ghostReread: 0, rosterTailDeferred: 0 };
  let prevDng = null; // última op `dng` EMITIDA (para el discriminador de re-lectura, #54)
  const script = (seg.script ?? []).flatMap((op) => {
    const raw = op.dng ? op.from : (op.todo ?? op.todoKeep);
    if (raw === undefined || raw === null) return [op]; // nav/key/typed/… no se tocan
    // #66: las diferidas conservan su op — el guarda de cola-de-roster NO se les aplica.
    const deferred = isDeferred(seg.id, op.ocrLn) && rosterTailOf(raw) != null;
    if (deferred) stats.rosterTailDeferred++;
    const m = matchDungeonEcho(raw, { allowRosterTail: deferred });
    if (!m) {
      // Censo del material que se DEJA sin conducir, con su razón (para el informe).
      const f = foldEcho(raw);
      if (f.includes("uieuasem") || f.includes("uiewasem") || f.includes("uieu") && f.includes("sem")) stats.pendingGem++;
      else if (f.includes("openuhat") || f.includes("openwhat")) stats.divergenceCandidate++;
      stats.kept++;
      return [op.dng ? { todo: raw, ...(op.ocrLn != null ? { ocrLn: op.ocrLn } : {}) } : op];
    }
    if (m.op.dng === "search" || m.op.dng === "look") {
      const dir = dirFromEcho(raw);
      if (!dir) {
        stats.needDirSkipped++;
        stats.kept++;
        return [op.dng ? { todo: raw, ...(op.ocrLn != null ? { ocrLn: op.ocrLn } : {}) } : op];
      }
      m.op.dir = dir;
    }
    // ★ #54 — RE-LECTURA FANTASMA: el LP hizo UNA acción y el OCR la escribió dos veces. La op
    // se RETIRA del guion (no se degrada a `todo`: no hay nada que calibrar, es ruido del OCR).
    if (isGhostReread(m, raw, op.ocrLn, prevDng)) {
      stats.ghostReread++;
      return [];
    }
    stats.converted++;
    const emitted = { ...m.op, from: raw, sim: m.sim, ...(op.ocrLn != null ? { ocrLn: op.ocrLn } : {}) };
    prevDng = emitted;
    return [emitted];
  });
  return { script, stats };
}

/**
 * MAZMORRA DE UN SEGMENTO DE INTERIOR — sin esto, abrir el segmento es PEOR que dejarlo cerrado.
 *
 * Medido en la 1ª corrida de 3b (ad23): los segmentos cuyo banner era demasiado corrupto para el
 * segmentador llegan con `enter.loc:null`, así que la costura de mazmorra NO disparaba y el runner
 * pulsaba las teclas del PASILLO **sobre el overworld** (el transcript del port lo delata:
 * «North / Blocked! / East / Slow progress! / Search-East»). Eso no mide el interior: mueve a la
 * party por el mapa grande y contamina la cadena.
 *
 * Se resuelve como el resync de LOCATION por costura del relevo-3: con la información de la RUTA,
 * sin adivinar. Preferencia (1) el id de mazmorra del banner PRECEDENTE más cercano; (2) si la
 * ruta entera nombra UNA SOLA mazmorra, ésa; (3) si no hay ninguna o hay varias sin precedente,
 * NO SE ABRE el segmento (razón declarada). Devuelve `{id, how}` o null.
 */
/**
 * Ids de MAZMORRA del port: 33..40 (0x21..0x28). Es el rango que el despachador de (O)pen del
 * original usa para decidir «estoy en mazmorra» (`SJOG.OVL 0x137a`: `cmp g_location,0x20 / jbe`
 * + `cmp 0x29 / jae`), el mismo que `setDungeonPos` exige y el motivo por el que `goToLocation`
 * no sirve para ellos.
 *
 * Se comprueba porque NO comprobarlo abrió un interior FALSO: ad20-g17 traía `enter.loc: 23`
 * (= COVE, un pueblo) y se abrió como mazmorra. El guard de runtime lo cazó y declaró
 * («INTERIOR-SIN-MAZMORRA … la costura no dejó a la party dentro del 3D»), así que no condujo
 * teclas de pasillo por el overworld — pero el segmento entraba igual en la métrica de interior
 * con 28 comparables que NO eran conducibles, todos divergentes. Un interior que no se puede
 * conducir no es material: es lastre que ensucia el número.
 */
export const isDungeonLoc = (id) => Number.isInteger(id) && id >= 33 && id <= 40;

export function resolveSegmentDungeon(route, segIndex) {
  const segs = route.segments ?? [];
  // `carryover` = costura SINTÉTICA escrita por este mismo tool (post-combat, 3d). Es un valor
  // DERIVADO, no un banner del OCR: aceptarlo como evidencia haría que la 2ª corrida abriera
  // segmentos que la 1ª dejó cerrados (medido: 3 de LP1) — el tool dejaría de ser idempotente
  // y la razón de apertura sería circular.
  const idAt = (s) => (s?.enter?.dungeon && !s.enter.carryover && isDungeonLoc(s.enter.loc) ? s.enter.loc : null);
  for (let i = segIndex; i >= 0; i--) {
    const id = idAt(segs[i]);
    if (id != null) return { id, how: i === segIndex ? "propio" : "banner-precedente" };
  }
  const distinct = [...new Set(segs.map(idAt).filter((v) => v != null))];
  if (distinct.length === 1) return { id: distinct[0], how: "única-mazmorra-de-la-ruta" };
  return null;
}

/**
 * ¿Este segmento DECLARA que la party está en otro sitio que no es la mazmorra? Es la condición
 * de PARADA del retroceso estricto: una costura `exit`/overworld, un santuario, o un banner de
 * location que NO es mazmorra (pueblo/castillo, con o sin `loc` legible — el banner corrupto
 * `PALACE OF TTO H RE` sigue siendo un banner de castillo).
 */
export function leavesDungeon(seg) {
  const e = seg?.enter;
  if (!e) return false;
  if (e.dungeon && isDungeonLoc(e.loc)) return false;
  if (e.overworld || e.shrine) return true;
  if (e.loc != null && !isDungeonLoc(e.loc)) return true;
  return e.banner != null && !e.dungeon;
}

/**
 * FASE 3d — MAZMORRA DE UN SEGMENTO `post-combat` (retroceso ESTRICTO).
 *
 * Un `post-combat` es la CONTINUACIÓN de la misma visita a la mazmorra tras un combate de sala,
 * y por eso NO trae `enter` propio: el segmentador cortó por el `VICTORY!`/`BATTLE IS LOST!`,
 * no por un banner. Así que su mazmorra hay que leerla del banner que abrió la visita.
 *
 * Pero `resolveSegmentDungeon` NO sirve tal cual aquí, y ésa es la diferencia que exige el
 * deber previo nº2 de 3d. En un `ctx:"dungeon"` el propio contexto ya afirma «estoy dentro»,
 * así que retroceder hasta el banner más cercano es seguro. Un `post-combat` **no afirma nada**:
 * los hay tras un encuentro del OVERWORLD (ad12-g22), y para ésos el retroceso ingenuo
 * encontraría igualmente el banner de la mazmorra que la party visitó horas antes y devolvería
 * un id FALSO. Abrir ese segmento repetiría exactamente la rotura nº1 de 3b —el runner pulsando
 * las teclas del pasillo SOBRE EL OVERWORLD— multiplicada por los 209 del censo.
 *
 * El retroceso estricto PARA en cuanto un segmento declara que la party salió de la mazmorra
 * (`leavesDungeon`): costura de salida al overworld, santuario o banner de otra location. Si el
 * primero que aparece hacia atrás es una salida, NO hay mazmorra que resolver y el segmento no
 * se abre — con su razón declarada. Y NO hay fallback de «única-mazmorra-de-la-ruta»: sin
 * contexto que lo respalde, ese atajo es justo la adivinación que la parada quiere evitar.
 *
 * IDEMPOTENTE por construcción: las costuras SINTÉTICAS que este mismo tool escribe
 * (`enter.carryover`, ver `enrichPart`) se atraviesan como transparentes en vez de aceptarse
 * como evidencia. Si no, la 2ª corrida resolvería `ad17-g05` contra el `enter` que la 1ª le
 * puso a `ad17-g04` y la procedencia iría cambiando de segmento en cada pasada — la misma
 * familia de no-idempotencia que ya mordió a la clasificación pasillo/sala en 3a.
 */
export function resolveDungeonForPostCombat(route, segIndex) {
  const segs = route.segments ?? [];
  for (let i = segIndex; i >= 0; i--) {
    const s = segs[i];
    if (s?.enter?.carryover) continue; // costura sintética: derivada, no evidencia
    if (s?.enter?.dungeon && isDungeonLoc(s.enter.loc)) {
      return { id: s.enter.loc, how: i === segIndex ? "propio" : `visita-abierta-en-${s.id}` };
    }
    if (leavesDungeon(s)) return null; // la party salió: lo de más atrás ya no aplica
  }
  return null;
}

// --------------------------------------------------------------------------- CLI
function resolveRoutesDir(args) {
  const i = args.indexOf("--routes");
  if (i === -1) return join(HERE, "..", "routes");
  const dir = args[i + 1];
  args.splice(i, 2);
  return dir.startsWith("/") ? dir : join(HERE, "..", dir);
}

function listParts(routesDir) {
  return readdirSync(routesDir)
    .filter((f) => f.endsWith(".route.json"))
    .map((f) => f.replace(".route.json", ""))
    .sort();
}

/**
 * ★ RANURAS NEUTRAS DEL `ctx` — las tres costuras que NO declaran dónde está la party.
 *
 * `ctx` no lo pone un detector de lugar: lo pone la COSTURA que corta el segmento
 * (`segment.mjs:239`, `cut(ln, newCtx, seam)`). De sus ocho valores, cinco SÍ declaran lugar
 * (`dungeon` ← `>Enter dungeon`, `smallmap` ← banner de pueblo, `shrine`, `overworld` ←
 * `Exit to Britannia`, `combat` ← `Conflict!`) y **tres no declaran nada**:
 *
 *   · `post-combat` ← `VICTORY!`/`BATTLE IS LOST!` — continúa la misma visita;
 *   · `resume`      ← `Party rested`/`Morning`     — se acampa DONDE SE ESTÁ, y el pasillo 3D
 *                                                    es un sitio donde el LP acampa;
 *   · `start`       ← inicial del episodio         — «el curador fija el ctx real de arranque».
 *
 * El filtro de aquí reconocía UNA de las tres (`post-combat`, con su retroceso estricto y su
 * JSDoc diciendo «un post-combat **no afirma nada**») y trataba a las otras dos como si dijeran
 * «no es mazmorra». La asimetría no estaba justificada en ninguna parte: era un hueco.
 * Es [[rutina-neutral-el-sentido-lo-pone-el-productor]] — el sentido de una ranura neutra lo
 * pone su productor, y el de `resume` es una acampada.
 *
 * MEDIDO antes de tocarlo (`re/notes/clasif-discrepan-acta.md`): `mkoverlay-ad.mjs` marca 199
 * segmentos como interior y **17 caen fuera de este filtro** (2.014 ops de guion). 15 de esos 17
 * son de `ctx` neutro; los otros 2 son `ctx:"combat"`, y ahí el filtro ACIERTA — `combat` sí
 * declara contexto (paréntesis de RNG, doctrina 3c/3d) y sigue fuera.
 *
 * ⚠ Las tres van por el MISMO camino que 3d, y eso es la mitad del arreglo: retroceso ESTRICTO
 * (`resolveDungeonForPostCombat`) y costura SINTÉTICA `carryover`, que COMPRUEBA en vez de
 * teletransportar. Con el `resolveSegmentDungeon` de 3b —y sobre todo con su fallback
 * «única-mazmorra-de-la-ruta»— un `resume` de posada resolvería a la mazmorra que la party
 * visitó horas antes y el runner pulsaría las teclas del pasillo sobre el pueblo. La parada
 * estricta lo impide sola: retrocediendo desde una posada, lo primero que aparece es el banner
 * del pueblo, que `leavesDungeon` declara salida.
 */
export const CTX_NEUTRO = new Set(["post-combat", "resume", "start"]);

/**
 * ★★ EL GUARDA QUE HACE QUE ESTO NO SEA UNA PODA — medido, no razonado.
 *
 * La rama `else` de `enrichPart` hace `if (!seg.skip) seg.skip = "pendiente-runner"`. Para
 * `ctx:"dungeon"` y `post-combat` eso es un cinturón inofensivo: llegan YA cerrados por
 * `mkoverlay`. Para `resume`/`start` **no**: la mayoría son juego normal —el arranque de cada
 * episodio, una acampada en el overworld, un amanecer de POSADA— y se conducen. Sin guarda, la
 * primera corrida de este cambio CERRÓ **51 segmentos** que hoy se miden (22 `start` + 29
 * `resume`), o sea 51 fuera del denominador de conformidad sin que nadie lo viera. Es la forma
 * de [[vaciar-la-entrada-es-vaciar-sus-productores]]: ensanchar una entrada no es gratis si
 * aguas abajo hay una rama que CIERRA por defecto.
 *
 * El test correcto de «esto es interior» para una ranura neutra no es el `ctx` (no dice nada)
 * ni la máquina de `mkoverlay` (no viaja en la ruta): es el **retroceso ESTRICTO**. Que
 * `resolveDungeonForPostCombat` devuelva mazmorra significa, literalmente, «retrocediendo desde
 * aquí llego a la costura que abrió una visita SIN haber cruzado ninguna salida» = la party
 * sigue dentro. Si devuelve `null`, el segmento no es interior y el derivador **no lo toca**:
 * ni deriva ops, ni escribe `skipReason`, ni lo cierra.
 *
 * ⚠ Se aplica sólo a las DOS ranuras nuevas. `post-combat` conserva su camino intacto —incluido
 * el cinturón— porque su territorio está ADJUDICADO (3d) y moverlo aquí mezclaría dos causas en
 * el mismo delta.
 */
const CTX_NEUTRO_NUEVO = new Set(["resume", "start"]);

/**
 * ★ Las DOS causas de «aquí no se abre» que el retroceso estricto devuelve como el MISMO `null`.
 *
 * `resolveDungeonForPostCombat` contesta «mazmorra o nada», y ese `nada` mezcla dos cosas que no
 * son la misma y que exigen respuestas distintas:
 *
 *  · **fuera** — retrocediendo se cruza una SALIDA (o no hay nada detrás): el segmento no es
 *    interior, y el derivador no tiene por qué opinar de él;
 *  · **indeterminable** — retrocediendo se llega a una costura `dungeon-enter` REAL cuya `loc`
 *    no es una mazmorra 33..40. La visita existe y el segmento SÍ es interior; lo que falta es
 *    el ID. Medido sobre el corpus AD: de las **27** costuras `dungeon-enter` reales hay **UNA**
 *    así, `ad19-g17`, cuyo banner el OCR dejó en `"WRUNG A MAGIC CARPET SAVE GAME YES"` —
 *    `WRUNG` por `WRONG` (id 36, que SÍ está en `LOC_BY_BANNER`). `resolveBanner` compara con un
 *    `includes` que sólo pliega `0→O` y `1→I`, no la confusión `u↔o`, que es la dominante de AD.
 *    Una letra deja sin ID a la visita entera.
 *
 * Distinguirlas es lo que convierte un SILENCIO en un ticket con cifra: los 5 segmentos de esa
 * visita (`ad19-g24/25/26/32/33`, 278 ops de guion, entre ellos el `ad19-g26` que
 * `latentes-e2-acta.md` §1.3 puso de caso estrella) no están cerrados por su `ctx` —eso ya está
 * arreglado— sino por esa letra. Es [[censa-las-otras-puertas-al-mismo-estado]]: abrir la
 * primera puerta destapa la segunda, y sin este predicado la segunda seguiría sin nombre.
 *
 * ⚠ Cuando el veredicto es `indeterminable` se DECLARA y **no se deriva**: convertir ahí retiraría
 * ops por el guarda #54 sobre material que nadie va a medir, o sea borraría OCR archivado a
 * cambio de nada.
 */
export function neutralInteriorProbe(route, segIndex) {
  const dng = resolveDungeonForPostCombat(route, segIndex);
  if (dng) return { kind: "dentro", ...dng };
  const segs = route.segments ?? [];
  for (let i = segIndex; i >= 0; i--) {
    const s = segs[i];
    if (s?.enter?.carryover) continue; // costura sintética: derivada, no evidencia (idempotencia)
    if (s?.enter?.dungeon && !isDungeonLoc(s.enter.loc)) {
      return { kind: "indeterminable", desde: s.id, banner: s.enter.banner ?? null };
    }
    if (leavesDungeon(s)) return { kind: "fuera" };
  }
  return { kind: "fuera" };
}

/**
 * ★ LA RAZÓN de un interior cuya visita no resuelve. UNA sola definición porque la escriben DOS
 * ramas de `enrichPart` (el gate de las ranuras neutras nuevas y la rama `else` del `post-combat`)
 * y dos copias divergirían: la de `post-combat` nació distinta —afirmando `fuera`— y ése es
 * exactamente el defecto que `cola-probe` viene a cerrar.
 */
function razonIndeterminable(probe) {
  return (
    `interior con mazmorra INDETERMINABLE: la visita se abrió en ${probe.desde}, cuya costura \`dungeon-enter\` ` +
    `no dejó una loc 33..40 (banner OCR: "${(probe.banner ?? "—").slice(0, 46)}") — sin id no hay costura que ` +
    `comprobar, y abrirlo pulsaría las teclas del pasillo sin saber dónde`
  );
}

/**
 * ★★ EL ENRIQUECEDOR, PURO SOBRE EL OBJETO — sin tocar disco.
 *
 * Extraído de `enrichPart` (que ahora es sólo su envoltorio de I/O) para que un guarda pueda
 * preguntar «¿está este corpus en el PUNTO FIJO del derivador?» **sin escribir los ficheros**.
 * La alternativa —correr el CLI desde un test— está descartada por dos motivos medidos:
 * `spawnSync` dentro de vitest bloquea el RPC, y un test que escriba el corpus contamina a
 * cualquier otro carril que esté midiendo sobre el mismo árbol.
 *
 * MUTA el `route` que se le pasa: el llamador clona si quiere conservar el original.
 */
export function enrichRoute(route, { open = true } = {}) {
  const rows = [];
  const total = { converted: 0, kept: 0, pendingGem: 0, divergenceCandidate: 0, needDirSkipped: 0, opened: 0 };
  (route.segments ?? []).forEach((seg, segIndex) => {
    const neutro = CTX_NEUTRO.has(seg.ctx);
    if (seg.ctx !== "dungeon" && !neutro) return;
    // ★ las dos ranuras nuevas pasan el GATE DE INTERIOR antes de que nada las toque (ver el
    // JSDoc de CTX_NEUTRO_NUEVO): sin visita abierta detrás no son interior y no se procesan.
    if (CTX_NEUTRO_NUEVO.has(seg.ctx)) {
      const probe = neutralInteriorProbe(route, segIndex);
      if (probe.kind === "fuera") return; // no es interior: el derivador no opina
      if (probe.kind === "indeterminable") {
        // interior SIN id de mazmorra: se DECLARA (sólo si ya estaba cerrado — este tool jamás
        // cierra lo que nadie cerró) y NO se deriva.
        if (seg.skip) seg.skipReason = razonIndeterminable(probe);
        return;
      }
    }
    const cls = classifyDungeonSegment(seg);
    const { script, stats } = deriveDungeonOps(seg);
    seg.script = script;
    for (const k of Object.keys(stats)) total[k] += stats[k];
    // MAZMORRA de la costura: si la ruta no la trae (banner corrupto), se resuelve con la propia
    // ruta o el segmento NO se abre (ver resolveSegmentDungeon: abrirlo sin mazmorra hacía que el
    // runner caminara por el OVERWORLD con las teclas del pasillo).
    // el `enter.loc` propio sólo vale si ES una mazmorra (33..40): con un id de PUEBLO se abría
    // un interior imposible de conducir (ad20-g17 = loc 23 = Cove). Si no lo es, se intenta
    // resolver por la ruta y, si tampoco, el segmento NO se abre y lo dice.
    //
    // FASE 3d — el `post-combat` va por el retroceso ESTRICTO (`resolveDungeonForPostCombat`):
    // no declara contexto, así que el retroceso ingenuo le pondría mazmorra a los post-combat de
    // ENCUENTRO DEL OVERWORLD. Ver el JSDoc de esa función.
    const dng = isDungeonLoc(seg.enter?.loc) && !seg.enter.carryover
      ? { id: seg.enter.loc, how: "propio" }
      : neutro
        ? resolveDungeonForPostCombat(route, segIndex)
        : resolveSegmentDungeon(route, segIndex);
    if (dng && seg.enter && seg.enter.loc == null) {
      seg.enter.loc = dng.id;
      seg.enter.dungeonFrom = dng.how;
    }
    // Sólo el PASILLO CON MATERIAL SUFICIENTE y con MAZMORRA CONOCIDA se abre; el resto queda
    // cerrado con su razón DECLARADA (jamás un skip mudo: la conformidad mentiría por omisión).
    const openable = (cls.kind === "corridor" || cls.kind === "mixed") && stats.converted >= 3 && dng != null;
    if (open && openable) {
      if (seg.skip) {
        // la FASE que lo abrió viaja en la ruta: es lo que hace que la descomposición del
        // informe («material nuevo abierto» vs «patrones retirados») sea automática y auditable
        // en vez de un recuento a mano.
        // `3d` es el post-combat; las otras dos ranuras neutras llevan fase PROPIA (`3d-neutro`)
        // para que la descomposición del informe no las confunda con la continuación de un
        // combate: un `resume` es una acampada, y su riesgo de resync es otro.
        seg.openedBy = seg.ctx === "post-combat" ? "3d" : neutro ? "3d-neutro" : cls.kind === "mixed" ? "3c" : "3b";
        // COSTURA SINTÉTICA DEL `post-combat` (3d). El segmento no trae `enter` porque el
        // segmentador cortó por el `VICTORY!`, no por un banner: es la CONTINUACIÓN de la misma
        // visita. Por eso la costura es `carryover` — NO se teletransporta. Poner a la party en
        // la celda de entrada de la mazmorra (lo único que la costura de 3b sabe hacer) sería
        // FABRICAR posición: a mitad de visita el LP no está en la cima, y la celda real no es
        // derivable hoy (§9 «PENDIENTE de la planta de entrada»). El runner sólo COMPRUEBA que
        // la party siga dentro de ESTA mazmorra y, si no lo está, declara y no conduce.
        delete seg.skip;
        delete seg.skipReason;
        total.opened++;
      }
      if (neutro) seg.enter = { loc: dng.id, dungeon: true, carryover: true, dungeonFrom: dng.how };
    } else {
      if (!seg.skip) seg.skip = "pendiente-runner";
      delete seg.openedBy;
      if (neutro && seg.enter?.carryover) delete seg.enter; // la costura sintética se retira con él
      // ★★ EL PREDICADO ENSANCHADO A `post-combat` (carril `cola-probe`).
      //
      // Con el GATE DE INTERIOR de arriba, una ranura neutra NUEVA no llega aquí con `dng == null`
      // (sale antes por `fuera`/`indeterminable`), así que esta sub-rama `neutro` es EXCLUSIVAMENTE
      // de `post-combat`. Y afirmaba «no es de interior» sin haberlo comprobado: le bastaba
      // `resolveDungeonForPostCombat() == null`, que devuelve el MISMO `null` para dos causas que
      // no son la misma (ver el JSDoc de `neutralInteriorProbe`). Sobre un `indeterminable` esa
      // frase es FALSA — el segmento SÍ es interior, lo que falta es el id de la visita.
      //
      // Ocurrió en `ad19` (22 segmentos, `banner-ad19-acta.md` §3, donde lo tapó la curación del
      // DATO) y seguía vivo en 14 más (`ad11-g07..g11`, `ad20-g18..g26`). Ahora el veredicto se le
      // pide al MISMO predicado que ya arbitra las otras dos ranuras neutras, en vez de suponerlo.
      //
      // ⚠ Esto NO abre ni cierra NADA, y es demostrable: `probe.kind === "dentro"` ⟺
      // `resolveDungeonForPostCombat() != null`, o sea es inalcanzable aquí (llegamos con
      // `dng == null`). Sólo cambia la RAZÓN declarada. Pre-registro: `cola-probe-preregistro.md`.
      const probeFinal = dng == null && neutro ? neutralInteriorProbe(route, segIndex) : null;
      seg.skipReason =
        dng == null
          ? neutro
            ? probeFinal.kind === "indeterminable"
              ? razonIndeterminable(probeFinal)
              : `mazmorra INDETERMINABLE: retrocediendo desde aquí, lo primero que aparece es una SALIDA de la mazmorra (overworld/santuario/otra location) — este post-combat no es de interior`
            : `mazmorra INDETERMINABLE (enter.loc=${seg.enter?.loc ?? "—"} no es mazmorra 33..40 y la ruta nombra 0 o varias): abrirlo haría caminar por el overworld con las teclas del pasillo`
          : cls.kind === "room-combat"
            ? `sala PURA: ${cls.roomHits} ecos de combate y sólo ${cls.navHits} de pasillo (mínimo 3) — no hay pasillo que conducir`
            : cls.kind === "corridor" || cls.kind === "mixed"
              ? `${cls.kind === "mixed" ? "mixto" : "pasillo"} con material insuficiente: sólo ${stats.converted} ops derivables (mínimo 3) de ${cls.navHits} ecos de pasillo`
              : `material no clasificable como pasillo (nav=${cls.navHits}, sala=${cls.roomHits})`;
    }
    rows.push({ id: seg.id, ...cls, ...stats, dng: dng?.how ?? "—", open: !seg.skip });
  });
  return { rows, total };
}

/** Enriquece un route.json (in-place, EN DISCO). `open` = quitar el `skip` de los PASILLOS. */
function enrichPart(routesDir, part, { dry, open }) {
  const path = join(routesDir, `${part}.route.json`);
  const route = JSON.parse(readFileSync(path, "utf8"));
  const { rows, total } = enrichRoute(route, { open });
  if (!dry) writeFileSync(path, JSON.stringify(route, null, 2) + "\n");
  return { rows, total };
}

/**
 * CENSO DE VISITAS (`--visits`) — ¿está la cadena de segmentos de una visita COMPLETA?
 *
 * Es la pregunta que decide si el CONTADOR DE PLANTAS del LP (§6 del diseño: la planta esperada
 * por conteo de los `Klimb` desde la entrada, que es la única celda conocida) es derivable. El
 * conteo sólo vale si NINGÚN segmento de la visita queda cerrado: un hueco se come los Klimb que
 * contiene y a partir de ahí la profundidad sería inventada. 3b lo dejó bloqueado «porque el
 * conteo cruzaría los post-combat que 3d aún no abre» — con 3d abriéndolos, esto lo MIDE en vez
 * de suponerlo.
 */
function censusVisits(routesDir, parts) {
  let visitas = 0;
  let completas = 0;
  for (const part of parts) {
    const route = JSON.parse(readFileSync(join(routesDir, `${part}.route.json`), "utf8"));
    const segs = route.segments ?? [];
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      // arranque de VISITA = costura de mazmorra REAL (no la sintética de un post-combat)
      if (!(s.enter?.dungeon && isDungeonLoc(s.enter.loc) && !s.enter.carryover)) continue;
      visitas++;
      let abiertos = s.openedBy ? 1 : 0;
      const cerrados = s.openedBy ? [] : [s.id];
      for (let j = i + 1; j < segs.length && !leavesDungeon(segs[j]); j++) {
        if (segs[j].openedBy) abiertos++;
        else cerrados.push(segs[j].id);
      }
      if (cerrados.length === 0) completas++;
      console.log(
        `   ${part} visita@${s.id} dng=${s.enter.loc}: ${abiertos} abiertos / ${cerrados.length} cerrados ` +
          (cerrados.length === 0 ? "CADENA COMPLETA" : `ROTA en ${cerrados.slice(0, 4).join(",")}${cerrados.length > 4 ? "…" : ""}`),
      );
    }
  }
  console.log(
    `VISITAS: ${visitas} · con la cadena COMPLETA: ${completas} → el contador de PLANTAS del LP ` +
      `sólo es derivable en esas ${completas} (en el resto, el conteo de Klimb cruza un segmento cerrado ` +
      `y la profundidad sería inventada).`,
  );
}

function main() {
  const args = process.argv.slice(2);
  const routesDir = resolveRoutesDir(args);
  const dry = args.includes("--dry");
  const census = args.includes("--census");
  const visits = args.includes("--visits");
  const open = !args.includes("--no-open");
  const all = args.includes("--all");
  const parts = all ? listParts(routesDir) : args.filter((a) => !a.startsWith("--"));
  if (parts.length === 0) {
    console.error("uso: derive-dungeon-ops.mjs <partNN...> | --all [--dry] [--census] [--visits] [--no-open] [--routes <dir>]");
    process.exit(2);
  }
  if (visits) {
    censusVisits(routesDir, parts);
    return;
  }
  const grand = { converted: 0, kept: 0, pendingGem: 0, divergenceCandidate: 0, needDirSkipped: 0, opened: 0, segs: 0 };
  for (const part of parts) {
    const { rows, total } = enrichPart(routesDir, part, { dry, open });
    if (rows.length === 0) continue;
    grand.segs += rows.length;
    for (const k of Object.keys(total)) grand[k] += total[k];
    console.log(
      `${part}: ${rows.length} segs dungeon · ops ${total.converted} conducidas / ${total.kept} sin conducir · abiertos ${total.opened}`,
    );
    if (census) for (const r of rows) console.log(`   ${r.id} [${r.kind}] nav=${r.navHits} room=${r.roomHits} conv=${r.converted} keep=${r.kept} dng=${r.dng} open=${r.open}`);
  }
  console.log(
    `TOTAL: ${grand.segs} segmentos dungeon · ${grand.converted} ops conducidas · ${grand.kept} sin conducir ` +
      `(gema-pendiente ${grand.pendingGem}, Open-What? ${grand.divergenceCandidate}, sin-dir ${grand.needDirSkipped}) · ` +
      `${grand.opened} segmentos ABIERTOS${dry ? " [dry-run]" : ""}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
