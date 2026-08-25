/**
 * Transporte del jugador — reglas EXACTAS del original (Task 3.7).
 *
 * Modela el byte g_transport_tile (DS 0x587C) con facing y estado de vela
 * embebidos, y los verbos Board / X-it / Fire / Yell(Hoist-Furl) de CMDS.OVL,
 * la reparación de casco del Camp (kernel 0x3C9A) y el coste de tiempo naval
 * con HMS Cape (MAINOUT 0x0670). Derivación en re/notes/transport.md; citas
 * asm en re/verified/transport.md.
 *
 * Codificación de g_transport_tile (tile>>2 = clase en DATA.OVL 0x54F4):
 *   0x1C/0x1D  a pie       0x1C = visible · 0x1D = INVISIBLE (ver `TILE_INVISIBLE`)
 *   0x10-0x13  caballo   0x10/0x11 = del MUNDO (sin jinete) · 0x12 = montado ESTE ·
 *                        0x13 = montado OESTE — ★ SÓLO DOS sprites montados
 *   0x14-0x17  alfombra mágica           0x14 = ESTE · 0x15 = OESTE (ídem, dos)
 *   ⚠ `base+0/1/2/3 = N/E/S/O` es la codificación de los BARCOS (0x20-0x2B), que sí
 *     tienen cuatro sprites y recomponen con `(tile&0xFC)+facing` (transport_face
 *     0x0152/0x016a). Caballo y alfombra NO la usan: su rama escribe LITERALES 0x12/0x13
 *     (0x14/0x15) sólo para E y O, y en N/S deja el tile INTACTO (0x0111-0x014A, idéntico
 *     en TOWN 0x05A9/0x05CB). Ver `mountFaceTile`. Montar hace `+2` sobre el tile del
 *     mundo (ver `board`) y eso es OTRA cosa que girar — confundirlas es lo que hacía que
 *     esta cabecera dijera «+2 = Sur» cuando 0x12 es ESTE.
 *   0x20-0x23  fragata, velas IZADAS     (navega por viento)
 *   0x24-0x27  fragata, velas ARRIADAS   (rema, sin viento)
 *   0x28-0x2B  esquife (skiff)           (rema)
 *   0x2C-0x2F  nave NPC de vela (pirata) — objeto del mundo, NO del jugador
 */
import type { GameState, TransportMode } from "../state.js";
import type { RandFn } from "./survival.js";
import { defaultRand } from "./survival.js";
import { WIND_CALM } from "./wind.js";
import type { Direction } from "./movement.js";

export const TILE_FOOT = 0x1c;
/**
 * Tile de PRESENTACIÓN del actor INVISIBLE (sprite `0x1d | 0x100` = 0x11D en el atlas,
 * la silueta azul hueca). NO es «otro sprite de andar»: es el byte que los TRES caminos
 * de invisibilidad del PARTY escriben en el campo de RENDER (`+1`) de la tabla de actores
 * de mundo `0x5C5A` (paso 8; `+0` = tile BASE, `+1` = tile de RENDER):
 *   - Sanct Lor   `CAST.OVL:0x0b12`   `mov byte [bx+0x5c5b],0x1d`  (sólo `+1`)
 *   - Ring 0x2A   `ULTIMA.EXE:0x67d1` `mov byte [bx+0x5c5b],0x1d`  (sólo `+1`)
 *   - Poción negra `CAST.OVL:0x150d`  `mov [di+1],al` + cola compartida `0x1510
 *     mov [bx],al` ⇒ escribe `+1` Y `+0` (la púrpura hace lo mismo con 0x90).
 * Que este byte vive en el MISMO espacio que `g_transport_tile` lo fija el sincronizador
 * de la ranura 0 fuera de combate (`ULTIMA.EXE:0x53b8-0x53be`: `+0` y `+1` := el byte de
 * transporte). Por eso `isOnFoot` acepta los dos: 0x1C a pie visible, 0x1D a pie INVISIBLE.
 */
export const TILE_INVISIBLE = 0x1d;
export const TILE_HORSE = 0x10;
export const TILE_CARPET = 0x14;
export const TILE_FRIGATE_SAILS_UP = 0x20;
export const TILE_FRIGATE_SAILS_DOWN = 0x24;
export const TILE_SKIFF = 0x28;
const TILE_NPC_SHIP = 0x2c;

/** Casco máximo del barco (obj+5; shipwright lo pone a 99). */
export const HULL_MAX = 0x63;

/**
 * Casco inicial de la nave NPC de vela (pirata, clase 0x2C) al aparecer en el
 * world_turn — constante hardcodeada `mov byte [bx+0x5C5F],0x64` (MAINOUT spawn
 * 0xFC4 @0x1050, tras `cmp [bp-2],0x2C`). Son 100, UNO MÁS que el `HULL_MAX=99` del
 * barco del jugador.
 *
 * 🔴 CORREGIDO 2026-08-06 (#35): la frase que seguía —«una nave pirata capturada excede
 * el tope del jugador»— es FALSA. Era una consecuencia inventada al lado de una premisa
 * correcta, y sobrevivía sólo porque el clon no modelaba la captura, así que no había
 * con qué desmentirla. La captura la desmiente: `SJOG.OVL 0x20a3` es
 * `mov byte ptr [bx+5], 0x63` — un **`mov` incondicional de 99** que pisa el 100. Los
 * 100 son el casco MIENTRAS SIGUE SIENDO PIRATA; **una nave capturada sale exactamente
 * en 99 y nunca excede el tope**. Por eso el fix de #35 usa `HULL_MAX`, no esta
 * constante: quien lo escriba mirando sólo este comentario elegiría el 100.
 */
export const PIRATE_SHIP_HULL = 0x64;

/**
 * #35 — tile CRUDO (sin banco) de la fragata que queda al vencer al pirata. El binario resta
 * 8 al tile del pirata (`SJOG.OVL 0x209c`), llevando 0x2c..0x2f a 0x24..0x27 **con el rumbo
 * dentro de los dos bits bajos**. El clon lleva UN solo tile de pirata, así que **fija el
 * rumbo**: 0x24 = proa al norte. Divergencia Clase C — ver `piratePrizeShip` (enemies.ts).
 */
export const DERELICT_FRIGATE_TILE = 0x24;
/** Esquifes de la nave capturada — `SJOG.OVL 0x20a7 mov byte [bx+7], 2`. */
export const PIRATE_PRIZE_SKIFFS = 2;
/** Umbral "SHIP BADLY DAMAGED" y de reparación en bucle del Camp. */
const HULL_DANGER = 0x0a;
/**
 * Umbral del aviso "Hull weak!" al VIRAR la fragata — transport_face (MAINOUT
 * 0x00DA, bloque fragata 0x016A): tras imprimir "Head <dir>" (facing cambió),
 * `cmp byte [0x5C5F],0x32; jb 0x01C0` → push DS 0x2976 ("Hull weak!\n", fileoff
 * 0x2986). Solo fragata (familias 0x20/0x24 → 0x016A); el skiff (0x28 → 0x0152)
 * no pasa por este bloque. NO es un aviso por-paso: solo al cambiar el rumbo.
 */
export const HULL_WEAK = 0x32;

/** Clase de transporte = tile>>2 alineada al rango base (tile & 0xFC). */
export function transportBase(tile: number): number {
  return tile & 0xfc;
}

export function isOnFoot(tile: number): boolean {
  return tile === TILE_FOOT || tile === TILE_INVISIBLE;
}

/**
 * ¿El party va MONTADO a caballo? = `and al,0xfe / cmp al,0x12` ⇒ 0x12-0x13 y nada más.
 *
 * NO es lo mismo que `isHorse` (`tile & 0xfc === 0x10`, o sea 0x10-0x13): según la
 * codificación de la cabecera de este fichero, **0x10/0x11 es el caballo DEL MUNDO,
 * sin jinete** — un objeto sobre el mapa — y sólo 0x12/0x13 es el party a lomos (E/O).
 * Montar hace `+2` sobre el tile del mundo (ver `board`), que es justo el salto entre
 * los dos pares.
 *
 * El binario usa esta forma exacta allá donde la pregunta es «¿vas montado?»:
 * `TALK.OVL CS:0x00f0` (los mercaderes no atienden a caballo, #170) y
 * `TOWN.OVL CS:0x0b97` (Klimb montado → "-On foot!").
 */
export function isMounted(tile: number): boolean {
  return (tile & 0xfe) === 0x12;
}

/**
 * ¿Es este byte un caballo DEL MUNDO (sin jinete)? = `and al,0xfe / cmp al,0x10` ⇒
 * 0x10-0x11 y nada más — la forma EXACTA del gate del caballo en `board`
 * (`CMDS.OVL CS:0x0832`, la primera rama del despacho sobre el byte +0 que devuelve
 * `find_object_at_xy`).
 *
 * El par de arriba (0x12/0x13) NO entra: es el party MONTADO (`isMounted`), que vive en
 * `g_transport_tile` y en el slot 0 de la tabla, nunca en un slot de objeto 1..31. El par
 * de abajo tampoco existe. Y `isHorse` (0x10-0x13) es MÁS ANCHO a propósito: contesta
 * «¿esto es un caballo, montado o no?», que es otra pregunta.
 *
 * Los DOS valores del par son alcanzables sobre el mapa, no sólo el 0x10 que planta el
 * establo (`SHOPPES.OVL 0x0967 mov byte [di],0x10`): desmontar hace `transport − 2`
 * (`exit`, más abajo), así que un party que baja mirando al OESTE (0x13) deja un 0x11 —
 * que es justo el byte que llevan los quince `original/av-saves/SAVED.GAM.*` en su slot 2.
 */
export function isWorldHorse(tile: number): boolean {
  return (tile & 0xfe) === 0x10;
}

function isHorse(tile: number): boolean {
  return transportBase(tile) === TILE_HORSE;
}
function isCarpet(tile: number): boolean {
  return transportBase(tile) === TILE_CARPET;
}
export function isFrigateSailsUp(tile: number): boolean {
  return transportBase(tile) === TILE_FRIGATE_SAILS_UP;
}
export function isFrigateSailsDown(tile: number): boolean {
  return transportBase(tile) === TILE_FRIGATE_SAILS_DOWN;
}
/** Cualquier estado de fragata (velas izadas o arriadas): 0x20-0x27. */
export function isFrigate(tile: number): boolean {
  return (tile & 0xf8) === 0x20;
}
export function isSkiff(tile: number): boolean {
  return transportBase(tile) === TILE_SKIFF;
}

/**
 * Clase de passability GRUESA (state.transport) del byte g_transport_tile.
 * movement.ts `isPassable` decide con esta clase; game.ts la mantiene en sync
 * con `transportTile` al abordar/desembarcar. Fragata (izadas o arriadas) = "ship";
 * la diferencia velas-izadas/arriadas vive en transportTile, no aquí. (Rangos:
 * re/notes/transport.md §1.)
 */
export function transportMode(tile: number): TransportMode {
  const base = transportBase(tile);
  if (base === TILE_HORSE) return "horse";
  if (base === TILE_CARPET) return "carpet";
  if (base === TILE_SKIFF) return "skiff";
  if (isFrigate(tile)) return "ship";
  return "foot";
}

/**
 * VERBO DE RUMBO por clase de vehículo — `transport_face` MAINOUT **0x00DA**.
 *
 * La rutina lee `g_transport_tile`, hace `and ax,0xFC` (0x00EA) y despacha por clase
 * IMPRIMIENDO EL VERBO antes de que el llamador imprima el rumbo:
 *
 * | clase | destino | string | bytes (DATA.OVL) |
 * |---|---|---|---|
 * | `0x10` caballo  | 0x010A | `"Ride "` | DS 0x2946 = file 0x2956 |
 * | `0x14` alfombra | 0x0130 | `"Fly "`  | DS 0x294C = file 0x295C |
 * | `0x28` esquife  | 0x0152 | `"Row "`  | DS 0x2951 = file 0x2961 |
 * | `0x20`/`0x24` fragata | 0x016A | `"Head "` | DS 0x2956 = file 0x2966 |
 * | resto (`0x1C` a pie) | 0x0129 | — (no imprime) | — |
 *
 * Los verbos llevan **espacio final y NINGÚN salto de línea**; los rumbos llevan `\n`
 * (`"North\n"` DS 0x29DB = file 0x29EB). Por eso el original compone `"Fly " + "North\n"`
 * = una sola línea `Fly North` — que es exactamente lo que el espejo leyó en el LP.
 *
 * ASIMETRÍA DE LA FRAGATA, derivada y deliberada: caballo/alfombra/esquife imprimen el
 * verbo en TODO pulsado y devuelven 0 (el llamador sigue y imprime el rumbo); la fragata
 * imprime `"Head " + rumbo` **sólo si el facing CAMBIÓ** (`0x0181 cmp` → si es igual salta
 * a 0x01DC) y devuelve 1, que aborta el paso. Por eso `"Head "` NO sale de esta tabla: lo
 * compone `headMessage` en su propia rama.
 *
 * Devuelve `null` a pie: el binario no imprime verbo para la clase 0x1C.
 */
export function faceVerb(tile: number): string | null {
  const base = transportBase(tile);
  if (base === TILE_HORSE) return "Ride ";
  if (base === TILE_CARPET) return "Fly ";
  if (base === TILE_SKIFF) return "Row ";
  return null;
}

/** turn_arg por dirección (MAINOUT 0x04D3): N→0, E→1, S→2, O→3. */
const TURN_ARG: Record<Direction, number> = {
  north: 0,
  east: 1,
  south: 2,
  west: 3,
};

/** Rumbo (g_sail_dir del kernel 1=O,2=E,3=N,4=S) por dirección de tecla. */
export const SAIL_DIR: Record<Direction, number> = {
  west: 1,
  east: 2,
  north: 3,
  south: 4,
};

/** Nuevo tile de facing = (tile&0xFC)+turn_arg (MAINOUT 0x015C/0x0163). */
export function faceTile(tile: number, dir: Direction): number {
  return (tile & 0xfc) + TURN_ARG[dir];
}

/**
 * Los DOS sprites de cada clase montada, LITERALES como los escribe el binario.
 *
 * ⚠ NO se derivan con un `clase + k` común: el caballo y la alfombra usan offsets
 * DISTINTOS sobre su clase — caballo `0x10` → E `0x12` (+2) / O `0x13` (+3); alfombra
 * `0x14` → E `0x14` (+0) / O `0x15` (+1). El binario no calcula: hace `mov` de un
 * inmediato en cada rama (0x0117/0x0124 y 0x013d/0x014a). Generalizarlo a un `+2/+3`
 * único da `0x16/0x17` para la alfombra, que son otra cosa — lo cazó el test de esta
 * misma tanda, y es el mismo error de sobre-generalizar que la cabecera de arriba.
 */
const MOUNT_FACING_TILES: Record<number, { east: number; west: number }> = {
  0x10: { east: 0x12, west: 0x13 }, // caballo  — MAINOUT 0x0117 / 0x0124
  0x14: { east: 0x14, west: 0x15 }, // alfombra — MAINOUT 0x013d / 0x014a
};

/**
 * Sprite de CABALLO y ALFOMBRA al moverse: sólo tienen DOS orientaciones (E y O), y
 * Norte/Sur **dejan el tile INTACTO**.
 *
 * DERIVADO de `transport_face` (MAINOUT.OVL 0x00da), rama caballo 0x010a y rama alfombra
 * 0x0130 — y `town_transport_face` (TOWN.OVL 0x057c) repite la forma instrucción a
 * instrucción en 0x05a9/0x05cb:
 *
 * ```
 * 0111: cmp [bp+4], 1 ; jne      →  0117: mov [g_transport_tile], 0x12   (alfombra 0x14)
 * 011e: cmp [bp+4], 3 ; jne      →  0124: mov [g_transport_tile], 0x13   (alfombra 0x15)
 * 0129: (sigue SIN tocar el tile)                     ← las otras dos direcciones
 * ```
 *
 * `[bp+4]` es el **facing 0..3** (= `TURN_ARG`), y eso NO se asume: las ramas NAVALES del
 * MISMO `transport_face` no comparan sino que calculan — esquife 0x0152 y fragata 0x016a
 * hacen `al=[bp+4] ; cl=tile ; and cl,0xfc ; add al,cl ; tile=al`, o sea
 * `tile = (tile&0xFC) + [bp+4]`. Con N=0/E=1/S=2/O=3 (MAINOUT 0x04D3, el `TURN_ARG` de
 * arriba) ⇒ `==1` es ESTE y `==3` es OESTE.
 *
 * ⚠ NO se aplica `faceTile` a estas dos clases: esa fórmula `(tile&0xFC)+facing` es de los
 * BARCOS (0x20-0x2B), que sí tienen cuatro sprites. El caballo escribe LITERALES y tiene
 * sólo dos; `0x10`/`0x11` son el caballo del MUNDO y montar hace `+2` (ver `board`), que
 * es una operación distinta de girar.
 *
 * Devuelve el tile nuevo, o el MISMO tile si la dirección no gira (N/S) o la clase no es
 * de dos sprites.
 */
export function mountFaceTile(tile: number, dir: Direction): number {
  const par = MOUNT_FACING_TILES[tile & 0xfc];
  if (!par) return tile;
  const facing = TURN_ARG[dir];
  if (facing === 1) return par.east; // ESTE  (0x0111 `cmp [bp+4],1`)
  if (facing === 3) return par.west; // OESTE (0x011e `cmp [bp+4],3`)
  return tile; // Norte (0) y Sur (2): caen al `jmp 0x129` SIN tocar el tile
}

export interface ShipStep {
  /** Tile de transporte tras el intento (puede haber cambiado el facing). */
  tile: number;
  /**
   * El sprite CAMBIÓ de rumbo. ⚠ `turned` NO implica «no avanza»: eso sólo vale para
   * la fragata. Quien decide si el paso sigue es `moves` (= el retorno 0/1 del binario).
   */
  turned: boolean;
  /** El barco avanza este tick (rema o navega con viento). */
  moves: boolean;
  /** Fragata con velas izadas y Calm: becalmada ("in irons"), no mueve. */
  becalmed: boolean;
}

/**
 * transport_face + regla de girar/avanzar (MAINOUT 0x00DA, cuerpo entero leído).
 *
 * `moves` ES el retorno de la rutina INVERTIDO, y el retorno está derivado de punta a
 * punta (las dos comprobaciones que faltaban en #32, ya cerradas):
 *   (a) PRÓLOGO: `00e0 mov word [bp-2],0` — el valor por defecto es 0, justo tras
 *       `sub sp,4`. Toda rama que no lo reescriba devuelve 0. La salida es única:
 *       `0129 mov ax,[bp-2]` → `01f8 ret 2`.
 *   (b) CONSUMIDOR: `outdoor_move` MAINOUT 0x0490, en sus CUATRO call-sites (0x04f6 N,
 *       0x0549 S, 0x0563 E, 0x057d O) hace `or ax,ax` y con ≠0 salta a 0x0592 (`ret 4`)
 *       SIN mover; con 0 cae a 0x050e, que llama al paso real (0x01fe). Es decir:
 *       **retorno 1 = el giro se comió la acción; retorno 0 = el paso continúa.**
 *
 * Ramas (la clase es `tile & 0xFC`, 0x00ea):
 *   - ESQUIFE 0x28 → rama **0x0152**: imprime «Row », recompone `tile=(tile&0xFC)+facing`
 *     y `jmp 0x129` **sin escribir [bp-2]** ⇒ devuelve 0 ⇒ **gira Y AVANZA en el mismo
 *     pulsado** (ticket #32). Es una rama DISTINTA de la de la fragata: el esquife no
 *     tiene «Head », ni aborta, ni pasa por el aviso de casco.
 *   - FRAGATA 0x20/0x24 → rama **0x016A**: recompone el tile y compara con el viejo
 *     (0x0181). Si CAMBIÓ → «Head <rumbo>» y `01ad mov ax,1 / 01b0 mov [bp-2],ax`
 *     ⇒ devuelve 1 ⇒ NO avanza. Si NO cambió (0x01dc):
 *       · `tile >= 0x24` (velas arriadas) → cae al retorno 0: rema siempre.
 *       · velas izadas (0x20-0x23) → 0x01e6 mira **g_wind** (DS 0x5892). Calm(0) →
 *         `01f0 mov [bp-2],1` ⇒ becalmada, no avanza. Con viento → 0.
 *     ⚠ El gate 0x01e6 es g_wind, **NO** g_sail_dir (DS 0x5955): son globales distintas
 *     y conviven en la zona. g_sail_dir sólo lo mira el LLAMADOR (0x0500), para decidir
 *     si imprime el rumbo — otra cosa.
 *
 * ★ Hay DOS escrituras de 1, no una: 0x01b0 (fragata que vira) y 0x01f0 (becalmada).
 *   El parcial heredado de #32 decía «el ÚNICO write de 1 es 01f0» y se dejaba fuera
 *   precisamente la principal. re/notes/transport.md §2 ya las listaba bien.
 */
export function shipFacingStep(tile: number, dir: Direction, wind: number): ShipStep {
  const nt = faceTile(tile, dir);
  // ESQUIFE: rama 0x0152, que nunca toca [bp-2]. Va ANTES del test de giro porque para
  // esta clase girar no es una alternativa a avanzar: ocurren las dos cosas.
  if (isSkiff(tile)) {
    return { tile: nt, turned: nt !== tile, moves: true, becalmed: false };
  }
  if (nt !== tile) {
    return { tile: nt, turned: true, moves: false, becalmed: false };
  }
  if (tile >= 0x24) {
    return { tile, turned: false, moves: true, becalmed: false }; // rema
  }
  // Velas izadas (0x20-0x23): depende del viento.
  if (wind === WIND_CALM) {
    return { tile, turned: false, moves: false, becalmed: true };
  }
  return { tile, turned: false, moves: true, becalmed: false };
}

// ---------------------------------------------------------------------------
// ship_try_move (MAINOUT 0x01FE) — atraque/colisión/BREAKING UP/cactus/bloqueo.
// ---------------------------------------------------------------------------

/** Tiles especiales del destino naval (MAINOUT 0x01FE / re/notes/transport.md §2). */
const TILE_DOCK = 0x47;
const TILE_BREAKUP = 3;
/** Cactus (0x2f). Intransitable en TODOS los modos; su rama de bloqueo imprime
 *  «OUCH!» y pincha al party en vez del beep normal (MAINOUT 0x0329). Compartido
 *  con `resolveStep` (vía a pie) — misma rutina 0x01FE del binario. */
export const TILE_CACTUS = 0x2f;

/**
 * Daño de casco en COLLISION/BREAKING UP = **rand(1,30)**, NO una constante.
 * Derivado de damage_ship (MAINOUT 0x109E: `push 1; push 0x1e; call rand;
 * sub [g_hull],al`), llamado desde ship_try_move en 0x0303. Consume 1 tirada del
 * stream. `damage_ship` gatea 0x109E `transport&0xF8==0x20` (solo fragata): en la
 * rama COLLISION el barco SIEMPRE es fragata con velas izadas (sailing), así que
 * el gate se cumple. Si el daño ≥ casco, el barco se hunde (0x10D6).
 */
export const HULL_DAMAGE_MIN = 1;
export const HULL_DAMAGE_MAX = 30;

/**
 * Grupo de sprite del REMOLINO en la tabla de actores (MAINOUT 0x031e `cmp al,0xec`
 * tras `and al,0xfc`). El mismo gate aparece en 0x125a (turno del remolino, el que
 * imprime "\nWHIRLPOOL!\n") y en 0x19a7. Ver `isWhirlpool` en world/enemies.ts.
 */
export const WHIRLPOOL_ACTOR_GROUP = 0xec;

/**
 * Umbral A-PIE / VEHÍCULO de la cola de bloqueo: MAINOUT 0x0312
 * `cmp [g_transport_tile],0x20 / jb 0x322`. Por DEBAJO el gate del remolino ni se
 * consulta (a pie el rechazo es "Blocked!" normal); a partir de 0x20 sí.
 */
const TRANSPORT_VEHICLE_MIN = 0x20;

/**
 * ¿El actor de la casilla destino es un transporte ABORDABLE para el modo actual?
 * — MAINOUT 0x0245-0x0283, el bloque que decide `[bp-2]` cuando
 * `find_object_at_xy` devolvió un actor no nulo.
 *
 * `[bp-2]` entra valiendo **1** (0x0215 `mov [bp-2],1` = «se mueve»), y el bloque lo
 * pone a **0** en cuanto hay actor (0x0240); sólo vuelve a 1 si el actor es abordable.
 * Por eso **cualquier actor NO abordable bloquea el paso sea cual sea el terreno**: con
 * `[bp-2]=0` el test de passability del terreno (0x02a8) ni se llega a llamar
 * (0x029f `je 0x2b4`) y el flujo cae directo a la cola de choque/bloqueo de 0x02c0.
 *
 * Las tres ramas, por el modo del jugador (`t = g_transport_tile`):
 *   t ≥ 0x30 **o** t < 0x20 (a pie / montura / alfombra, 0x0245-0x0251 → 0x0253):
 *       abordable si 0x24 ≤ a < 0x2c (fragata o esquife), a == 0x1b (caballo)
 *       o (a & 0xFE) == 0x10 (alfombra).
 *   0x20 ≤ t < 0x28 (FRAGATA, 0x0270 `cmp 0x28 / jb 0x288`):
 *       **nada** es abordable — desde una fragata no se aborda.
 *   0x28 ≤ t < 0x30 (ESQUIFE, 0x0277-0x0281):
 *       abordable sólo 0x24 ≤ a < 0x28, es decir la FRAGATA (volver a bordo).
 *
 * `actorTile` llega como tile de 9 bits del port (`0x100 | sprite`); el binario compara
 * un byte, así que se enmascara. Cita: disasm MAINOUT 0x0245-0x0283.
 */
export function isBoardableActorTile(actorTile: number, transportTile: number): boolean {
  const a = actorTile & 0xff;
  const t = transportTile & 0xff;
  if (t >= 0x30 || t < TRANSPORT_VEHICLE_MIN) {
    return (a >= 0x24 && a < 0x2c) || a === 0x1b || (a & 0xfe) === 0x10;
  }
  if (t < 0x28) return false; // fragata: no aborda nada
  return a >= 0x24 && a < 0x28; // esquife → fragata
}

export interface ShipMoveResult {
  outcome: "dock" | "collision" | "breakup" | "blocked" | "cactus" | "blocked-silent";
  /**
   * Líneas a imprimir EN ORDEN (mismo contrato que `SinkResult.messages`). Son
   * varias porque el binario encadena DOS prints en la rama de cactus: «Blocked!»
   * (MAINOUT 0x0322) y luego «OUCH!» (MAINOUT 0x032f). Un único `message` no podía
   * expresarlo y la vía naval se comía el «Blocked!» — divergencia #216.
   */
  messages: string[];
  /** transportTile tras auto-FURL en dock (transport+4); si no, el mismo. */
  transportTile: number;
  /** Casco a restar (collision/breakup) = rand(1,30); 0 si no aplica. */
  hullDamage: number;
  /** El daño ≥ casco: el barco se hunde (damage_ship 0x10D6). */
  sunk: boolean;
  /** Cactus: el caller tira rand(1,8) de daño al party (0x01FE/0xA8D8 OUCH). */
  partyDamageRoll: boolean;
  /** El party avanza al destino (solo "dock"). */
  moves: boolean;
}

/**
 * ship_try_move(destTile) — MAINOUT 0x01FE. Resuelve el DESTINO cuando un barco
 * intenta entrar en un tile que NO es agua libre navegable. `sailing` = navegando
 * con velas izadas (g_sail_dir≠0); si false, rema (skiff / fragata arriada). El
 * binario ramifica PRIMERO por régimen (0x02C0 `cmp g_sail_dir,0`):
 *
 *   NAVEGANDO (0x02C0-0x030B):
 *     destino 0x47  → "Docked!" + auto-FURL (transport+4), atraca (avanza).  [0x02DF]
 *     destino 3     → "BREAKING UP!" + daño rand(1,30) al casco.             [0x02C7]
 *     otro (sólido) → "COLLISION!" + daño rand(1,30) al casco.               [0x02D8]
 *   COLA DE BLOQUEO (MAINOUT 0x0312 - MAINOUT 0x0347) — **NO es «la rama de remar»**:
 *   MAINOUT 0x0312 es el discriminador A-PIE/VEHÍCULO (`cmp [g_transport_tile],0x20 / jb 0x322`) y la
 *   cola la COMPARTEN pie y barco (transport.md §7E, corrección de #169; es la
 *   etiqueta estrechada que escondió el cactus meses — #157). Aquí se modela sólo
 *   el lado vehículo; el lado a pie es `resolveStep` (world/movement.ts), mismo
 *   bloque del binario. Sus tres salidas, y el complemento son TRES, no dos:
 *     transport≥0x20 y [bp-4]&0xFC==0xEC → SILENCIO: ni mensaje ni beep. [MAINOUT 0x031e]
 *         `[bp-4]` es el retorno de MAINOUT 0x0236 `call 0xffffb4be` = kernel
 *         **0x368E `find_object_at_xy(x,y,floor)`** (resuelto POR BANDA: near_call_base
 *         de MAINOUT = 0x81D0 ⇒ 0xB4BE+0x81D0 = 0x368E < KERNEL_TOP), que barre la tabla
 *         de actores de 8 B (DS 0x5c62-0x5d5a) y devuelve el TILE del actor en el destino
 *         (0 si no hay). Y **0xEC..0xEF en ese dominio es el REMOLINO**: el mismo gate
 *         `and al,0xfc / cmp al,0xec` sobre la MISMA tabla aparece en MAINOUT 0x125a
 *         (cuerpo que imprime DS 0x6b04 = "\nWHIRLPOOL!\n" y pone g_transport_tile=0xEC)
 *         y en MAINOUT 0x19a7 (turno del actor). O sea: un VEHÍCULO que empuja contra un
 *         remolino se bloquea SIN mensaje, porque quien habla es el remolino en su turno.
 *         ✅ PORTADA (#282): outcome `blocked-silent`. ✅ TESTIGO EMPÍRICO (#343): la
 *         derivación entera careada contra el binario VIVO — remo mudo bloqueado (party
 *         y hull intactos, sin Blocked!/beep, con control positivo del instrumento),
 *         COLLISION! bajo vela, y reubicación por el TURNO del remolino a (34,18)/0xFF —
 *         re/notes/testigo-remolino-343.md (re/tools/whirlpool_witness_probe.py). La ocupación de casilla por actores
 *         del exterior ya se consulta en la vía naval — `resolveNavalStep` busca el actor
 *         en `overworldEnemies` y pasa su tile por `actorTile`, igual que el binario lo
 *         lee con `find_object_at_xy` ANTES del terreno. Lo que sigue SIN modelar es la
 *         vía A PIE en el sobremundo (`resolveStep`), que es la otra mitad del MISMO
 *         bloque del binario: ver §OCUPACIÓN abajo y re/notes/remolino-282-acta.md §5.
 *     resto → "Blocked!" SIEMPRE (el print va ANTES del test de cactus) [MAINOUT 0x0322]
 *         y encima, excluyentes: destino 0x2f → "OUCH!" + rand(1,8) al party,
 *                                                                        [MAINOUT 0x032f]
 *                                si no      → beep de choque (0xa5, 0xc8) [MAINOUT 0x033c]
 *
 * Por eso el resultado lleva `messages: string[]` y no un `message`: la rama de cactus
 * emite DOS líneas, "Blocked!" y luego "OUCH!" (#216; la vía a pie ya lo calcaba en
 * game.ts, testigo LP1 part07-g12 «Blocked! 0UCH!»).
 *
 * ✅ CERRADA (#224): el beep del `else` (MAINOUT 0x033c, `beep(0xa5,0xc8)`) ya lo emite
 * también la vía naval — `resolveNavalStep` empuja `sfxEvent("move-blocked")` en el
 * outcome "blocked", el MISMO cue que la vía a pie, porque en el binario es el mismo
 * `call 0xffffa0f0`. NO hizo falta infraestructura de audio: el cue existía en
 * `core/sfx.ts` y su realización en `skin/fiel/speaker.ts` es literalmente
 * `beep(0xa5, 0xc8)`.
 * ⚠ Lo que SIGUE sin cablear del brazo de VELA es el `noise_burst(0x12c,0x7d0,0x64)` de
 * MAINOUT 0x02f4 (collision/breakup): OTRA primitiva, y sin entrada en el catálogo de
 * cues ⇒ declarado y remitido al carril de audio con #202. Atracar es MUDO en el binario
 * (MAINOUT 0x02f1 `jmp 0x306` salta el call), así que ahí no falta nada.
 *
 * El daño de casco es rand(1,30) (damage_ship 0x109E), NO constante; por eso esta
 * fn recibe `rand` (como `broadside`) y devuelve el valor tirado + `sunk`. En el
 * binario el atraque y la colisión ponen g_sail_dir=0 (0x0306); eso lo aplica el
 * caller (navalMove). NO decide passability: el caller solo la invoca para tiles
 * especiales o no navegables. Cita: re/notes/transport.md §2; disasm 0x01FE/0x109E.
 */
export function shipTryMove(
  destTile: number,
  transportTile: number,
  sailing: boolean,
  hull: number = HULL_MAX,
  rand: RandFn = defaultRand,
  actorTile: number = 0,
): ShipMoveResult {
  const base = {
    transportTile,
    hullDamage: 0,
    sunk: false,
    partyDamageRoll: false,
    moves: false,
  };
  // §OCUPACIÓN — MAINOUT 0x0236-0x0283. El binario lee el actor del destino ANTES que
  // el terreno y, si no es abordable, fuerza `[bp-2]=0`: el paso falla aunque el
  // terreno sea navegable, y el flujo converge con el de terreno-impasable en 0x02c0.
  // Aquí `blockedByActor` es esa convergencia: el resto de la función ya ES la cola de
  // 0x02c0 en adelante, así que no hace falta ramificar dos veces. `actorTile === 0` es
  // el centinela «no hay actor» del propio binario (0x023c `or ax,ax; je 0x288`).
  const blockedByActor = actorTile !== 0 && !isBoardableActorTile(actorTile, transportTile);
  if (sailing) {
    if (destTile === TILE_DOCK) {
      // Atraca: add [g_transport_tile],4 (MAINOUT 0x02EC) auto-arría 0x20-0x23 → 0x24-0x27.
      // NO avanza al muelle: ship_try_move devuelve bp-2=0 en MAINOUT 0x0306, que salta
      // a MAINOUT 0x034A ⇒ outdoor_move (MAINOUT 0x0520) `or ax,ax; je` salta move_party.
      // Auto-FURL + parada, sin pisar el dock (que además es boat-impassable). El caller
      // pone sailDir=0 (MAINOUT 0x0306).
      return {
        ...base,
        outcome: "dock",
        messages: ["Docked!"],
        transportTile: transportTile + 4,
        moves: false,
      };
    }
    const dmg = rand(HULL_DAMAGE_MIN, HULL_DAMAGE_MAX); // damage_ship 0x109E
    const damaged = { ...base, hullDamage: dmg, sunk: dmg >= hull };
    if (destTile === TILE_BREAKUP) {
      return { ...damaged, outcome: "breakup", messages: ["BREAKING UP!"] };
    }
    return { ...damaged, outcome: "collision", messages: ["COLLISION!"] };
  }
  // REMOLINO: la ÚNICA salida MUDA de toda la cola de bloqueo (MAINOUT 0x0319-0x0320
  // `mov al,[bp-4] / and al,0xfc / cmp al,0xec / je 0x34a`). El `je` salta al EPÍLOGO
  // (0x34a), es decir por delante del print de «Blocked!» (0x0322) Y del beep (0x033c):
  // ni mensaje ni sonido, y `[bp-2]` vale 0 ⇒ no avanza. Habla el remolino en SU turno
  // (0x1248), no el intento de paso. Va guardado por el umbral de vehículo de 0x0312:
  // a pie el remolino NO tiene salida propia y cae al «Blocked!» normal. #282.
  if (
    blockedByActor &&
    transportTile >= TRANSPORT_VEHICLE_MIN &&
    (actorTile & 0xfc) === WHIRLPOOL_ACTOR_GROUP
  ) {
    return { ...base, outcome: "blocked-silent", messages: [] };
  }
  // Remando (skiff / fragata arriada): sin daño de casco. «Blocked!» (DS 0x29ae,
  // MAINOUT 0x0322) va SIEMPRE y ANTES del test de cactus (MAINOUT 0x0329), así que
  // el cactus imprime DOS líneas y no una — #216.
  if (destTile === TILE_CACTUS) {
    return { ...base, outcome: "cactus", messages: ["Blocked!", "OUCH!"], partyDamageRoll: true };
  }
  return { ...base, outcome: "blocked", messages: ["Blocked!"] };
}

/** Tile de ahogo del jugador (damage_ship 0x1120: g_transport_tile=0, a pie EN el agua). */
export const TILE_DROWN = 0;

export interface SinkResult {
  /** Líneas a imprimir en orden: "Ship sunk!" y luego "Abandon ship!" o "DROWNING!!!". */
  messages: string[];
  /** Nuevo g_transport_tile: skiff 0x28+facing / alfombra 0x14|0x15 / 0 (ahogo). */
  transportTile: number;
  /** Modo de passability resultante (skiff / carpet / foot). */
  mode: TransportMode;
  /** Alfombras restantes (solo decrementa en la rama de conversión a alfombra). */
  carpets: number;
  /** Ahogo (tile 0, "DROWNING!!!") — no hubo skiff ni alfombra. */
  drowned: boolean;
}

/**
 * Hundimiento de la fragata del JUGADOR — damage_ship 0x10D6-0x1166 (MAINOUT).
 * Se invoca cuando el daño de casco ≥ casco navegando (COLLISION/BREAKING UP; el
 * gate 0x109E `transport&0xF8==0x20` ya garantizó fragata). Imprime "Ship sunk!"
 * (DS 0x6ada) SIEMPRE, luego convierte por PRIORIDAD skiff > alfombra > ahogo:
 *   skiffs>0  → skiff 0x28+(old&3): FACING PRESERVADO, skiffs NO decrementa (0x10F5)
 *               + "Abandon ship!" (DS 0x6ae6).
 *   carpets>0 → carpets−−; alfombra 0x14+rand(0,1) (facing N/E ALEATORIO, +1 tirada
 *               del stream, 0x1108) + "Abandon ship!".
 *   si no     → ahogo (0x1120): tile 0 (a pie EN el agua), "DROWNING!!!" (DS 0x6af6),
 *               SIN "Abandon ship!". El party-wipe / daño de HP / teleport del ahogo
 *               viven en helpers opacos del bucle de animación → preguntas de oráculo
 *               (deliberate-divergences §3); esta fn NO los modela.
 * El casco NO se clampa (0x109E `sub` incondicional; el objeto-barco se destruye).
 * g_sail_dir=0 lo pone el LLAMADOR (0x0306), no esta fn. RNG: +1 rand(0,1) SOLO en la
 * conversión a alfombra (skiff y ahogo no tiran). Cita: re/notes/transport.md §7E;
 * scout-sinking.md; disasm MAINOUT 0x10D6-0x1166.
 */
export function sinkPlayerShip(
  transportTile: number,
  skiffs: number,
  carpets: number,
  rand: RandFn = defaultRand,
): SinkResult {
  const messages = ["Ship sunk!"];
  if (skiffs > 0) {
    messages.push("Abandon ship!");
    return {
      messages,
      transportTile: TILE_SKIFF + (transportTile & 3), // facing preservado; skiffs NO decrementa
      mode: "skiff",
      carpets,
      drowned: false,
    };
  }
  if (carpets > 0) {
    messages.push("Abandon ship!");
    return {
      messages,
      transportTile: TILE_CARPET + rand(0, 1), // facing N (0x14) / E (0x15) aleatorio (+1 RNG)
      mode: "carpet",
      carpets: carpets - 1,
      drowned: false,
    };
  }
  messages.push("DROWNING!!!");
  return { messages, transportTile: TILE_DROWN, mode: "foot", carpets, drowned: true };
}

// ---------------------------------------------------------------------------
// Board (B) — CMDS.OVL 0x07F6. Sin RNG.
// ---------------------------------------------------------------------------

export interface BoardResult {
  ok: boolean;
  message: string;
  /** Nuevo g_transport_tile si ok. */
  transportTile?: number;
  /**
   * Avisos INDEPENDIENTES al abordar la fragata (CMDS 0x08E5 y 0x0920 son ramas
   * separadas, no excluyentes): pueden salir "DANGER…" y "WARNING…" a la vez.
   */
  warnings?: string[];
}

/**
 * Board(worldTile) — CMDS.OVL 0x07F6. `worldTile` = tile del mundo bajo el
 * party; `fromTile` = g_transport_tile actual. Abordar caballo/alfombra/skiff
 * exige ir a PIE (helper 0x6EE: transport∈{0x1c,0x1d}, si no "On foot").
 * `horseOwned` = el caballo del pueblo tiene NÚMERO DE DIÁLOGO, es decir es de
 * alguien (0x0856 `cmp word [bx+0x5f68],0`, ANTES del gate a pie). El campo es
 * `g_npc_rt +0x0A` = dialogNumber (DS 0x5F5E, 32 registros de 0x10 B;
 * re/notes/npc.md §0.4), NO un índice de dueño: se carga por NPC del tercer
 * bloque del .NPC y lo pisan los centinelas 0xFE/0xFD de posesión y alarma. En
 * el port lo cablea `Game.board()` desde `NpcManager.npcAt(...).dialogNumber`.
 * Muta hull/skiffs/carpets al abordar la fragata.
 */
export function board(
  state: GameState,
  worldTile: number,
  fromTile: number,
  horseOwned = false,
): BoardResult {
  // Mazmorra (0x20 < location < 0x29) → "Not here!".
  const loc = state.position.location;
  if (loc > 0x20 && loc < 0x29) return { ok: false, message: "Not here!" };

  if (isWorldHorse(worldTile)) {
    // 0x085d `mov ax,0x425e` → DS 0x425e = DATA.OVL fileoff 0x426e = b'"Nay!"\n':
    // el original imprime las COMILLAS literales y el salto de línea (es el relincho
    // del caballo, entrecomillado). Va ANTES del gate a pie (0x0862).
    if (horseOwned) return { ok: false, message: '"Nay!"\n' };
    if (!isOnFoot(fromTile)) return { ok: false, message: "On foot" }; // 0x0862 call 0x6EE
    return { ok: true, message: "horse", transportTile: worldTile + 2 }; // 0x12/0x13
  }
  if (worldTile === 0x1b) {
    if (!isOnFoot(fromTile)) return { ok: false, message: "On foot" };
    return { ok: true, message: "carpet", transportTile: TILE_CARPET };
  }
  if (transportBase(worldTile) === TILE_SKIFF) {
    if (!isOnFoot(fromTile)) return { ok: false, message: "On foot" };
    // #273 (adyacente a §7.1) — SIN `+2`: la rama skiff (CMDS 0x0898-0x08B5) carga el
    // byte del objeto (0x08B2 `mov al,[bp-0xa]`) y salta DIRECTO al store con 0x08B5
    // `jmp 0x0875`, por encima del `add al,2` de 0x0873, que es EXCLUSIVO del caballo
    // (0x0870-0x0873). El esquife se monta con su tile TAL CUAL (0x28-0x2B, facing
    // preservado); con el `+2` heredado, 0x2A/0x2B daban 0x2C/0x2D — fuera de la
    // clase esquife (isSkiff falso, transporte roto).
    return { ok: true, message: "skiff", transportTile: worldTile };
  }
  if (isFrigate(worldTile)) {
    // Gate 0x70C: solo desde alfombra 0x14/0x15, a pie 0x1c/0x1d o skiff 0x28-0x2b.
    const boardable =
      (fromTile & 0xfe) === 0x14 || isOnFoot(fromTile) || isSkiff(fromTile);
    if (!boardable) return { ok: false, message: "On foot" };
    const hull = state.shipHull ?? HULL_MAX;
    let skiffs = state.shipSkiffs ?? 0;
    const warnings: string[] = [];
    // DANGER (hull<10) y WARNING (skiffs==0) son ramas INDEPENDIENTES (0x08E5 /
    // 0x0920); la estiba de alfombra/skiff ocurre ENTRE ambas.
    if (hull < HULL_DANGER) warnings.push("DANGER: SHIP BADLY DAMAGED!");
    state.shipHull = hull;
    if ((fromTile & 0xfe) === 0x14) state.magicCarpets++; // 0x090C estiba alfombra (0x14/0x15)
    if ((fromTile & 0xfc) === TILE_SKIFF) skiffs++; // 0x0919 estiba skiff (0x28-0x2b)
    if (skiffs === 0) warnings.push("WARNING: NO SKIFFS ON BOARD!");
    state.shipSkiffs = skiffs;
    return { ok: true, message: "Ship", transportTile: worldTile, warnings };
  }
  return { ok: false, message: "What?" };
}

// ---------------------------------------------------------------------------
// X-it (X) — CMDS.OVL 0x0EB4. Sin RNG.
// ---------------------------------------------------------------------------

export interface ExitResult {
  ok: boolean;
  message: string;
  /** Nuevo g_transport_tile si ok. */
  transportTile?: number;
  /** Tile del vehículo que se deja en el mundo (para colocarlo), o null. */
  dropTile?: number;
  /**
   * F1.5 · Tile de la nave (fragata velas arriadas) RE-ATRACADA como objeto del
   * mundo al desembarcar en TIERRA (rama 1 del switch de fragata, transport.md §7B).
   * Distinto de `dropTile` (caballo/alfombra, que se pintan vía mapOverride): la
   * nave persiste como worldObject con su hull/skiffs vivos → re-abordable. Sólo se
   * fija en el desembarco fragata→tierra; las ramas skiff/alfombra (2/3) NO dejan
   * una fragata. El tile preserva el facing de la fragata activa (0x24-0x27).
   */
  parkedShipTile?: number;
}

/**
 * X-it(transport) — CMDS.OVL 0x0EB4. `landNearby` = predicado 0x73E (tierra
 * ortogonal adyacente). `waterUnderSkiff` = el skiff está sobre agua no
 * desembarcable (tile&0xFE==0x6A). `walkableUnder` = el tile BAJO el party es
 * pisable a pie — predicado 0x6CCC(0x1C, [bp-6]) del binario (kernel ULTIMA.EXE
 * 0x2C4C vía base near-call de CMDS 0xBF80; test de passability por CLASE,
 * 0x1C>>2=7 = a pie): es la MISMA primitiva con que 0x73E cierra cada ortogonal
 * (CMDS 0x0788:0x07A6-0x07AD), y sólo la consulta la rama de la ALFOMBRA.
 * Muta skiffs/carpets al botar/estibar.
 */
export function exitTransport(
  state: GameState,
  transport: number,
  landNearby: boolean,
  waterUnderSkiff = false,
  walkableUnder = false,
): ExitResult {
  const base = transportBase(transport);
  switch (base) {
    case TILE_HORSE:
      return { ok: true, message: "horse!", transportTile: TILE_FOOT, dropTile: transport - 2 };
    case TILE_CARPET:
      // #273 §7.2 — DOS vías de aceptación (cmd_xit ruta A, 0x0F20-0x0F36): tierra
      // ortogonal (0x0F20 `call 0x73E`) **o**, si 0x73E==0, suelo bajo el party pisable
      // a pie (0x0F27 `push 0x1C` / 0x0F2B `push [bp-6]` / 0x0F31 `call 0x6CCC`). La
      // segunda acepta el X-it en una isla de 1 tile. El rechazo (ambas a 0) re-llama
      // 0x73E en 0x0F4C y siempre cae en DS 0x4386 "No land nearby!" (la rama 0x4398
      // de 0x0F5A es código muerto: 0x73E es determinista dentro del mismo turno).
      // Derivación: re/notes/xit-pila-273.md §1 ruta A, verificada aquí sobre el .asm.
      if (!landNearby && !walkableUnder) return { ok: false, message: "No land nearby!" };
      return { ok: true, message: "carpet!", transportTile: TILE_FOOT, dropTile: 0x1b };
    case TILE_FOOT:
      return { ok: false, message: "what?" };
    case TILE_FRIGATE_SAILS_UP:
      return { ok: false, message: "Under sail!" };
    case TILE_FRIGATE_SAILS_DOWN: {
      // Prioridad de desembarque (0x43d2 y sig.).
      if (landNearby) {
        // Rama 1 (tierra): a pie; la fragata se RE-ATRACA como objeto del mundo con
        // su tile actual (facing preservado). F1.5 · transport.md §7B.
        return { ok: true, message: "ship!", transportTile: TILE_FOOT, parkedShipTile: transport };
      }
      if ((state.shipSkiffs ?? 0) > 0) {
        // 🔴 #270: la fragata TAMBIÉN se amarra al botar el esquife. Las TRES ramas del
        // binario (0x0FAA tierra · 0x0FC1 esquife · 0x0FDD alfombra) guardan el MISMO
        // `[bp-2]` —el byte de la fragata— y caen en la MISMA cola 0x0FF4, que emite el
        // objeto de mundo. Aquí sólo faltaba `parkedShipTile`; el decremento va ANTES
        // para que el objeto se lleve N−1 (0x0FCF `dec al`): el esquife que te llevas
        // sale del inventario de la nave amarrada. Derivación: re/notes/xit-esquife-270.md §1-§4.
        state.shipSkiffs = (state.shipSkiffs ?? 0) - 1;
        return {
          ok: true,
          message: "ship!",
          transportTile: transport + 4, // bota skiff → 0x28
          parkedShipTile: transport,
        };
      }
      if (state.magicCarpets > 0) {
        // #270, rama 0x0FDD: se consume una ALFOMBRA, no un esquife — el binario salta a
        // 0x0FB5 (`mov al,[skiffs]` SIN `dec`), así que la nave amarrada conserva TODOS
        // sus esquifes. Por eso este brazo no toca `shipSkiffs`.
        state.magicCarpets--;
        return {
          ok: true,
          message: "ship!",
          transportTile: TILE_CARPET,
          parkedShipTile: transport,
        };
      }
      return { ok: false, message: "No skiffs on board!" };
    }
    case TILE_SKIFF:
      // Exige tierra adyacente (0x0F72: 0x73E==0 → "No land nearby!" 0x43AC) y
      // LUEGO rechaza el agua no desembarcable (0x0F85: tile bajo &0xFE==0x6A →
      // "Not here!"). El predicado 0x73E tiene la MISMA polaridad en los 3
      // callers (≠0 = hay tierra). ⚠ La 2ª vía 0x6CCC es EXCLUSIVA de la
      // alfombra: aquí no hay segunda oportunidad.
      if (!landNearby) return { ok: false, message: "No land nearby!" };
      if (waterUnderSkiff) return { ok: false, message: "Not here!" };
      // #273 §7.1 — el esquife se APARCA, no se evapora (ruta C, 0x0F90-0x0F9A):
      // 0x0F97 `mov al,[g_transport_tile]` y 0x0F9A `jmp 0x0F6C` — entra en la rama
      // del caballo DESPUÉS de su `sub al,2` (0x0F6A), o sea `[bp-2]` = el tile del
      // esquife TAL CUAL (0x28-0x2B, facing preservado); 0x0F43 pone al party a pie
      // y la cola 0x0FF4 emite el objeto en la celda del party. Familia del
      // fotograma 11 de #264/#270 (el vehículo que desaparecía al X-it).
      return { ok: true, message: "skiff!", transportTile: TILE_FOOT, dropTile: transport };
    default:
      return { ok: false, message: "what?" };
  }
}

// ---------------------------------------------------------------------------
// Yell (Y) — CMDS.OVL 0x1418. Hoist / Furl de velas.
// ---------------------------------------------------------------------------

export interface YellResult {
  ok: boolean;
  message: string;
  transportTile?: number;
}

/**
 * Yell(transport) — CMDS.OVL 0x1418. En fragata (0x20-0x27) fuera del
 * underworld (location<0x80) iza/arría velas; si no, "what?".
 *   velas izadas (0x20) → "FURL!"  (+4 → velas arriadas)
 *   velas arriadas (0x24) → "HOIST!" (−4 → velas izadas)
 */
export function yell(transport: number, location: number): YellResult {
  if (isFrigate(transport) && location < 0x80) {
    if (isFrigateSailsUp(transport)) {
      return { ok: true, message: "FURL!", transportTile: transport + 4 };
    }
    return { ok: true, message: "HOIST!", transportTile: transport - 4 };
  }
  return { ok: false, message: "what?" };
}

// ---------------------------------------------------------------------------
// Fire (F) broadside — CMDS.OVL 0x0962. 1×rand(1,20) por impacto.
// ---------------------------------------------------------------------------

export interface BroadsideResult {
  ok: boolean;
  /** Mensaje a mostrar, o AUSENTE. El broadside del original NO imprime texto al
   *  impactar-sin-hundir (CMDS 0x0a82 resta casco + anima humo, sin string): ese caso
   *  devuelve `message` undefined y el cableado no emite línea. */
  message?: string;
  /** Daño infligido al primer objeto impactado (rand(1,20)), o 0. */
  damage?: number;
  /** El objeto impactado se hundió (casco en underflow). */
  sunk?: boolean;
}

/**
 * ¿Es el disparo perpendicular a la quilla? (0x0962: bit0 de transport = eje
 * N/S vs E/W). La fragata dispara broadsides SOLO perpendicular a su rumbo.
 * transport&1 par (0x20 N,0x22 S) = quilla N/S → dispara E/O; impar (0x21 E,
 * 0x23 O) = quilla E/O → dispara N/S.
 */
export function broadsidePerpendicular(transport: number, dir: Direction): boolean {
  const keelNS = (transport & 1) === 0; // 0x20/0x22/0x24/0x26 = proa N/S
  const fireNS = dir === "north" || dir === "south";
  return keelNS ? !fireNS : fireNS;
}

/**
 * Resuelve un broadside contra un objetivo a `range` celdas (1..3). Requiere
 * fragata y disparo perpendicular. `targetHull` = casco del objetivo. Devuelve
 * el daño rand(1,20) y si se hunde. Sin objetivo válido, ok=false.
 */
export function broadside(
  transport: number,
  dir: Direction,
  hasTarget: boolean,
  targetHull: number,
  rand: RandFn = defaultRand,
): BroadsideResult {
  if (!isFrigate(transport)) return { ok: false, message: "What?" };
  if (!broadsidePerpendicular(transport, dir)) {
    return { ok: false, message: "Fire broadsides only!" };
  }
  if (!hasTarget) return { ok: true, message: "Missed!" };
  const damage = rand(1, 20); // ÚNICA tirada (0x0A74)
  const remaining = targetHull - damage;
  const sunk = remaining < 0; // underflow byte (>0x7F) → 0x7AF4 hunde
  // Hundir imprime "Ship sunk!" (DS 0x6ada); impactar-sin-hundir NO imprime nada
  // [CORREGIDO t#57: decía 0x6aef, que cae en la `s` de «sunk» y no existe en ningún
  //  .asm; DS 0x6ada = `Ship sunk!\n` sí, con 11 usos entre MAINOUT y ULTIMA.EXE]
  // en el original (CMDS 0x0a82 solo resta casco + anima humo) → sin mensaje.
  return sunk ? { ok: true, message: "Ship sunk!", damage, sunk } : { ok: true, damage, sunk };
}

// ---------------------------------------------------------------------------
// Reparación de casco en Camp — kernel 0x3C9A. rand(1,3) cap 99, bucle si <10.
// ---------------------------------------------------------------------------

export interface RepairResult {
  hull: number;
  /** Minutos de juego consumidos (5 × advance_clock(5) = 25). */
  minutes: number;
  /** Nº de tiradas rand(1,3) consumidas. */
  rolls: number;
}

/**
 * Reparación de casco al acampar en fragata con velas arriadas (kernel
 * 0x3C9A, path transport&0xFC==0x24). Coste fijo 25 min; suma rand(1,3) al
 * casco (cap 99) y REPITE mientras el casco quede < 10. Barco sano (>=10) =
 * exactamente 1 tirada.
 */
export function repairHull(hull: number, rand: RandFn = defaultRand): RepairResult {
  let h = hull;
  let rolls = 0;
  do {
    h += rand(1, 3);
    if (h > HULL_MAX) h = HULL_MAX;
    rolls++;
  } while (h < HULL_DANGER);
  return { hull: h, minutes: 25, rolls };
}

// ---------------------------------------------------------------------------
// Coste de tiempo naval con HMS Cape — MAINOUT 0x0670.
// ---------------------------------------------------------------------------

export interface NavalStepCost {
  /** Minutos que avanza el reloj este tramo naval. */
  minutes: number;
  /** ¿Corre el world-turn (monstruos) este tramo? Con Cape, solo alternos. */
  worldTurn: boolean;
}

/**
 * Coste de un tramo de navegación (MAINOUT 0x0670). Con HMS Cape (byte
 * g_hms_cape > 0x7F, bit alto) cuesta 1 min y el world-turn corre solo en
 * tramos alternos (el flag 0xA524 alterna 0↔1); sin Cape, 2 min y world-turn
 * cada tramo. Muta state.hmsCapeToggle al alternar.
 */
export function navalStepCost(state: GameState): NavalStepCost {
  const cape = state.specialItems?.hmsCape ?? false;
  if (cape) {
    const toggle = (state.hmsCapeToggle ?? 0) ^ 1;
    state.hmsCapeToggle = toggle;
    // El world-turn corre cuando el toggle POST-flip == 0 (0x0694: cmp
    // [0xA524],0; je → call 0x1A60). Con toggle inicial 0, el PRIMER tramo
    // naval con Cape SALTA el world-turn (flip→1) y lo corre en el segundo.
    return { minutes: 1, worldTurn: toggle === 0 };
  }
  return { minutes: 2, worldTurn: true };
}

// ---------------------------------------------------------------------------
// Nave NPC de vela (clase 0x2C) — modulación de movimiento por viento. Sin RNG.
// ---------------------------------------------------------------------------

/**
 * Umbral de frenado por viento de las naves NPC (DATA.OVL 0x2BF6), indexado
 * por [facing 0..3][viento-1: N/S/E/O]. Valor 4 = nunca frena en ese
 * facing/viento. Determinista (MAINOUT 0x198C).
 */
const NPC_SHIP_STOP_THRESHOLD: readonly (readonly number[])[] = [
  [2, 3, 4, 4], // facing 0
  [4, 4, 2, 3], // facing 1
  [3, 2, 4, 4], // facing 2
  [4, 4, 3, 2], // facing 3
];

/**
 * ¿Avanza la nave NPC (tile 0x2C-0x2F) este world-turn? Con Calm (wind 0) NO se
 * mueve (0x1A07: g_wind==0 → no mover). Con viento, la tabla la ralentiza: un
 * acumulador por objeto que, al superar el umbral, salta un turno; umbral 4 =
 * nunca frena (se mueve cada turno). Devuelve {moves, acc}.
 *
 * HOY SIN LLAMADORES DE PRODUCCIÓN (viva solo en tests), igual que su vecina
 * `spawnPurchasedShip` — la tabla es fiel al byte (volcada de DATA.OVL 0x2BF6 en las
 * dos copias del original) y el reset del acumulador reproduce MAINOUT 0x1a48
 * (`mov [si+0x5c61], ah` con ah==0 cuando acc > umbral). El camino VIVO es
 * `enemies.ts pirateMovesThisTurn`, que con viento distinto de 0 siempre mueve y cuyo
 * contador NO resetea nunca; esa divergencia está declarada allí (TODO #37/captura 3).
 *
 * ⚠ PRECONDICIÓN ANTES DE CABLEARLA — medido 30-07-2026: el primer argumento es el tile
 * 0x2C..0x2F, pero el pirata del port lleva `PIRATE_ENEMY_TILE = 300` constante
 * (`enemies.ts:119`), así que `facing` sale 256, cae al fallback `?? 4` = "nunca frena"
 * y el cableado saldría VERDE sin arreglar nada: 50 turnos con tile 300 dan 0 frenados,
 * los mismos que hoy, frente a 16 con el tile 0x2c. Hay que portar antes la rotación del
 * sprite de la nave NPC (0x2c/0x2e ↔ 0x2d/0x2f de `npc_ship_attacks_party`, ya derivada
 * en `frontier-manual.json`), y el cableado entra en la lista de re-sello e2e (#222)
 * porque cambia orden y posición de actores.
 */
export function npcShipMoves(
  npcTile: number,
  wind: number,
  acc: number,
): { moves: boolean; acc: number } {
  if (wind === WIND_CALM) return { moves: false, acc }; // 0x1A07: Calm → no mueve
  const facing = npcTile - TILE_NPC_SHIP; // 0..3
  const threshold = NPC_SHIP_STOP_THRESHOLD[facing]?.[wind - 1] ?? 4;
  if (threshold === 4) return { moves: true, acc }; // nunca frena
  const next = acc + 1;
  if (next <= threshold) return { moves: true, acc: next };
  return { moves: false, acc: 0 }; // frenado este turno; resetea acumulador
}

/**
 * Modelo slot0 de la compra de nave, ANTERIOR a la corrección obj+5/obj+7 y hoy SIN
 * llamadores de producción (viva solo en tests): muta g_hull/g_skiffs del vehículo
 * ACTIVO, y el binario 0x0D22 escribe en el REGISTRO DEL OBJETO del muelle — la vía
 * fiel es `spawnDockShip` (game.ts) + `purchasedShipTile` (abajo), ver el matiz
 * slot0-vs-objeto en game.ts:3794 y transport.md §6/§7. Los datos derivados siguen
 * siendo correctos: `flags` = g_ship_flags (0x6605), 0x82 fragata / <0x80 skiff;
 * casco 99 (0x0D7B); skiffs a bordo = flags & 0x3F (0x0D45: `mov al,[0x6605]; and
 * al,0x3f; mov [bx+7],al` — fragata 0x82 → 2 skiffs); tile fragata velas arriadas
 * S (0x25) / skiff S (0x29).
 */
export function spawnPurchasedShip(state: GameState, flags: number): number {
  state.shipHull = HULL_MAX;
  state.shipSkiffs = flags & 0x3f;
  return flags > 0x7f ? 0x25 : 0x29;
}

/**
 * F1.5 · Tile de la nave recién comprada SIN tocar slot0 (MAINOUT 0x0D22, `tile =
 * (0x6605>0x7F) ? 0x25 : 0x29`): fragata velas arriadas S (0x25) / skiff S (0x29).
 * A diferencia de `spawnPurchasedShip`, esta derivación es PURA (no muta el vehículo
 * activo): el casco/skiffs de la nave APARCADA viven en el OBJETO (obj+5/obj+7), no en
 * g_hull/g_skiffs (slot0) hasta abordar. `spawnDockShip` (game.ts) la usa con
 * `HULL_MAX` y `flags & 0x3F`. Cita: re/notes/transport.md §6/§7.
 */
export function purchasedShipTile(flags: number): number {
  return flags > 0x7f ? 0x25 : 0x29;
}
