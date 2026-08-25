/**
 * (V)iew a gem — construcción de la vista aérea del mapa (RENDER del comando).
 *
 * La MECÁNICA del comando (mensaje / gate de gemas / consumo / turno) vive en
 * `game.ts::view()`, calcada del case V del dispatcher (ULTIMA.EXE.asm 0x341A).
 * Este módulo sólo produce el descriptor de la vista, fiel-suficiente (L3): el
 * original pinta gráficos (categoría `byte[tile+0x1d1a]` → jump-table
 * `draw_gem_map_tile`), aquí se entrega la rejilla de tiles para que la UI la
 * pinte a 1 celda/tile con la paleta.
 *
 * Geometría derivada del binario:
 *  - `gem_view` (LOOKOBJ 0x10fc): doble bucle 32×32 (0x1132-0x1162) sobre la
 *    ventana cargada del mapa, `ext_a172(g_chunk_origin_x+col, g_chunk_origin_y+row)`.
 *    El marcador del jugador es `party − g_chunk_origin` (0x1109/0x110f). En el
 *    overworld la VMAP sigue al jugador (queda ~centrado): el port usa una
 *    ventana centrada `origin = party − 16` y lee con wrap toroidal (map.wraps).
 *    En un small map `g_chunk_origin=(0,0)` → se pinta el mapa 32×32 entero y el
 *    marcador es la posición del jugador.
 *  - mazmorra (`g_location >= 0x21` → DNGLOOK 0x06a8): recorre una ventana de display
 *    22×22 (gate 0..0x15 en 0x034d-0x0363) y para cada celda lee la planta 8×8 con
 *    wrap toroidal `worldX=(dispCol+party_x−11)&7`, `worldY=(dispRow+party_y−11)&7`
 *    (0x0388-0x03ab: `add party_{x,y}` / `sub 0xb` / `and 7`). El −11 es el centro del
 *    display 22×22 (coincide con la semilla 0x0b de la cola). Pero NO embaldosa el
 *    patrón por todo el display: pinta UN SOLO blob = la región CONECTADA con la party.
 *    Es un FLOOD-FILL 8-conexo sembrado en el centro (11,11) que corre en coords de
 *    DISPLAY (cola x@0xa528/y@0xa628 sembrada con 0x0b en 0x06e9/0x06f5). Cada celda
 *    alcanzada se dibuja y se marca visitada (0x0340); sus 8 vecinos se encolan SÓLO si
 *    la celda propaga — los muros/secretas (nibble 0xB/0xC/0xD) la cortan poniendo el
 *    resultado a 0 (0x0608), así que se ven como frontera del blob pero no propagan.
 *    Las celdas nunca alcanzadas quedan negras. El marcador queda fijo en el centro.
 */
import type { GameState } from "../state.js";
import { getActiveMap, type WorldData } from "./map.js";
import type { DungeonState } from "../dungeon/dungeon.js";
import { gemChunkOrigin } from "./chunk-origin.js";

/** Lado de la ventana aérea de exterior/pueblo (gem_view: doble bucle 32×32). */
export const GEM_WINDOW = 32;
/** Lado de la planta de mazmorra (dungeon.ts N = 8): módulo del wrap toroidal. */
export const DUNGEON_VIEW_SIZE = 8;
/**
 * Lado de la ventana de display de la gema de mazmorra (DNGLOOK gate 0..0x15 en
 * 0x034d-0x0363 → 22 celdas). La planta 8×8 se embaldosa toroidalmente por ella.
 */
export const DUNGEON_GEM_DISPLAY = 22;
/**
 * Celda central del display donde se ancla la party (DNGLOOK `sub 0xb` en 0x0393/
 * 0x03a5; semilla 0x0b de la cola de flood en 0x06e9/0x06f5).
 */
export const DUNGEON_GEM_CENTER = 11;

/**
 * Celda del display NO alcanzada por el flood-fill: se pinta NEGRA (la piel busca
 * `ICON[tile]`, y −1 no está en la tabla → sin glifo). El original nunca dibuja
 * estas celdas: su buffer de visitados queda a 0xFF y `draw_gem_map_tile` sólo
 * pinta las que la cola alcanza (DNGLOOK 0x0340, gate `[si]!=0` en 0x0378).
 */
export const DUNGEON_GEM_UNREACHED = -1;

/**
 * Nibbles ALTOS que CORTAN el flood-fill de la gema de mazmorra: la celda SÍ se
 * pinta (frontera del blob) pero NO propaga a sus vecinos. En el binario son las
 * tres ramas de `draw_gem_map_tile` que ponen el resultado a 0 (`mov [bp-6],0` en
 * 0x0608, alcanzado por 0xB en 0x05da→0x608, 0xC en 0x0610→0x62b→0x608 y 0xD en
 * 0x062e→0x621→0x608); el llamador sólo encola cuando el resultado es !=0 (0x0785
 * `or ax,ax; je`). Puertas (0xE) y salas (0xA/0xF) NO cortan → la gema ve a través.
 */
export const DUNGEON_GEM_BLOCKERS: ReadonlySet<number> = new Set([0xb, 0xc, 0xd]);

export type GemEnvironment = "overworld" | "town" | "dungeon";

export interface GemView {
  environment: GemEnvironment;
  width: number;
  height: number;
  /** tiles[row][col]. overworld/town = tile EGA; mazmorra = nibble alto (type). */
  tiles: number[][];
  /**
   * Mazmorra: nibble BAJO (subtipo) por celda, paralelo a `tiles`. Lo consume la piel
   * para el muro SÓLIDO (raw 0xb0 = fuente 0 IBM, glifo 0x7f = bloque lleno = el «blob»)
   * vs el muro DENSO (raw 0xbX, sub!=0 = fuente 1 RUNES, glifo 0x74). DNGLOOK 0x05ee
   * compara el byte crudo con 0xb0; la rama ==0xb0 NO conmuta a RUNES (0x7a0e), así que
   * pinta con la fuente por defecto (IBM), donde 0x7f es sólido.
   */
  sub?: number[][];
  /** celda del marcador (jugador) dentro de la ventana. */
  marker: { x: number; y: number };
}

/**
 * Construye el descriptor de la vista aérea según el entorno actual. `dungeon`
 * no nulo (mazmorra activa) manda sobre `location` (equivale al gate
 * `g_location >= 0x21` del asm).
 */
export function buildGemView(state: GameState, world: WorldData, dungeon: DungeonState | null): GemView {
  // Mazmorra (DNGLOOK 0x06a8): ventana de display 22×22 CENTRADA en la party, con la
  // planta 8×8 leída toroidalmente (DNGLOOK 0x0388-0x03ab). El original NO embaldosa
  // el patrón por todo el display: pinta UN SOLO blob = la región CONECTADA con la
  // party por celdas abiertas. Es un flood-fill 8-conexo sembrado en el centro (11,11)
  // que corre en coordenadas de DISPLAY (por eso una misma celda-mundo puede aparecer
  // dos veces si el camino da la vuelta por el wrap): la cola (x en 0xa528, y en 0xa628)
  // se siembra con 0x0b (0x06e9/0x06f5); `draw_gem_map_tile` (0x0340) pinta y marca
  // visitada la celda alcanzada, y el driver (0x0780) encola sus 8 vecinos SÓLO si el
  // resultado es !=0 — que los muros/secretas (0xB/0xC/0xD) ponen a 0. Las celdas
  // nunca alcanzadas quedan negras (buffer de visitados a 0xFF, jamás dibujadas).
  if (dungeon) {
    const size = DUNGEON_GEM_DISPLAY;
    const c = DUNGEON_GEM_CENTER;
    const mask = DUNGEON_VIEW_SIZE - 1; // 0x7: wrap toroidal de la planta 8×8 (`and 7`)
    const { floor, x: px, y: py } = dungeon.pos;

    // Nibble alto (type) de la celda-mundo bajo cada celda del display (wrap toroidal).
    const typeAt = (col: number, row: number): number =>
      dungeon.cellAt(floor, (col + px - c) & mask, (row + py - c) & mask).type;
    // Nibble bajo (subtipo): lo usa la piel para el muro sólido (0xb0) vs denso (0xbX).
    const subAt = (col: number, row: number): number =>
      (dungeon.cellAt(floor, (col + px - c) & mask, (row + py - c) & mask).sub ?? 0) & 0xf;

    // Flood-fill 8-conexo sobre el DISPLAY 22×22 desde el centro. `reached` = celdas
    // que el original dibuja (== visitadas); el centro se pre-marca visitado (0x0705,
    // byte[0xae7f]=0) y se pinta como marcador de la party, NO con su icono de tile.
    // Buffers planos (como el binario, stride 32 desde 0xad14): idx = row*size + col.
    const visited = new Uint8Array(size * size); // 0 = 0xFF sin visitar; 1 = visitado
    const reached = new Uint8Array(size * size); // 1 = celda dibujada por el flood
    visited[c * size + c] = 1; // centro pre-marcado (sin icono: sólo el marcador)
    const queue: Array<[number, number]> = [[c, c]];
    // 8 vecindad (0x0770: (-1,-1)(0,-1)(+1,-1)(-1,0)(+1,0)(-1,+1)(0,+1)(+1,+1)).
    const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
      [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
    ];
    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue; // gate 0..0x15 (0x034d)
        const idx = ny * size + nx;
        if (visited[idx]) continue; // buffer de visitados (0x0378 `[si]!=0`)
        visited[idx] = 1;
        reached[idx] = 1; // se dibuja SIEMPRE (aun siendo muro-frontera)
        if (!DUNGEON_GEM_BLOCKERS.has(typeAt(nx, ny))) queue.push([nx, ny]); // propaga si !=0
      }
    }

    const tiles: number[][] = [];
    const sub: number[][] = [];
    for (let row = 0; row < size; row++) {
      const line: number[] = [];
      const subLine: number[] = [];
      for (let col = 0; col < size; col++) {
        const on = reached[row * size + col];
        line.push(on ? typeAt(col, row) : DUNGEON_GEM_UNREACHED);
        subLine.push(on ? subAt(col, row) : 0);
      }
      tiles.push(line);
      sub.push(subLine);
    }
    return { environment: "dungeon", width: size, height: size, tiles, sub, marker: { x: c, y: c } };
  }

  const { location, floor, x, y } = state.position;
  const map = getActiveMap(world, location, floor);
  const size = GEM_WINDOW;

  // Overworld (location 0): ventana 32×32 ANCLADA a `g_chunk_origin` (múltiplo de 16),
  // NO centrada en el jugador. El original la fija a la caché de chunks cargada, así que
  // el jugador cae en las columnas 8..23 según su posición dentro del bloque de 16
  // (gem_view 0x1136 lee `ext_a172(chunk_origin+col,row)`; marcador = party−chunk_origin,
  // 0x1109/0x110f). Aquí el origen se deriva con la fórmula de ENTRADA al overworld
  // (MAINOUT 0x0019, `initChunkOrigin`). El large map hace wrap toroidal (map.tileAt).
  //  ⚠ Clase-C: el original mantiene chunk_origin HISTERÉTICAMENTE al andar
  //  (MAINOUT 0x0354, scrollChunkOrigin): tras deambular el origen real puede diferir en
  //  ±16 del de entrada. Reproducirlo exacto exige estado por-paso; la fórmula de entrada
  //  ya cumple lo esencial (no-centrado, cuantizado a 16). Ver chunk-origin.ts.
  if (location === 0) {
    // Origen HISTERÉTICO mantenido por-paso (state.chunkOrigin, MAINOUT scrollChunkOrigin
    // 0x0354); si está ausente/stale (tras un salto no-continuo) se re-deriva con la fórmula
    // de entrada (initChunkOrigin). Antes se usaba SIEMPRE la de entrada (Clase-C #76 r3).
    const origin = gemChunkOrigin(state.chunkOrigin, x, y);
    const tiles: number[][] = [];
    for (let row = 0; row < size; row++) {
      const line: number[] = [];
      for (let col = 0; col < size; col++) line.push(map.tileAt(origin.x + col, origin.y + row));
      tiles.push(line);
    }
    return {
      environment: "overworld",
      width: size,
      height: size,
      tiles,
      marker: { x: (x - origin.x) & 0x1f, y: (y - origin.y) & 0x1f },
    };
  }

  // Pueblo/small map (0 < location < 0x21): mapa 32×32 completo (chunk_origin=(0,0)),
  // marcador en la posición del jugador.
  const tiles: number[][] = [];
  for (let row = 0; row < size; row++) {
    const line: number[] = [];
    for (let col = 0; col < size; col++) line.push(map.tileAt(col, row));
    tiles.push(line);
  }
  return { environment: "town", width: size, height: size, tiles, marker: { x, y } };
}
