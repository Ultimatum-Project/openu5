/**
 * Tiles de poblado por HORA del día: puentes levadizos y rejas (portcullis) de
 * castillos/pueblos amurallados que cambian de noche. Port de TOWN 0x0170
 * (town_time_tile_transform), llamado desde el cargador de mapa 0x0408 (rama
 * 0x0508, sólo de NOCHE) y el manejador de turno horario 0x15c8 (al fichar la
 * hora 0x14=20 o 5). Sin dependencias de render y SIN consumo de RNG (la rutina
 * sólo llama a get_tile_ptr 0x4402) — no altera el stream a ninguna hora.
 *
 * Mecánica derivada del binario (TOWN.OVL.asm 0x0170-0x0211) y VALIDADA contra
 * los 20 mapas con reja/puente de assets/maps/smallmaps.json:
 *
 *  FASE 1 — REJA (portcullis), incondicional, nunca se salta (0x017c-0x01a4):
 *    recorre el mapa 32×32; por cada `0x87 BrickWallArchway` conmuta el tile
 *    inmediatamente al SUR (fila+1, no al este: get_tile_ptr indexa fila*32+col y
 *    el segundo `push` es la fila) con `xor 0xdd`. En los 28 arcos del juego ese
 *    vecino sur es SIEMPRE `0x44 BrickFloor`, así que 0x44↔0x99 = suelo abierto ↔
 *    `0x99 Portcullis` (intransitable). De noche la reja baja; de día sube.
 *
 *  FASE 2 — PUENTE LEVADIZO (0x01be-0x0204):
 *    por cada tablón de puente `0x48/0x49` (LeftWoodFloor2/RightWoodFloor2, casado
 *    con `and 0xfe == 0x48`) estampa `0x03 WaterCoast` (foso, intransitable) →
 *    puente izado. A la hora 5 (amanecer) restaura el tile original. En el clon el
 *    "día" ES el mapa estático (tablón), así que basta con no-aplicar de día.
 *    SALTO: si el party pisa un tablón (`(tileBajoParty & 0xfe) == 0x48`) en el
 *    instante de la transformación, se salta la fase 2 COMPLETA (0x01bc `je`) — no
 *    se iza NINGÚN puente ese ciclo (evita hundir al party). La reja (fase 1) NO
 *    se salta.
 *
 * BANDA NOCTURNA = horas <5 ó >=20 (gate del cargador 0x04fa: `hour<5 → call`,
 * `hour<=19 → skip`; ticks a 0x14 y 5). Día = 5..19.
 *
 * Estado EFÍMERO por-visita/planta (como el buffer vivo 0x6608 que se re-lee de
 * disco en cada carga): NO se serializa al save; se recalcula al entrar al mapa,
 * al cambiar de planta (las escaleras 0x052E recargan vía 0x0408) y en el tick
 * horario a 20/5. Espejo de DoorManager (overlay, sin mutar el tile base).
 */
import type { ActiveMap } from "./map.js";

const ARCHWAY_TILE = 0x87; // BrickWallArchway
const PORTCULLIS_XOR = 0xdd; // 0x44 BrickFloor ↔ 0x99 Portcullis
const RAISED_BRIDGE_TILE = 0x03; // WaterCoast (foso con el puente izado)

/** Un tablón de puente: 0x48/0x49 casados con `and 0xfe == 0x48` (0x01b8). */
export function isBridgePlank(tile: number): boolean {
  return (tile & 0xfe) === 0x48;
}

/**
 * Banda nocturna en la que reja baja y puente izado (TOWN 0x04fa: `cmp 5; jb call`
 * / `cmp 0x13; jbe skip` → call sólo si hour<5 ∨ hour>=20).
 */
export function isNightTileHour(hour: number): boolean {
  return hour < 5 || hour >= 20;
}

export class TownHourTiles {
  private loc = -1;
  private fl = -1;
  /** Overrides calculados para (loc,fl) actuales. Clave = fila*32+col. */
  private overrides = new Map<number, number>();

  private static key(x: number, y: number): number {
    return y * 32 + x;
  }

  /**
   * Recalcula la capa horaria para la planta cargada, leyendo el mapa ESTÁTICO
   * (no la capa compuesta) igual que la rutina recorre el buffer recién cargado.
   * `partyX/partyY` fijan el salto de la fase 2 en el instante de la transformación.
   */
  recompute(
    base: ActiveMap,
    location: number,
    floor: number,
    hour: number,
    partyX: number,
    partyY: number,
  ): void {
    this.loc = location;
    this.fl = floor;
    this.overrides.clear();
    // Sólo large maps no aplican (location 0); aquí sólo se llama con small maps.
    if (!isNightTileHour(hour)) return; // día: la capa queda vacía (mapa estático)

    // FASE 1 — reja: por cada arco 0x87, conmuta el vecino SUR con xor 0xdd.
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (base.tileAt(x, y) !== ARCHWAY_TILE) continue;
        const sy = y + 1;
        if (sy >= 32) continue;
        this.overrides.set(
          TownHourTiles.key(x, sy),
          base.tileAt(x, sy) ^ PORTCULLIS_XOR,
        );
      }
    }

    // FASE 2 — puente: se SALTA entera si el party pisa un tablón (0x01bc).
    if (isBridgePlank(base.tileAt(partyX, partyY))) return;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (isBridgePlank(base.tileAt(x, y))) {
          this.overrides.set(TownHourTiles.key(x, y), RAISED_BRIDGE_TILE);
        }
      }
    }
  }

  /**
   * Tile efectivo: si hay override para (x,y) en la planta calculada, lo devuelve;
   * si no, el tile base. Inerte fuera de (loc,fl) calculados y en large maps.
   */
  effectiveTile(
    location: number,
    floor: number,
    x: number,
    y: number,
    baseTile: number,
  ): number {
    if (location !== this.loc || floor !== this.fl) return baseTile;
    const v = this.overrides.get(TownHourTiles.key(x, y));
    return v === undefined ? baseTile : v;
  }

  /** Descarta la capa (entrada en combate / large map). */
  reset(): void {
    this.loc = -1;
    this.fl = -1;
    this.overrides.clear();
  }
}
