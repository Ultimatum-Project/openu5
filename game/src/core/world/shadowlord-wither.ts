/**
 * MARCHITACIÓN del pueblo ocupado por un Shadowlord — TOWN.OVL 0x0212 (#195).
 *
 * El Shadowlord seca la vegetación de la ciudad donde reina: `Tree ⇒ DeadTree` y
 * `WheatInField ⇒ PlowedField`, a 7/8 por tile, sobre los 1024 del mapa pequeño.
 * Derivación entera con citas en `re/notes/shadowlord-urbano-acta.md §1`.
 *
 * ```
 * 021a  cmp byte [g_shadowlord_here_idx, DS 0x5958], 0xff / 021f jne 0x224
 * 0221    jmp 0x2a8                       ; ningún SL colocado ⇒ SALE SIN TOCAR NADA
 * 0224  mov al,[g_day, DS 0x587e] / 0227 sub ah,ah / 0229 push ax
 * 022a  call CS 0x207e                    ; ★ srand(g_day) — la ÚNICA siembra reproducible
 * 0232  mov [bp-0xc],0                    ; base de FILA (avanza 0x20 en 0x291, tope 0x400)
 * 0237  sub si,si                         ; COLUMNA (0..0x1f, 0x26c)
 * 0245  mov al,[bx+si+0x6608]             ; tile del búfer vivo del mapa pequeño
 * 024b  cmp ax,0x2d / 024e je 0x274       ; WheatInField
 * 0250  cmp ax,0x2e / 0253 jne 0x26b      ; Tree
 * 0255  push 0 / 025b push 7 / 025c call CS 0x2092    ; rand(0,7) — 1 por tile ELEGIBLE
 * 025f  or ax,ax / 0261 je 0x26b          ; r==0 (1/8) NO convierte
 * 0266  mov byte [bx+si+0x6608],0x2b      ; ⇒ DeadTree      (0286 ⇒ 0x2c PlowedField)
 * 029c  or byte [g_unk_24e6],2            ; flag de turno consumido
 * 02a1  call CS 0x2056 / 02a5 call CS 0x207e          ; srand(reloj) — techo de paridad
 * ```
 *
 * **La primera mitad SÍ es portable con paridad EXACTA** — es la rareza del subsistema:
 * `srand(g_day)` es determinista, así que el mismo día produce los mismos tiles muertos,
 * y como el terreno de mapa pequeño es VOLÁTIL (#113/#121: se relee del .DAT en cada
 * entrada) entrar y salir del pueblo el mismo día reproduce el patrón. La cola (0x02A1,
 * `srand(rng_time_hash())`) no se reproduce: el port conserva su stream, precedente D6.
 * El registro de techos de paridad vive en `re/notes/rng.md §Techos de paridad`.
 *
 * ★ **El EJE del barrido está DERIVADO, no heredado.** `tile_addr` (ULTIMA.EXE 0x4402)
 * resuelve en 0x449e-0x44a8 `addr = ([bp+4] << 5) + [bp+6] + 0x6608`, y el call-site
 * MAINOUT 0x06FE (`push g_party_x` · 0x0704 `push g_party_y` · 0x0708 `call`) fija que
 * **[bp+4] es la `y`** — en cdecl el ÚLTIMO push es el que cae en bp+4. ⇒ el índice que
 * avanza de 0x20 en 0x20 es la FILA: se barre `for y: for x:`. (La nota heredada
 * `rng-186-acta.md §3.1` publicaba la fórmula transpuesta, `(x<<5)+y`; con los ejes al
 * revés el conjunto de tiles muertos para un día dado es OTRO, así que esto es
 * load-bearing, no cosmético. Corregido allí.)
 */
import { OriginalRng } from "../rng-original.js";

/** 0x2B — el destino del árbol marchito (TileData.json «DeadTree»). */
export const TILE_DEAD_TREE = 0x2b;
/** 0x2C — el destino del trigo segado (TileData.json «PlowedField»). */
export const TILE_PLOWED_FIELD = 0x2c;
/** 0x2D — origen: trigal en pie (0x024b `cmp ax,0x2d`). */
export const TILE_WHEAT_IN_FIELD = 0x2d;
/** 0x2E — origen: árbol vivo (0x0250 `cmp ax,0x2e`). */
export const TILE_TREE = 0x2e;

/** Lado del mapa pequeño: 1024 tiles = 32 filas × 32 (0x0295 `cmp [bp-0xc],0x400`). */
export const WITHER_MAP_SIDE = 32;

/** Una conversión: la celda y el tile con el que queda. */
export interface WitheredTile {
  x: number;
  y: number;
  tile: number;
}

/**
 * Calcula las conversiones de la marchitación para un día dado. Función PURA: no
 * escribe; devuelve la lista en ORDEN DE BARRIDO (que es el orden de consumo del rand),
 * y el llamador decide sobre qué capa las aplica.
 *
 * El gate del Shadowlord (0x021a) NO está aquí: lo pone el call-site, que es quien tiene
 * el flag físico `g_shadowlord_here_idx` (#52 propuesta A, `shadowlordHereIndex`).
 *
 * @param day   `g_day` (DS 0x587e). Se toma como BYTE: 0x0224 lee `al` y hace `sub ah,ah`.
 * @param tileAt lector del tile RECIÉN CARGADO de disco — el binario corre sobre el búfer
 *               que 0x0408 acaba de reescribir con `read_file_block(…, 0x6608, 0x400, …)`.
 */
export function witherTownVegetation(
  day: number,
  tileAt: (x: number, y: number) => number,
): WitheredTile[] {
  // 0x022a: srand(g_day) sobre un generador PROPIO — la marchitación no toca el stream
  // vivo del port (en el binario sí lo pisa, y por eso los 32 rand(0,1) de la posesión
  // quedan aguas abajo de una semilla de reloj; ver el acta §1.5).
  const rng = new OriginalRng(day & 0xff);
  const out: WitheredTile[] = [];
  for (let y = 0; y < WITHER_MAP_SIDE; y++) {
    for (let x = 0; x < WITHER_MAP_SIDE; x++) {
      const tile = tileAt(x, y);
      if (tile !== TILE_WHEAT_IN_FIELD && tile !== TILE_TREE) continue; // 0x024e/0x0253
      if (rng.next(0, 7) === 0) continue; // 0x025f/0x027e `or ax,ax / je`: 1/8 se salva
      out.push({ x, y, tile: tile === TILE_TREE ? TILE_DEAD_TREE : TILE_PLOWED_FIELD });
    }
  }
  return out;
}
