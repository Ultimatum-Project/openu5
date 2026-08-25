/**
 * POSE del avatar del party según el TILE que pisa — presentación pura (patrón #71:
 * pintar no muta el core). En el original, el sprite del líder no es siempre el de
 * andar: al pisar una SILLA se pinta SENTADO (orientado según la silla), y sobre la
 * CABECERA de una cama se pinta POSTRADO/tumbado. Es sólo un cambio de draw — los
 * tiles son IsWalking_Passable (se entra/sale libremente) y no hay mecánica que
 * bloquee acciones (verificado en TileData: sin flags de bloqueo, sillas IsPushable).
 *
 * DERIVACIÓN (TileData.json, proyecto de datos):
 *  - Sillas 0x90..0x93 = ChairBack{Forward,Left,Back,Right} (la silla mira a un lado;
 *    su nombre dice hacia dónde da el RESPALDO).
 *  - Sprites sentados 0x130..0x133 = SitChair{Up,Right,Down,Left} (el sentado mira al
 *    lado OPUESTO al respaldo). Las dos tablas están ordenadas EN PARALELO en el set
 *    de datos ⇒ mapeo index-a-index: `sit = 0x130 + (silla − 0x90)`. Y cada par es
 *    direccionalmente consistente (respaldo Forward↔mira Up, Left↔Right, Back↔Down,
 *    Right↔Left). La orientación PÍXEL exacta (¿Up es arriba-arriba?) se confirma con
 *    testigo de vídeo en fase 2; el MAPEO (índice-paralelo) es la derivación firme.
 *  - Cama: 0xab LeftBed = la CABECERA (el tile de dormir del comando H, command-dispatch
 *    §H `cmp 0xab`). Pisarla ⇒ 0x11a SleepingInBed (postrado). 0xac RightBed (los pies)
 *    NO cambia el sprite (el testigo del usuario: "parte de CABECERA").
 */

/** Rango de tiles de silla direccional (ChairBackForward..ChairBackRight). */
const CHAIR_TILE_LO = 0x90;
const CHAIR_TILE_HI = 0x93;
/** Base de los sprites sentados (SitChairUp..SitChairLeft), paralela a las sillas. */
const SIT_SPRITE_BASE = 0x130;
/** Cabecera de la cama (LeftBed) — el tile que dispara la pose tumbada. */
export const LEFT_BED_TILE = 0xab;
/** Sprite del avatar postrado en la cama (SleepingInBed). */
const SLEEPING_SPRITE = 0x11a;

/**
 * Sprite de POSE para el tile bajo el party, o `null` si ese tile no impone pose (el
 * caller usa entonces el sprite de andar). PURA: sólo depende de `under`.
 *
 * Silla (0x90-0x93) → sentado orientado (0x130-0x133, index-paralelo). Cabecera de
 * cama (0xab) → postrado (0x11a). Cualquier otro tile → null (de pie).
 */
export function poseSpriteForTile(under: number): number | null {
  if (under >= CHAIR_TILE_LO && under <= CHAIR_TILE_HI) {
    return SIT_SPRITE_BASE + (under - CHAIR_TILE_LO);
  }
  if (under === LEFT_BED_TILE) return SLEEPING_SPRITE;
  return null;
}
