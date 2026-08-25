/**
 * Puertas: comando (O)pen y autocierre (SJOG cmd_open 0x1374; TOWN timer 0x15ef;
 * kernel restore 0x39cc). Sin dependencias de render.
 *
 * Semántica asm-exacta (spec .superpowers/sdd/scout-doors.md):
 *  - Open SÓLO abre las puertas SIN cerrojo 0xB8/0xBA → suelo 0x44 + "Opened!",
 *    guarda el tile en el tracker y arranca timer=4. Los cerrojos de llave
 *    (0xB9/0xBB) y mágicos (0x97/0x98) → "Locked!" (NO abren, NO gastan llaves ni
 *    skull keys, NO cobran turno). 0xAF → "It's open!"; 0x99 → "Too heavy!".
 *  - El autocierre restaura SIEMPRE el tile guardado (0xB8/0xBA), nunca un cerrojo:
 *    como Open sólo abre 0xB8/0xBA, el tracker sólo puede contener 0xB8/0xBA, así
 *    que jamás re-echa el cerrojo mágico (raíz común de #F13-4 y #F13-5).
 *  - La skull key NO se gasta en Open: se gasta con (U)se → Skull Key (CAST.OVL
 *    0x18c4, rama del dispatcher de (U)se item → game.ts::useSkullKey; NO el hechizo
 *    In Ex Por, que no toca puertas), que desmagifica 0x97→0xB8; luego se abre con
 *    (O)pen. (Task #22 corrige la atribución previa a In Ex Por.)
 *
 * Tracker = SLOT ÚNICO (el original mantiene una sola puerta abierta rastreada,
 * g_unk_594f/5950/5951 + timer 0x5952): abrir una 2ª puerta restaura la 1ª de
 * inmediato. El clon usa overlay (no muta el tile base): `effectiveTile` devuelve
 * el suelo sustituto mientras el timer corre y el tile base (0xB8/0xBA, ya en el
 * mapa/override) al expirar.
 */
import type { GameState } from "../state.js";

export const DOOR_TILES = {
  regular: 184, // 0xB8 puerta cerrada SIN cerrojo
  locked: 185, // 0xB9 cerrojo de llave
  regularView: 186, // 0xBA variante "view" (ventana), sin cerrojo
  lockedView: 187, // 0xBB cerrojo de llave, variante "view"
  magicLock: 151, // 0x97 cerrojo MÁGICO
  magicLockView: 152, // 0x98 cerrojo mágico, variante "view"
  heavy: 153, // 0x99 rejilla/portcullis pesada ("Too heavy!")
  open: 175, // 0xAF puerta YA abierta ("It's open!")
} as const;

/** BrickFloor: tile transitable que sustituye a la puerta mientras está abierta. */
export const OPEN_DOOR_SUBSTITUTE = 68; // 0x44

/**
 * Desmagifica la cerradura mágica de un tile: 0x97→0xB8 / 0x98→0xBA (los frames
 * canónicos). Devuelve el tile normal o null si la celda no es una cerradura mágica.
 * Lo consume `Game.useSkullKey`; vive aquí, con `DOOR_TILES`, porque es una regla de
 * TILES DE PUERTA y hay un segundo lector fuera del motor (`tools/guion-visibilidad.mjs`,
 * que encadena clases del port en vez de reimplementarlas).
 *
 * ⚠ El resultado NO es transitable: 0xB8 es la puerta CERRADA. El bitmap de pasabilidad
 * del binario (DATA.OVL fileoff 0x54e4, consumidor kernel 0x2bd4) tiene el bit 184 PUESTO
 * = bloquea, igual que el 151 de partida — así que tras la llave sigue haciendo falta
 * (O)pen, y andar contra la puerta da «Blocked!» en el original y en el clon (ficha #232).
 *
 * ✅ LEÍDO BYTE A BYTE (2026-07-25, carril bancos-residuales; antes estaba «derivado por
 * SIMETRÍA» con el sello An Ex Por y marcado como pendiente). La nota previa buscaba el
 * mapeo en «kernel 0x75a2» y no lo encontraba porque **0x75a2 no es una dirección del
 * kernel**: es el destino near-call CRUDO de `CAST.OVL 0x18fc`, y hay que pasarlo por la
 * regla de `re/notes/overlay-load-layout.md §3` (near_call_base(CAST.OVL)=0xbf80 → CS
 * 0x3522). Y 0x3522 tampoco es la lógica de tile: es el EFECTO (convierte coords, thunk
 * PLINK 0x10e0, glide 2000→3000 vía 0x223c y redibujado 0x5910).
 *
 * El mapeo vive una llamada ANTES, en `CAST.OVL 0x18dd call 0xffffc16e` → stub del
 * kernel 0x80ee → **`CAST2.OVL 0x0768`**:
 *
 *   0768  prólogo; 076e `call 0x306` → fija la celda objetivo (g_cmb_scratch_x/_y)
 *   0775  getdir cancelado → devuelve 0xFFFF
 *   0782  `call 0x6222` → base CAST2 0xe1e0 ⇒ kernel **0x4402 = get_tile_ptr**
 *         (rutina ya bautizada por otra vía, ambient-audio-audit.md) ⇒ bx = PUNTERO
 *         al byte del tile en el mapa vivo
 *   0788  valor de retorno = 0 por defecto
 *   078f  `al = [bx]` — lee el tile
 *   0793  `cmp ax,0x97 ; je 0x7a0` → **07a0: `mov byte ptr [bx], 0xB8`**
 *   0798  `cmp ax,0x98 ; je 0x7b2` → **07b2: `mov byte ptr [bx], 0xBA`**
 *   079d  ni 0x97 ni 0x98 → sale devolviendo 0 (aquí: `null`)
 *   07a3  `or byte ptr [g_unk_24e6], 2` + retorno 1 en ambos casos de éxito
 *
 * ⇒ El mapeo del port es EXACTO y ya no depende de la simetría con An Ex Por. El binario
 * escribe el tile DIRECTAMENTE en el mapa vivo por el puntero de get_tile_ptr — y desde
 * #119 tanda 2 el clon TAMBIÉN: `useSkullKey` muta por `setVolatileTerrain`, no por
 * `mapOverrides`. (Esta frase declaraba una «divergencia de mecanismo» que ya NO existe;
 * corregida en #151.)
 */
export function unmagicDoorTile(tile: number): number | null {
  if (tile === DOOR_TILES.magicLock) return DOOR_TILES.regular;
  if (tile === DOOR_TILES.magicLockView) return DOOR_TILES.regularView;
  return null;
}

/**
 * FIDELITY (Clase C, spec §9 C1): el timer del autocierre del original es
 * `[0x5952]=4` y se decrementa 1 por turno de pueblo (TOWN 0x15f6). El conteo
 * exacto turno-a-turno respecto a la fase del turno de Open está por confirmar
 * con BP en DOSBox; usamos 4.
 */
const DOOR_OPEN_TURNS = 4;

export interface OpenDoor {
  location: number;
  floor: number;
  x: number;
  y: number;
  /** Tile guardado a restaurar (0xB8/0xBA). Espejo de g_unk_594f. */
  tile: number;
  turnsLeft: number;
}

/** Resultado de (O)pen: mensaje del original + si abrió (→ cobra turno). */
export interface OpenResult {
  message: string;
  opened: boolean;
}

function isRegular(tile: number): boolean {
  return tile === DOOR_TILES.regular || tile === DOOR_TILES.regularView;
}
function isLocked(tile: number): boolean {
  return tile === DOOR_TILES.locked || tile === DOOR_TILES.lockedView;
}
function isMagicLocked(tile: number): boolean {
  return tile === DOOR_TILES.magicLock || tile === DOOR_TILES.magicLockView;
}

export class DoorManager {
  /** Slot ÚNICO de la puerta abierta rastreada (g_unk_594f/5950/5951 + timer). */
  private slot: OpenDoor | null = null;

  /**
   * (O)pen sobre la celda (x,y). Reproduce el switch de tile de cmd_open
   * (SJOG 0x13d1-0x1442): sólo 0xB8/0xBA abren (turno SÍ); cerrojos de llave y
   * mágicos → "Locked!" (turno NO, no gasta llaves/skull keys); 0xAF/0x99 dan su
   * mensaje sin turno; el resto ("Nothing to open!") lo dejamos al llamador — la
   * rama else del asm (cofre) la despacha game.ts antes de llegar aquí.
   */
  open(state: GameState, x: number, y: number, tile: number): OpenResult {
    const { location, floor } = state.position;
    if (isRegular(tile)) {
      // Slot único: sobreescribir restaura implícitamente la puerta anterior.
      this.slot = { location, floor, x, y, tile, turnsLeft: DOOR_OPEN_TURNS };
      return { message: "Opened!", opened: true };
    }
    if (tile === DOOR_TILES.open) return { message: "It's open!", opened: false };
    if (tile === DOOR_TILES.heavy) return { message: "Too heavy!", opened: false };
    if (isLocked(tile) || isMagicLocked(tile)) {
      // Los cerrojos NO son competencia de Open: llave → Jimmy, mágico → hechizo.
      return { message: "Locked!", opened: false };
    }
    return { message: "Nothing to open!", opened: false };
  }

  /** Tile efectivo: si la puerta rastreada está en (x,y) y viva, devuelve el suelo. */
  effectiveTile(
    location: number,
    floor: number,
    x: number,
    y: number,
    baseTile: number,
  ): number {
    const d = this.slot;
    if (
      d &&
      d.turnsLeft > 0 &&
      d.location === location &&
      d.floor === floor &&
      d.x === x &&
      d.y === y
    ) {
      return OPEN_DOOR_SUBSTITUTE;
    }
    return baseTile;
  }

  /** Decrementa el timer de la puerta rastreada; al llegar a 0 la cierra (TOWN 0x15ef). */
  tick(): void {
    const d = this.slot;
    if (!d) return;
    d.turnsLeft--;
    if (d.turnsLeft <= 0) this.slot = null;
  }

  /**
   * Limpia el slot SIN restaurar (g_unk_594f=0 en carga de mapa / entrada en
   * combate, §5d). El mapa de pueblo se re-lee fresco al re-entrar.
   */
  reset(): void {
    this.slot = null;
  }

  /** Estado plano para guardar partida (0 ó 1 entrada; el original es slot único). */
  serialize(): OpenDoor[] {
    return this.slot ? [{ ...this.slot }] : [];
  }

  /**
   * Restaura desde el save. Migración compatible: los saves antiguos guardaban una
   * LISTA de puertas abiertas — nos quedamos con la primera (slot único). El campo
   * `tile` puede faltar en saves viejos; por defecto 0xB8 (cosmético: `effectiveTile`
   * lee el tile base del mapa/override, no el guardado).
   */
  restore(openDoors: (Omit<OpenDoor, "tile"> & { tile?: number })[] | undefined): void {
    const first = openDoors?.[0];
    this.slot = first
      ? {
          location: first.location,
          floor: first.floor,
          x: first.x,
          y: first.y,
          tile: first.tile ?? DOOR_TILES.regular,
          turnsLeft: first.turnsLeft,
        }
      : null;
  }
}
