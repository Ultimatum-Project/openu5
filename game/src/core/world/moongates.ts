/**
 * Moongates y fases lunares de Ultima V — reglas EXACTAS del binario DOS
 * (kernel ULTIMA.EXE 0x4702-0x4a84). Sin RNG.
 *
 * Mecánica (re/notes/shrines.md §1):
 * - Dos lunas (Felucca, Trammel) cambian de fase (0..7) por día del mes de 28 días.
 *   La tabla cruda vive en DATA.OVL:0x1EEA (28 pares de bytes, cada byte +0x30);
 *   `kernel_time_refresh` (0x4a84) la refresca a g_felucca_phase/g_trammel_phase.
 * - De noche (hour>=20 o hour<5) se dibuja una moongate (tile 0xDC) en cada
 *   moonstone enterrada visible en pantalla (kernel_moongate_render 0x475a).
 * - Al PISAR una puerta (kernel_moongate_enter 0x4902) se selecciona la fase
 *   activa (Felucca si hour<12, Trammel si hour>=12) y se teleporta a la
 *   moonstone de esa fase (kernel_moongate_teleport 0x47f4). Como la puerta solo
 *   existe de noche, hour<12 ⇔ madrugada y hour>=12 ⇔ noche.
 * - EDGE: a las 00:00-00:09 la puerta se cierra pero NO teleporta (0x494d), la
 *   ventana en que las fases del día acaban de cambiar a medianoche.
 *
 * Semántica DOS de las moonstones (≠ Redux): el binario guarda 4 arrays paralelos
 * de 8 bytes — X (0x5830), Y (0x5838), LOCATION-de-destino (0x5840; 0xFF = en
 * inventario/sin puerta) y FLOOR-de-destino (0x5848; 0=Britannia, 0xFF=Underworld).
 * `teleport` copia esos 4 valores a g_party_x/y, g_location, g_floor.
 *
 * ★ `DS 0x5840` y el offset `0x29a` del `.GAM` son LOS MISMOS OCHO BYTES, no dos
 * artefactos: `DS 0x55A6` es la imagen del fichero (bloque 0x55A6..0x6605 = 0x1060 =
 * 4192 B = el `.GAM` entero, longitud que calculan INTRO.OVL:0x0079 y CAST2.OVL:0x118d)
 * y 0x5840 − 0x55A6 = 0x29A. Se deja escrito aquí porque la coincidencia de que el
 * código lea «0x29a» y la prosa cite «0x5840» ya hizo pensar una vez que eran dos
 * codificaciones distintas, y de ahí salió la ficha #143a.
 *
 * El clon modela la stone como {x, y, buried, z, location}: `location` es el 0x5840
 * literal, y `buried` su cara booleana (⇔ location != 0xFF, en el mundo vs. en la
 * mochila). `z` ⇔ el floor de destino.
 *
 * El gate de DIBUJO del binario (ULTIMA.EXE:0x4713) exige además `[0x5840] ==
 * g_location` — la puerta sólo se ve en la localización donde enterraste la piedra.
 * CERRADO por #149 (c5fee829): `moongateAt` compara `location` desde entonces (su
 * docblock lleva el asm). Este párrafo decía «CABO ABIERTO… moongateAt aún compara
 * sólo (x, y, z)» — quedó rancio en ese mismo commit, que actualizó el docblock de la
 * función y no esta cabecera. El cabo que SÍ sigue abierto es OTRO: el render del port
 * sale en `location !== 0` (game.ts activeMoongates/checkMoongate) y el binario
 * pintaría la puerta DENTRO del pueblo (0x4702 con g_location != 0 concede sin
 * ventana) — ficha aparte.
 */
import type { GameTime } from "../time.js";
import type { GameState } from "../state.js";

/** Nº total de moonstones / fases lunares. */
export const TOTAL_MOONSTONES = 8;

/**
 * Byte de fase → valor de fase real: se le resta 0x30 (doc §3.2). Es también el
 * byte que se LATCHEA tal cual en `g_felucca_phase`/`g_trammel_phase` (0x4aeb /
 * 0x4b25), así que `0x30` es la base de un latch «fase 0».
 */
export const MOON_PHASE_OFFSET = 0x30;

/**
 * ¿Es `b` un byte de fase VÁLIDO de la tabla (`'0'..'7'`)? Los ocho valores que
 * `draw_sky_strip` puede escribir, y los únicos que el `-0x30` del consumidor
 * (`moongate_enter` 0x4973) convierte en un índice de moonstone en rango.
 *
 * ⚠ DIVERGENCIA DECLARADA (★ #176): el original NO comprueba el rango — `0x4971
 * sub ah,ah / 0x4973 sub ax,0x30` y a indexar. Aquí se comprueba porque el estado
 * inicial que reparte el port trae los dos bytes a CERO: medido sobre
 * `game/assets/init.gam`, `+0x2DF = 0x00` y `+0x2E0 = 0x00` (día 5, hora 8), o sea
 * un latch «aún no escrito». En el original eso tampoco se observa —arrancas a las
 * 8:00 y para la primera noche la hora ha cambiado doce veces en superficie, así que
 * 0x4a84 ya latcheó—, pero un estado sintético o un salto de reloj de depuración sí
 * llegaría a la noche con los ceros. Ante un byte fuera de rango este port cae al
 * cálculo por día (la conducta que tenía antes de esta tarjeta) en vez de propagar un
 * índice negativo. Se declara; no se disimula.
 */
export function isLatchedPhaseByte(b: number | undefined): b is number {
  return b !== undefined && b >= MOON_PHASE_OFFSET && b <= MOON_PHASE_OFFSET + 7;
}

/**
 * Fases VIGENTES = el par LATCHEADO en el estado guardado si lo hay, y si no el
 * cálculo por día. ★ #176: el original NO recalcula por día en cada consulta —
 * relee `[0x5885]`/`[0x5886]` (0x4b13 / 0x4b4d para dibujar, 0x4969 / 0x496e para
 * teleportar) y esos bytes sólo los reescribe `advance_clock` bajo sus tres guardas.
 * ⇒ **cruzar medianoche en mazmorra o bajo tierra deja las fases de AYER**, y con
 * ellas el destino de moongate de ayer, hasta la siguiente frontera de hora en
 * superficie.
 */
export function latchedMoonPhases(
  state: Pick<GameState, "feluccaPhase" | "trammelPhase">,
  moonPhasesRaw: number[],
  day: number,
): { felucca: number; trammel: number } {
  if (isLatchedPhaseByte(state.feluccaPhase) && isLatchedPhaseByte(state.trammelPhase)) {
    return {
      felucca: state.feluccaPhase - MOON_PHASE_OFFSET,
      trammel: state.trammelPhase - MOON_PHASE_OFFSET,
    };
  }
  return moonPhasesForDay(moonPhasesRaw, day);
}

/** Z de una moonstone enterrada en el mundo de Underworld. */
const Z_UNDERWORLD = 0xff;
/** Z de una moonstone enterrada en Britannia (overworld). */
const Z_BRITANNIA = 0x00;

/** Una posición 3D en el mundo grande (large map). */
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

/** Posición de una moongate activa con su fase asociada. */
export interface MoongatePosition {
  phase: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Fases de Felucca y Trammel para un día del mes (1..28).
 * `moonPhasesRaw` es el array MOON_PHASES crudo de DATA.OVL (56 bytes, +0x30).
 */
export function moonPhasesForDay(
  moonPhasesRaw: number[],
  day: number,
): { felucca: number; trammel: number } {
  const i = (day - 1) * 2;
  const felucca = (moonPhasesRaw[i] ?? MOON_PHASE_OFFSET) - MOON_PHASE_OFFSET;
  const trammel =
    (moonPhasesRaw[i + 1] ?? MOON_PHASE_OFFSET) - MOON_PHASE_OFFSET;
  return { felucca, trammel };
}

/** ¿Es de día? (kernel_moongate_render: NOCHE ⇔ hour>=20 o hour<5). */
function isDaylight(time: GameTime): boolean {
  return time.hour >= 5 && time.hour < 20;
}

/**
 * ¿Estamos en el edge de medianoche 00:00-00:09? En esa ventana la puerta se
 * dibuja y se cierra al pisarla pero NO teleporta (kernel_moongate_enter 0x494d:
 * `g_hour==0 && g_minute<0x0A` → return sin llamar a teleport).
 */
export function isMidnightGateEdge(time: GameTime): boolean {
  return time.hour === 0 && time.minute < 0x0a;
}

/**
 * Fase lunar que abre la moongate ahora mismo, o `null` si de día no hay puerta.
 * Madrugada (hour<=4) → fase de Felucca; noche (hour>=20) → fase de Trammel
 * (`moongate_enter` 0x4962 `cmp g_hour,0xc` / 0x4969 vs 0x496e).
 *
 * `state` opcional (★ #176): con él se leen las fases LATCHEADAS del estado guardado
 * —que es lo que hace el original— en vez de recalcularlas por día. Sin él (llamadas
 * puras y tests de tabla) se cae al cálculo por día.
 */
export function activeGatePhase(
  time: GameTime,
  moonPhasesRaw: number[],
  state?: Pick<GameState, "feluccaPhase" | "trammelPhase">,
): number | null {
  if (isDaylight(time)) return null;
  const { felucca, trammel } = state
    ? latchedMoonPhases(state, moonPhasesRaw, time.day)
    : moonPhasesForDay(moonPhasesRaw, time.day);
  return time.hour <= 4 ? felucca : trammel;
}

/**
 * Posiciones de todas las moonstones actualmente enterradas, con su fase (índice).
 * Las moonstones en inventario (buried=false) se omiten.
 */
export function moongatePositions(state: GameState): MoongatePosition[] {
  const out: MoongatePosition[] = [];
  // `?? []`: mismo contrato que buriedMoonstoneAt — hay estados-stub (parity runs,
  // snapshots de piel) sin el array. Mientras el render colgaba de `moongateDestination`
  // esta función nunca los veía (el `!dest` salía antes); desde #149 activeMoongates la
  // llama incondicional y la batería cazó el TypeError (skin-coreview, banda celeste).
  (state.moonstones ?? []).forEach((m, phase) => {
    if (m.buried) out.push({ phase, x: m.x, y: m.y, z: m.z });
  });
  return out;
}

/**
 * ¿Hay una moongate activa (pisable) en esta casilla del large map ahora?
 * Requiere: ser de noche (hay fase activa) y haber una moonstone enterrada en
 * (x, y) **de esta localización** y en la capa que toca (Underworld vs Britannia).
 *
 * Calco del gate de visibilidad `ULTIMA.EXE:0x4702`, que exige DOS igualdades antes de
 * conceder la puerta:
 * ```
 * 4710: mov al, byte [g_location]
 * 4713: cmp byte [bx + 0x5840], al   ; la piedra tiene que estar enterrada AQUÍ
 * 4717: jne 0x4751                   ;   si no → devuelve 0, no hay puerta
 * 4719: mov al, byte [g_floor]
 * 471c: cmp byte [bx + 0x5848], al   ; y en esta planta
 * ```
 * `z` ya cubría la segunda (`0x5848`). `location` es la PRIMERA, y faltaba: sin ella una
 * piedra enterrada dentro de un pueblo dibujaba su puerta en el SOBREMUNDO, en esas mismas
 * (x, y) — ficha #149, residuo declarado de #143a.
 *
 * ⚠ NO confundir con el gate del TELEPORT, que es OTRO predicado: `kernel_moongate_teleport`
 * `ULTIMA.EXE:0x47fd` sólo exige `[0x5840] != 0xFF` («no está en la mochila») y NO compara
 * contra `g_location` — de hecho en `0x4841` ESCRIBE `g_location` desde la piedra, que es
 * como la puerta te lleva a otra localización. Por eso `moongateDestination` no lleva esta
 * comprobación: darle la misma guarda rompería el viaje entre localizaciones.
 */
export function moongateAt(
  state: GameState,
  time: GameTime,
  moonPhasesRaw: number[],
  x: number,
  y: number,
  floorIsUnderworld: boolean,
  location: number,
): boolean {
  if (activeGatePhase(time, moonPhasesRaw, state) === null) return false;
  const wantZ = floorIsUnderworld ? Z_UNDERWORLD : Z_BRITANNIA;
  return state.moonstones.some(
    (m) => m.buried && m.location === location && m.x === x && m.y === y && m.z === wantZ,
  );
}

/**
 * Destino del teleport de la moongate: la posición de la moonstone cuya fase
 * está activa ahora (doc §3.3). `null` de día o si esa moonstone no está
 * enterrada (está en tu inventario).
 *
 * #352: la puerta FÍSICA ya no pasa por aquí — `Game.checkMoongate` delega en
 * `Game.moonstoneTeleport` (0x4977 `call 0x47f4`), que escribe también `location`.
 * Esta función queda como consulta de conveniencia (parity runs, tests de tabla) y
 * se implementa SOBRE `moonstoneDestination` para que el centinela 0x47fd viva en
 * un único sitio; nótese que descarta `location` a propósito: es una PROYECCIÓN.
 */
export function moongateDestination(
  state: GameState,
  time: GameTime,
  moonPhasesRaw: number[],
): WorldPoint | null {
  const phase = activeGatePhase(time, moonPhasesRaw, state);
  if (phase === null) return null;
  const dest = moonstoneDestination(state, phase);
  return dest && { x: dest.x, y: dest.y, z: dest.z };
}

/**
 * Destino del teleport de piedra lunar POR FASE — las CUATRO tablas paralelas que lee
 * `kernel_moongate_teleport` (`ULTIMA.EXE:0x47f4`, `ret 2`, arg = fase 0..7), en su orden:
 *
 * ```
 * 47fd: cmp byte ptr [bx + 0x5840], 0xff   ; la piedra está EN LA MOCHILA
 * 4802: jne 0x480a
 * 4804: sub ax, ax                         ;   → devuelve 0 = FRACASO, sin tocar nada
 * …
 * 483d: mov al, byte ptr [bx + 0x5840] / 4841: mov byte ptr [g_location], al
 * 4844: mov al, byte ptr [bx + 0x5830] / 4848: mov byte ptr [g_party_x],  al
 * 484b: mov al, byte ptr [bx + 0x5838] / 484f: mov byte ptr [g_party_y],  al
 * 4852: mov al, byte ptr [bx + 0x5848] / 4856: mov byte ptr [g_floor],    al
 * ```
 *
 * ⚠ NO confundir con `moongateDestination`, que es OTRA pregunta: aquélla elige la fase
 * ACTIVA por la hora (madrugada Felucca / noche Trammel) y PROYECTA a (x, y, z). Ésta
 * recibe la fase YA elegida — el `1`..`8` que teclea Vas Rel Por (ficha #341), o la fase
 * activa que `Game.checkMoongate` calcula al pisar la puerta (#352, 0x4962-0x4976) — y
 * devuelve además **`location`**, que es el campo por el que el teleport te cambia de
 * localización (`0x4841` lo ESCRIBE).
 *
 * El único gate es `!= 0xFF`: `0x47fd` **no** compara contra `g_location` — la piedra
 * enterrada en otro sitio SÍ es destino válido. (Ése es el gate de DIBUJO, `0x4713`, que
 * vive en `moongateAt`.)
 */
export function moonstoneDestination(
  state: Pick<GameState, "moonstones">,
  phase: number,
): (WorldPoint & { location: number }) | null {
  const stone = (state.moonstones ?? [])[phase];
  if (!stone || stone.location === 0xff) return null;
  return { x: stone.x, y: stone.y, z: stone.z, location: stone.location };
}

/**
 * Entierra la moonstone de fase `phase` en (x, y, z) DENTRO de `location`.
 *
 * Los cuatro campos son los cuatro arrays paralelos que escribe `bury_moonstone`,
 * `CAST.OVL:0x1588`-`0x15a0`: x a `0x5830`, y a `0x5838`, **`g_location` a `0x5840`** y
 * `g_floor` a `0x5848`. `location` era el que faltaba: sin él, enterrar en un pueblo se
 * releía como enterrada en el sobremundo en esas mismas (x,y) — y está permitido, porque
 * la puerta del (U)se sólo rechaza `location >= 0x21` (#143a).
 */
export function buryMoonstone(
  state: GameState,
  phase: number,
  x: number,
  y: number,
  z: number,
  location: number,
): void {
  const stone = state.moonstones[phase];
  if (!stone) throw new Error(`Fase de moonstone inválida: ${phase}`);
  stone.x = x;
  stone.y = y;
  stone.z = z;
  stone.location = location;
  stone.buried = true;
}

/**
 * ¿Hay una moonstone ENTERRADA en (x,y,z)? Devuelve su fase, o null. NO muta —
 * la usa el (S)earch, que en el original sólo MATERIALIZA la piedra como objeto
 * visible; pasarla al inventario es cosa del (G)et posterior.
 *
 * Calco de `search_moonstone` SJOG 0x03A8, bucle 0x03b5-0x0420: recorre las 8 piedras
 * (idx 7→0, `mov [bp-4],8` + `dec/jns`) y exige que casen las CUATRO tablas paralelas —
 * `[bx+0x5830]`, `[bx+0x5838]`, `[bx+0x5848]` (los tres args del llamador: el caller
 * 0x0b81 empuja x, y y `g_floor`) y `[bx+0x5840] == g_location`.
 *
 * ⚠ DIMENSIÓN NO MODELADA, declarada: el port guarda {x,y,z,buried} y NO tiene el campo
 * LOCATION, así que aquí no se compara la cuarta tabla (0x5840). En el original ese byte
 * vale 0xFF cuando la piedra está en el inventario —la lectura que ya usaban usePicker y
 * endgame/use-tools, ratificada por la tarjeta #63—, y `buried` cubre justo esa
 * distinción; lo que NO cubre es enterrar una piedra DENTRO de un pueblo concreto. No lo
 * invento: se declara y queda para quien modele el campo.
 */
export function buriedMoonstoneAt(
  state: GameState,
  x: number,
  y: number,
  z: number,
): number | null {
  // `?? []`: hay estados-stub (parity runs, tests de bus de sfx) sin el array. El (S)earch
  // corre en todos ellos, así que la consulta tiene que tolerar la ausencia — sin él, 4
  // tests reventaban con TypeError. No es defensivo por gusto: es el contrato real.
  const phase = (state.moonstones ?? []).findIndex(
    (m) => m.buried && m.x === x && m.y === y && m.z === z,
  );
  return phase < 0 ? null : phase;
}

/**
 * Desentierra la moonstone en (x, y, z): la pasa al inventario (buried=false) y
 * devuelve su fase (índice), o `null` si no había ninguna enterrada ahí.
 */
export function digUpMoonstone(
  state: GameState,
  x: number,
  y: number,
  z: number,
): number | null {
  const phase = state.moonstones.findIndex(
    (m) => m.buried && m.x === x && m.y === y && m.z === z,
  );
  if (phase < 0) return null;
  state.moonstones[phase]!.buried = false;
  // El byte 0x5840 pasa a 0xFF: `buried` y `location` son DOS CARAS del mismo byte, así que
  // se mueven juntos o se contradicen (SJOG.OVL:0x1496 planta el centinela).
  state.moonstones[phase]!.location = 0xff;
  return phase;
}
