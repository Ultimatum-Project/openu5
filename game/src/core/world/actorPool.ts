/**
 * EL POOL DE ACTORES/OBJETOS del binario — la tabla ÚNICA `DS:0x5C5A` (32 slots × 8 B)
 * que el port partía en tres estructuras (ficha #103): `state.overworldEnemies`,
 * `state.worldObjects` y los NPCs de pueblo. Este módulo es el ÚNICO dueño de la
 * semántica de ranuras: allocators, escáner de reciclado, cascada de desalojo y la
 * VISTA compuesta que las tres particiones alimentan.
 *
 * Derivación completa: `re/notes/pool-103-unificacion-acta.md`. Citas primarias:
 *
 *  - Tabla: base DS 0x5C5A, stride 8, 32 slots; slot 0 = vehículo del jugador
 *    (`re/notes/objects.md`; `re/disasm/ULTIMA.EXE.asm 0x3873` arranca el escáner en
 *    0x5C62 = slot 1). Layout: +0 tile−0x100 · +1 frame · +2 X · +3 Y · +4 floor ·
 *    +5 hull/contenido (bit 0x80 = trampa) · +6 estado de mover · +7 skiffs/viento.
 *  - `find_free_actor_slot` (SJOG.OVL:0x0000): barrido 31→1, primer tile==0; jamás
 *    devuelve el slot 0 (0 = sin hueco).
 *  - Escáner de reciclado (ULTIMA.EXE:0x3868, `ret 6`): slots **1..23**
 *    (`0x3870 mov cx,1` · `0x38cf cmp cx,0x18 / jl`), tile +0 dentro de [lo,hi]
 *    (`0x3885`/`0x388a`), la Corona (0xB5) excluida SIEMPRE (`0x388f cmp al,0xb5`),
 *    y con el flag `cerca` la ranura debe caer FUERA de la ventana 11×11 centrada en
 *    el grupo: acepta si `(x−party_x+5) > 10` sin signo o `(y−party_y+5) > 10`
 *    (`0x389b-0x38b7`). Sin acierto devuelve 0.
 *  - `acquire_actor_slot` (ULTIMA.EXE:0x38E4): cascada de DIEZ llamadas al escáner,
 *    cortocircuito en el primer resultado no nulo (tabla `ACQUIRE_CASCADE` abajo, un
 *    call-site citado por fila). 11 llamadores externos en 5 overlays (censo con
 *    `re/tools/dispatch_table.near_calls_to_kernel`, reproducido en el acta §2).
 *  - `write_object_slot` (ULTIMA.EXE:0x3A74): escribe +0..+5 y deja +6/+7 intactos.
 */

/** Nº total de slots de la tabla (32; slot 0 = vehículo del jugador). */
export const POOL_SLOT_COUNT = 32;

/** Región de RECICLADO del escáner 0x3868: slots 1..23 (`cmp cx,0x18 / jl`). */
export const RECYCLE_SLOT_LO = 1;
export const RECYCLE_SLOT_HI = 23;

/** Byte +0 de la Corona de Lord British — excluida SIEMPRE del reciclado
 *  (`ULTIMA.EXE:0x388f cmp al,0xb5 / je` — dentro del escáner ⇒ rige en las 10). */
export const CROWN_TILE_BYTE = 0xb5;

/** Sentinel de slot libre en la tabla VIVA: tile (+0) == 0. */
export const SLOT_TILE_FREE = 0;

/**
 * Vista de UNA ranura del pool compuesto. `tile0` es el byte +0 del registro del
 * binario (= tile del port & 0xff: las tres particiones guardan el tile en bancos
 * distintos — enemigos/naves en el alto 0x1xx, botín/trama en crudo — y el byte de
 * tabla es siempre el bajo). `floor` = byte +4.
 */
export interface PoolSlotView {
  tile0: number;
  x: number;
  y: number;
  floor: number;
  owner: PoolOwner | null;
}

/** Quién aporta la ranura en el modelo del port (las particiones de la ficha #103).
 *  Lleva la REFERENCIA al registro dueño: el desalojo y el desarme mutan/retiran ese
 *  mismo objeto en su lista de origen (identidad, no índice sobre lista filtrada). */
export type PoolOwner =
  | { kind: "enemy"; ref: PoolEnemyLike }
  | { kind: "object"; ref: PoolObjectLike };

/** Ranura vacía de la vista (tile0 0 = libre). */
function freeView(): PoolSlotView {
  return { tile0: SLOT_TILE_FREE, x: 0, y: 0, floor: 0, owner: null };
}

/**
 * `find_free_actor_slot` (SJOG.OVL:0x0000): primer slot LIBRE barriendo 31→1.
 * Jamás el slot 0 (= vehículo activo). Devuelve 0 = sin hueco (el llamador aborta
 * la colocación, p.ej. loot_place). Forma sobre conjunto de ocupación; el adaptador
 * histórico sobre array de tiles vive en `worldObjects.ts::findFreeObjectSlot`.
 */
export function findFreeActorSlot(occupied: ReadonlySet<number>): number {
  for (let s = POOL_SLOT_COUNT - 1; s >= 1; s--) {
    if (!occupied.has(s)) return s;
  }
  return 0;
}

/**
 * Primer hueco ASCENDENTE en la región de reciclado 1..23 — la llamada nº 1 de la
 * cascada (`0x38ef call 0x3868` con lo=hi=0: sólo tile==0 casa). Es el criterio con
 * el que el spawn y el backfill de slots de errantes eligen ranura.
 */
export function firstFreeRecycleSlot(occupied: ReadonlySet<number>): number {
  for (let s = RECYCLE_SLOT_LO; s <= RECYCLE_SLOT_HI; s++) {
    if (!occupied.has(s)) return s;
  }
  return 0;
}

/**
 * Escáner de reciclado — ULTIMA.EXE:0x3868, calco de flujo:
 *  - slots 1..23 ascendente (`0x3870`/`0x38cf`);
 *  - acepta tile0 ∈ [lo, hi] (`0x3885 cmp ax,[bp+8] / jb` · `0x388a cmp ax,[bp+6] / ja`);
 *  - la Corona 0xB5 NUNCA (`0x388f`);
 *  - `offscreenOnly` (arg `cerca` [bp+4]): sólo ranuras FUERA de la ventana 11×11 —
 *    acepta si `(x−partyX+5) & 0xff > 0x0a` (`0x389b-0x38b2`, aritmética de BYTE sin
 *    signo: party en (5,5) de la ventana) o lo mismo en Y (`0x38a7-0x38b7`).
 * Devuelve el índice de slot, o 0 sin acierto (el 0 es también el slot del vehículo:
 * el centinela ambiguo de la ficha #50 — aquí siempre significa «no hay»).
 */
export function scanRecyclableSlot(
  view: readonly PoolSlotView[],
  lo: number,
  hi: number,
  offscreenOnly: boolean,
  partyX: number,
  partyY: number,
): number {
  for (let s = RECYCLE_SLOT_LO; s <= RECYCLE_SLOT_HI; s++) {
    const v = view[s] ?? freeView();
    const t = v.tile0 & 0xff;
    if (t < lo || t > hi) continue; // 0x3885/0x388a
    if (t === CROWN_TILE_BYTE) continue; // 0x388f
    if (offscreenOnly) {
      const dx = (v.x - partyX + 5) & 0xff; // 0x389b-0x38a1
      const dy = (v.y - partyY + 5) & 0xff; // 0x38a7-0x38ad
      if (dx <= 0x0a && dy <= 0x0a) continue; // 0x38b0/0x38b4: dentro de la ventana
    }
    return s;
  }
  return 0;
}

/**
 * Las DIEZ llamadas de `acquire_actor_slot` (ULTIMA.EXE:0x38E4), por orden y con su
 * call-site. Args del binario en orden de push: (lo, hi, cerca).
 */
export const ACQUIRE_CASCADE: ReadonlyArray<{
  lo: number;
  hi: number;
  offscreenOnly: boolean;
}> = [
  { lo: 0x00, hi: 0x00, offscreenOnly: false }, // 0x38ef — ranura LIBRE
  { lo: 0x01, hi: 0x0f, offscreenOnly: true }, // 0x3905 — objetos sueltos, fuera de pantalla
  { lo: 0x80, hi: 0xff, offscreenOnly: true }, // 0x391d — monstruos/artefactos, fuera
  { lo: 0x10, hi: 0x11, offscreenOnly: true }, // 0x3935 — caballos sin jinete, fuera
  { lo: 0x30, hi: 0x7f, offscreenOnly: true }, // 0x394d — personas, fuera
  { lo: 0x01, hi: 0x0f, offscreenOnly: false }, // 0x3964 — objetos sueltos, también en pantalla
  { lo: 0x80, hi: 0xff, offscreenOnly: false }, // 0x397b — monstruos/artefactos
  { lo: 0x10, hi: 0x11, offscreenOnly: false }, // 0x3992 — caballos
  { lo: 0x30, hi: 0x7f, offscreenOnly: false }, // 0x39a9 — personas
  { lo: 0x00, hi: 0xff, offscreenOnly: false }, // 0x39bf — CUALQUIERA (salvo la Corona)
];

/**
 * `acquire_actor_slot` (ULTIMA.EXE:0x38E4): recorre la cascada y devuelve el primer
 * slot no nulo, o 0 si ni la décima encuentra (sólo posible con las 23 ranuras
 * ocupadas por Coronas — en la práctica, tabla llena de 0xB5). El llamador DESALOJA
 * lo que hubiera en la ranura devuelta (las bandas 2..10 devuelven ranuras ocupadas).
 */
export function acquireActorSlot(
  view: readonly PoolSlotView[],
  partyX: number,
  partyY: number,
): number {
  for (const call of ACQUIRE_CASCADE) {
    const s = scanRecyclableSlot(view, call.lo, call.hi, call.offscreenOnly, partyX, partyY);
    if (s !== 0) return s;
  }
  return 0;
}

/** Shape mínimo que la vista necesita de un errante (subset de `OverworldEnemy`). */
export interface PoolEnemyLike {
  slot?: number;
  tile: number;
  x: number;
  y: number;
}

/** Shape mínimo que la vista necesita de un objeto del mundo (subset de `WorldObject`). */
export interface PoolObjectLike {
  slot?: number;
  tile: number;
  x: number;
  y: number;
  floor: number;
  location: number;
}

/**
 * LA VISTA COMPUESTA — la tabla 32×8 del entorno vivo, reconstruida desde las
 * particiones del port. Es el equivalente en lectura del compositor del save
 * (`saveNative.ts::writeNativeWorldObjects`/`writeEnemyTable`): cada aportante pone
 * lo suyo y las ranuras se resuelven por su índice NATIVO.
 *
 * Asignación de ranura a los miembros que aún no la tienen (y se PERSISTE en el
 * propio registro, para que vista, save y desalojo hablen de la misma ranura):
 *  - errantes: primer hueco ascendente 1..23 (cascada llamada 1, mismo criterio que
 *    el backfill del tick y `writeEnemyTable`);
 *  - objetos: barrido 31→1 de `find_free_actor_slot` (SJOG 0x0000), el mismo que usa
 *    su colocador en el binario (compra de nave, loot_place).
 *
 * `location`/`floor` acotan el ENTORNO: la tabla del binario sólo contiene el mapa
 * activo (se rehidrata al entrar, `objects.md` O6). Los errantes sólo existen en el
 * sobremundo (location 0) y aportan con el floor pasado.
 *
 * Partición 3 (NPCs de pueblo): NO aporta todavía — su ranura de pool la asigna
 * `npc_place` (TOWN.OVL:0x1785) vía la cascada al entrar al pueblo, y el port no
 * modela ese orden de colocación (el `slot` de `NpcRuntime` es el índice del .NPC,
 * que NO es la ranura del pool). Derivarlo es el residuo declarado del acta §6.
 */
export function composeWorldPool(opts: {
  location: number;
  floor: number;
  enemies?: PoolEnemyLike[];
  objects?: PoolObjectLike[];
  partyX?: number;
  partyY?: number;
}): PoolSlotView[] {
  const view: PoolSlotView[] = Array.from({ length: POOL_SLOT_COUNT }, freeView);
  const used = new Set<number>();
  const enemies = opts.location === 0 ? (opts.enemies ?? []) : [];
  const objects = (opts.objects ?? []).filter((o) => o.location === opts.location);

  // Pasada 1: registrar las ranuras YA asignadas (la ranura es la identidad, #136).
  for (const e of enemies) {
    if (e.slot !== undefined && e.slot >= 1 && e.slot < POOL_SLOT_COUNT) used.add(e.slot);
  }
  for (const o of objects) {
    if (o.slot !== undefined && o.slot >= 1 && o.slot < POOL_SLOT_COUNT) used.add(o.slot);
  }
  // Pasada 2: asignar (y persistir) ranura a los que no la traen.
  for (const e of enemies) {
    if (e.slot === undefined || e.slot < 1 || e.slot >= POOL_SLOT_COUNT) {
      const s = firstFreeRecycleSlot(used);
      if (s === 0) continue; // pool de errantes lleno: se queda fuera de la tabla
      e.slot = s;
      used.add(s);
    }
  }
  for (const o of objects) {
    if (o.slot === undefined || o.slot < 1 || o.slot >= POOL_SLOT_COUNT) {
      const s = findFreeActorSlot(used);
      if (s === 0) continue; // sin hueco: el binario también aborta la colocación
      o.slot = s;
      used.add(s);
    }
  }
  // Pasada 3: materializar la vista.
  for (const e of enemies) {
    if (e.slot === undefined || e.slot < 1 || e.slot >= POOL_SLOT_COUNT) continue;
    view[e.slot] = {
      tile0: e.tile & 0xff, // byte +0 = tile − 0x100 (los errantes viven en el banco alto)
      x: e.x,
      y: e.y,
      floor: opts.floor,
      owner: { kind: "enemy", ref: e },
    };
  }
  for (const o of objects) {
    if (o.slot === undefined || o.slot < 1 || o.slot >= POOL_SLOT_COUNT) continue;
    view[o.slot] = {
      tile0: o.tile & 0xff, // byte bajo: cubre banco alto (naves 0x124) y crudo (botín 1..15)
      x: o.x,
      y: o.y,
      floor: o.floor,
      owner: { kind: "object", ref: o },
    };
  }
  return view;
}

/**
 * Barrido de la tabla de objetos de An Sanct — CAST.OVL:0x03de-0x0432, calco de flujo:
 * recorre las 32 ranuras DESDE LA 0 (`0x3e3 mov di,0x5c5a` · `0x42c cmp [bp-8],0x20`)
 * buscando `+0 == 1` (cofre, `0x3e8 cmp byte [si],1`) en la celda apuntada
 * (`0x3f2`/`0x3fb` vs `g_cmb_scratch_x/y`); el check de planta `+4 == g_floor`
 * (`0x40b`) se SALTA en combate (`0x401 cmp [g_location],0x7f / ja 0x410`). El acierto
 * es `and [si+5],0x7f` (`0x410`): desarma la trampa del cofre — INCONDICIONAL, con o
 * sin bit puesto — y res 1 ⇒ "Success!". Devuelve el slot, o −1 sin acierto (res 0 ⇒
 * "Failed!"). El desalojo del bit lo aplica el LLAMADOR sobre el dueño de la ranura.
 */
export function anSanctObjectSweep(
  view: readonly PoolSlotView[],
  targetX: number,
  targetY: number,
  checkFloor: boolean,
  floor: number,
): number {
  for (let s = 0; s < POOL_SLOT_COUNT; s++) {
    const v = view[s] ?? freeView();
    if ((v.tile0 & 0xff) !== 1) continue; // 0x3e8: sólo el kind 1 = cofre
    if (v.x !== targetX) continue; // 0x3f2
    if (v.y !== targetY) continue; // 0x3fb
    if (checkFloor && v.floor !== floor) continue; // 0x401/0x40b
    return s;
  }
  return -1;
}
