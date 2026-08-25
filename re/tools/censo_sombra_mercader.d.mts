/** Tipos del censo de mercaderes TAPADOS (`censo_sombra_mercader.mjs`), para que el gate de
 *  tipos de `game/` pueda importarlo desde `tests/censo-sombra-mercader.test.ts` sin `any`
 *  implícito. El .mjs es la fuente; esto sólo declara su superficie pública. */

/** Un mercader al que otro NPC de slot MENOR le tapa la celda de horario a esa hora. */
export interface FilaSombra {
  /** location id (1..32) */
  loc: number;
  /** hora del reloj del juego (0..23) */
  hour: number;
  cell: { x: number; y: number; z: number };
  /** el mercader que queda debajo: el (T)alk nunca llega a él */
  tapado: { slot: number; tipo: string; dlg: number; ai: number };
  /** quien contesta en su lugar (slot más bajo de la celda) */
  tapador: { slot: number; dlg: number; tipo: string; ai: number };
}

export interface SlotNpc {
  slot: number;
  type: number;
  dialogNumber: number;
  x: number[];
  y: number[];
  z: number[];
  times: number[];
  aiTypes: number[];
}

/** Port de `schedule_index` (NPC.OVL:0x12E0), quirk 3→1 incluido. */
export function scheduleIndex(times: readonly number[], hour: number): number;

/** Enumera los mercaderes tapados de todo el juego. `SHOP` = dialogNumber → nombre de tipo. */
export function censoSombra(
  npcs: Record<string, SlotNpc[]>,
  SHOP: Map<number, string>,
): FilaSombra[];
