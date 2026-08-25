/**
 * Spawn de monstruos del world-turn exterior (MAINOUT.OVL, Task 3.13).
 *
 * Port bit a bit de `spawn_threshold` (0x0D8C) y del gate de spawn dentro de
 * `world_turn` (0x1A60 @ 0x1AA7-0x1AB5), verificado contra
 * re/disasm/MAINOUT.OVL.asm y derivado en task-3.13-mainout-map.md §world_turn.
 *
 * REEMPLAZA el modelo inventado "1/16 por turno" (world/enemies.ts) por la
 * regla EXACTA del binario:
 *   roll = rand(1,30)                    ; SIEMPRE la primera rand del world-turn
 *   threshold = spawn_threshold(...)     ; 0..6 por bioma/planta/hora
 *   si threshold > roll → spawn_monster  ; (jle threshold<=roll → NO spawn)
 *
 * Consecuencia exacta (no obvia): en terreno normal de día (threshold=1) NO hay
 * spawn NUNCA (roll≥1 ⇒ threshold>roll imposible); el agua (threshold=0) tampoco.
 * Sólo pantano/montaña (2), underworld (3) o la noche (+3, sólo h<5) spawnean.
 */

/** Tile bajo el jugador clasificado como "agua" para el spawn (asm: [0x20,0x26]). */
const SPAWN_WATER_LO = 0x20;
const SPAWN_WATER_HI = 0x26;

/**
 * `spawn_threshold` — MAINOUT 0x0D8C. Umbral de spawn del world-turn.
 *
 * Asm exacto:
 *   floor > 0x7F (underworld)          → 3   (0x0D92, y salta el resto)
 *   tile ∈ [0x20,0x26] (agua/océano)   → base 0
 *   tile == 4 (pantano) ó tile ∈ [9,0xF] (montañas/colinas) → base 2
 *   else                                → base 1
 *   si hour >= 0x20 (muerto) ó hour < 5 → base += 3   (bonus nocturno)
 *
 * El `cmp g_hour,0x20; jae` es rama muerta (hour∈0..23), pero se conserva
 * literal: el bonus nocturno cae SOLO en 00:00-04:59 (el atardecer 20:00-23:59
 * NO lo recibe — quirk del binario).
 */
export function spawnThreshold(tile: number, floor: number, hour: number): number {
  // #171 — auditado y SE QUEDA LITERAL: INALCANZABLE con floor = −1. Cadena de llamadas
  // completa: `Game.runContextTurn` (que envuelve el bloque en `if (loc === 0)`),
  // `Game.runNavalTurn` y `Game.resolveTrollToll` → `outdoorWorldTurn` → `rollSpawnGate`
  // → aquí. Los tres son overworld, y con location 0 los únicos pisos son 0 (Britannia)
  // y 0xFF (Underworld): los sótanos z = −1 sólo existen en small maps (location ≥ 1).
  if (floor > 0x7f) return 3;
  let base: number;
  if (tile >= SPAWN_WATER_LO && tile <= SPAWN_WATER_HI) {
    base = 0;
  } else if (tile === 4 || (tile >= 9 && tile <= 0x0f)) {
    base = 2;
  } else {
    base = 1;
  }
  if (hour >= 0x20 || hour < 5) base += 3;
  return base;
}

export interface SpawnRoll {
  /** rand(1,30) consumido SIEMPRE (primera rand del world-turn). */
  roll: number;
  /** Umbral del bioma/planta/hora. */
  threshold: number;
  /** ¿Dispara spawn_monster? (threshold > roll). */
  spawn: boolean;
}

/**
 * Gate de spawn del world-turn (MAINOUT 0x1A9F-0x1AB5). Consume SIEMPRE
 * 1×rand(1,30) y devuelve si toca spawnear (threshold > roll). El RNG del
 * spawn_monster en sí (weighted_pick/tile_to_monster/pick_coords) es aparte
 * y sólo rueda cuando `spawn` es true.
 */
export function rollSpawnGate(
  rand: (lo: number, hi: number) => number,
  tile: number,
  floor: number,
  hour: number,
): SpawnRoll {
  const roll = rand(1, 30); // push 1; push 0x1e; call rand_range (0x1AA7)
  const threshold = spawnThreshold(tile, floor, hour);
  return { roll, threshold, spawn: threshold > roll };
}

/** Guarda de ingeniería del bucle de `pickSpawnCoords`. El binario NO tiene tope
 *  (0x0F4E es bucle infinito hasta que la distancia cuaja); con p(aceptar)≈0.35
 *  por intento, agotar 1000 intentos es astronómicamente improbable — es sólo un
 *  seguro contra un rand degenerado, NO una regla del binario. */
const PICK_COORDS_GUARD = 1000;

/**
 * `pick_spawn_coords` — bloque de coordenadas de `spawn_monster` (MAINOUT 0x0F4E,
 * llamado 1× por spawn_monster @0x0FD1). Tira 2×rand(0,31) por intento (dx,dy) y
 * RE-ROLLEA SÓLO POR DISTANCIA a la party: si la casilla queda a ≤6 casillas en
 * CUALQUIER eje (con wrap), vuelve a tirar. NO comprueba pasabilidad en el bucle
 * (0x0FC2 `ret` sin más) — la pasabilidad la decide DESPUÉS `spawn_monster` (lee
 * el tile, elige monstruo; si no cuaja, no spawnea). Devuelve la casilla elegida.
 *
 * Asm (re/disasm/MAINOUT.OVL.asm:1547-1596):
 *   x = rand(0,31)+chunk_origin_x; y = rand(0,31)+chunk_origin_y
 *   |x−party_x| <= 6 → re-roll (0x0F84)   ; ABS por cdq/xor/sub
 *   |y−party_y| <= 6 → re-roll (0x0F9A)
 *   |x−party_x| >= 250 (256−6) → re-roll (0x0FAA)   ; guarda de wrap
 *   |y−party_y| >= 250 → re-roll (0x0FC0)
 *
 * ★ ANCLADO AL `chunk_origin` REAL (ficha #31). Aquí hubo una aproximación DECLARADA
 * —«party ≈ chunk_origin+16», o sea offset `rand(0,31)−16`— que afirmaba además que
 * con ella «la guarda de wrap (≥250) NUNCA se alcanza». **Las dos mitades de esa
 * afirmación resultaron falsas al medirlas**, y por eso ya no está:
 *   · La histéresis de `chunk-origin.ts` mantiene al grupo en k ∈ [5,26] (no en 16);
 *     el conjunto de `rand` aceptados coincide con el del binario SÓLO en k=16, o sea
 *     1 de 22 posiciones.
 *   · MEDIDO sobre el corpus de sellos con la sonda `U5_SPAWN_K`: **42 de 46 muestras
 *     (91%) tienen k≠16**, con k repartido por todo 8..23. La premisa era falsa EN EL
 *     CORPUS, no sólo en teoría.
 * Con el ancla real las dos mitades del filtro vuelven a ser alcanzables, que es lo
 * que el binario hace: la aritmética es de BYTE y la condición es una sola —distancia
 * ≥7 en el toro— escrita como `<=6` (directa) ∨ `>=0xFA` (envolvimiento).
 */
export function pickSpawnCoords(
  rand: (lo: number, hi: number) => number,
  px: number,
  py: number,
  width: number,
  height: number,
  origin: { x: number; y: number },
  maxTries = PICK_COORDS_GUARD,
): { x: number; y: number } | null {
  for (let i = 0; i < maxTries; i++) {
    // 0x0F5E/0x0F72: la coordenada se COMPONE con el origen del chunk y se guarda en
    // 8 BITS (`add al,…` + `sub ah,ah`), o sea que ENVUELVE en 256.
    const x = (rand(0, 31) + origin.x) & 0xff;
    const y = (rand(0, 31) + origin.y) & 0xff;
    // Diferencia de BYTE contra el grupo — es la magnitud que el asm compara.
    const dx = (x - px) & 0xff;
    const dy = (y - py) & 0xff;
    // LAS DOS MITADES DE LA MISMA CONDICIÓN, no dos reglas: `<=6` es la cercanía
    // directa (0x0F84/0x0F9A) y `>=0xFA` es esa misma cercanía POR EL OTRO LADO del
    // envolvimiento (0x0FAA/0x0FC0) — juntas dicen «distancia >= 7 en el toro».
    if (dx <= 6 || dx >= 0xfa) continue;
    if (dy <= 6 || dy >= 0xfa) continue;
    return { x: x % width, y: y % height };
  }
  return null;
}
