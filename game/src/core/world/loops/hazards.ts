/**
 * Peligros del bucle exterior (MAINOUT.OVL, Task 3.13): hazard de underworld,
 * emboscada de trolls del puente + peaje, y reubicación por remolino.
 *
 * Port bit a bit verificado contra re/disasm/MAINOUT.OVL.asm:
 *   underworld_hazard   0x0A60
 *   bridge_troll_ambush 0x1BE8
 *   troll_toll          0x1B3E
 *   whirlpool (monster_hits_special_tile) 0x1248 (coords del mapa-scout)
 */
import type { GameState } from "../../state.js";
import { partyRandomDamage, type RandFn } from "../survival.js";

/**
 * Mensaje del TERREMOTO — DS 0x2b1d (`data.json` stringPools[7].strings[227]),
 * impreso en MAINOUT 0x0a7a JUSTO antes de la sacudida (0x0a7d `call 0xffffaea2`)
 * y del daño (0x0a80). Byte-exacto. La presentación (mensaje + sacudida) la emite
 * el caller (game.ts) cuando `underworldHazard` dispara; el daño ya lo aplica esta
 * función. re/notes/quake-harpsichord.md §4b. task #31.
 */
export const EARTHQUAKE_MESSAGE = "EARTHQUAKE!\n";

/**
 * `underworld_hazard` — MAINOUT 0x0A60. En el underworld (floor≠0) consume
 * SIEMPRE 1×rand(0,255); si sale EXACTAMENTE 0x69 (1/256) aplica daño aleatorio
 * a la party (party_random_damage, rand(1,8)/miembro). NO hay chequeo de tile:
 * el 0x69 del mapa-scout era el VALOR de la rand, no el tile.
 *
 * Devuelve true si disparó el daño (0x69). En floor 0 (overworld) no hace nada y
 * NO consume RNG (el `cmp g_floor,0; je` corta antes de la rand). El caller
 * presenta el TERREMOTO (mensaje `EARTHQUAKE_MESSAGE` + sacudida 0x0a7d) cuando
 * devuelve true — presentación PURA, sin RNG (el daño y su tirada ya ocurrieron
 * aquí). El original imprime el mensaje ANTES del daño; el orden observable de
 * texto no cambia porque la línea de daño no imprime nada. task #31.
 */
export function underworldHazard(state: GameState, rand: RandFn): boolean {
  if (state.position.floor === 0) return false;
  const roll = rand(0, 255); // 0x0A6E
  if (roll !== 0x69) return false;
  partyRandomDamage(state, rand); // 0x0A80 party_random_damage
  return true;
}

/** Peaje del troll — MAINOUT 0x1B3E: toll = 0x63 − 3·STR = **99** − 3·STR. */
export function trollToll(strength: number): number {
  return 0x63 - 3 * strength;
}

export interface TrollAmbushResult {
  /** ¿Disparó el gate rand(0,7)==0 (1/8)? */
  fired: boolean;
  /** ¿La party iba a pie? (sólo a pie hay emboscada). */
  onFoot: boolean;
  /**
   * El original corre un world_turn (0x5910: viento + monstruos) al disparar,
   * ANTES de las tiradas de DEX. El caller debe ejecutarlo cuando esto es true.
   */
  runsInnerWorldTurn: boolean;
  /** rand(1,30) tirada por cada miembro no-D/S hasta el primero que falla. */
  dexRolls: number[];
  /**
   * Índices de los miembros que TIRARON (no-'D'/'S'), alineados con dexRolls —
   * incluye al que falla. El caller imprime la línea `<nombre> sneaks across...`
   * de cada uno (MAINOUT 0x1c41-0x1c63; C5, carril cadenas-presentacion).
   */
  rolledIndices: number[];
  /** Índice del miembro que FALLA la tirada de DEX (dispara el peaje), o null. */
  payerIndex: number | null;
  /**
   * Peaje a cobrar (99 − 3·STR). El STR es el del PRIMER MIEMBRO CONSCIENTE
   * ('G'/'P'), NO el del que falla la tirada (troll_toll 0x1B4B →
   * party_conscious_state 0x39FC → g_cmb_scratch_x). RNG idéntico, importe distinto.
   */
  toll: number;
}

/** Índice del primer miembro consciente ('G'/'P') — party_conscious_state 0x39FC. */
function firstConsciousIndex(state: GameState): number {
  for (let i = 0; i < state.partySize && i < 6; i++) {
    const s = state.characters[i]?.status;
    if (s === "G" || s === "P") return i;
  }
  return -1;
}

/**
 * `bridge_troll_ambush` — MAINOUT 0x1BE8. Al pisar un puente (tile 0x6A/0x6B):
 *   rand(0,7); si !=0 → no pasa nada (1/8 de emboscada).            [0x1BF7]
 *   si transport != a pie (0x1C) → no pasa nada.                     [0x1C01]
 *   world_turn KERNEL 0x5910 (tick de viento/anim, NO el 0x1A60).    [0x1C0B]
 *   por cada miembro no-'D'/'S': rand(1,30); si DEX >= roll → pasa;  [0x1C76]
 *     si DEX < roll → paga el peaje (troll_toll) y BREAK.            [0x1C84]
 *
 * Modela SOLO el consumo de RNG y el resultado; el caller aplica el tick de
 * viento interno, el cobro de oro (99−3·STR del primer consciente) y el spawn
 * del troll que huye.
 */
export function bridgeTrollAmbush(
  state: GameState,
  rand: RandFn,
  innerWorldTurn?: () => void,
): TrollAmbushResult {
  const empty: TrollAmbushResult = {
    fired: false,
    onFoot: false,
    runsInnerWorldTurn: false,
    dexRolls: [],
    rolledIndices: [],
    payerIndex: null,
    toll: 0,
  };
  if (rand(0, 7) !== 0) return empty; // 0x1BF7 gate 1/8
  // Sólo a pie (g_transport_tile == 0x1C). transport "foot" en el clon.
  if (state.transport !== "foot") return { ...empty, fired: true, onFoot: false };

  // 0x1C0B: tick de viento KERNEL 0x5910 ENTRE el gate y las tiradas de DEX.
  // El caller inyecta el tick (maybeChangeWind) para respetar el orden del stream.
  innerWorldTurn?.();

  // El importe usa el STR del PRIMER MIEMBRO CONSCIENTE, no el del que falla.
  const strMember = state.characters[firstConsciousIndex(state)];
  const dexRolls: number[] = [];
  const rolledIndices: number[] = [];
  let payerIndex: number | null = null;
  let toll = 0;
  for (let i = 0; i < state.partySize && i < 6; i++) {
    const ch = state.characters[i];
    if (!ch) continue;
    if (ch.status === "D" || ch.status === "S") continue; // 0x1C37/0x1C3C
    const roll = rand(1, 30); // 0x1C76
    dexRolls.push(roll);
    rolledIndices.push(i);
    if (ch.dexterity < roll) {
      // 0x1C80: cmp DEX, roll; jae pasa → aquí DEX < roll: paga y BREAK.
      payerIndex = i;
      toll = trollToll(strMember?.strength ?? 0);
      break;
    }
  }
  return { fired: true, onFoot: true, runsInnerWorldTurn: true, dexRolls, rolledIndices, payerIndex, toll };
}

/**
 * Veneno de pantano — OUTSUBS.OVL 0x5FC (kernel-survival.md §6). Al terminar un
 * paso sobre tile 4 a pie: por cada miembro no-'D'/'P', si rand(1,30) > DEX el
 * miembro queda envenenado ('P'). Devuelve los índices envenenados este paso.
 * Consume 1×rand(1,30) por cada miembro elegible (no muerto, no ya-envenenado).
 */
export function swampPoison(state: GameState, rand: RandFn): number[] {
  const poisoned: number[] = [];
  for (let i = 0; i < state.partySize && i < 6; i++) {
    const ch = state.characters[i];
    if (!ch) continue;
    if (ch.status === "D" || ch.status === "P") continue;
    if (rand(1, 30) > ch.dexterity) {
      ch.status = "P";
      poisoned.push(i);
    }
  }
  return poisoned;
}

/**
 * Veneno de pantano DE PUEBLO — TOWN post_turn 0x108D. OJO: rango DISTINTO del
 * exterior — `rand(0,29) > DEX` (no `rand(1,30)`). Por eso es una función aparte
 * de `swampPoison`: **F.2 no debe reutilizar swampPoison para el pueblo** (span 30
 * empezando en 0, no en 1). Por cada miembro no-'D'/'P'.
 */
export function townSwampPoison(state: GameState, rand: RandFn): number[] {
  const poisoned: number[] = [];
  for (let i = 0; i < state.partySize && i < 6; i++) {
    const ch = state.characters[i];
    if (!ch) continue;
    if (ch.status === "D" || ch.status === "P") continue; // 0x1078/0x107F
    if (rand(0, 29) > ch.dexterity) {
      // 0x108D rand(0,0x1d); 0x1096 cmp DEX,roll; jae pasa → DEX<roll: 'P'.
      ch.status = "P";
      poisoned.push(i);
    }
  }
  return poisoned;
}

/** Coordenadas de reubicación al underworld por remolino (whirlpool, 0x1248). */
export const WHIRLPOOL_UNDERWORLD = { floor: 0xff, x: 0x22, y: 0x12 } as const;

/**
 * Mensaje del REMOLINO — DS 0x6b04 (`data.json` stringPool 15 "textWorldCombatDungeon",
 * idx 25 "\nWHIRLPOOL!\n"), impreso en MAINOUT 0x127f (`mov ax,0x6b04; call 0x9680`)
 * JUSTO antes de la animación de succión (0x12a6) y la reubicación (0x12b2). Byte-exacto.
 */
export const WHIRLPOOL_MESSAGE = "\nWHIRLPOOL!\n";

/**
 * `monster_hits_special_tile` (whirlpool) — MAINOUT 0x1248: cuando un remolino (0xEC)
 * alcanza a la party, SUCCIONA el transporte al underworld en (0x22,0x12) — NO es
 * combate. Preserva el transporte (0x1289 guarda / 0x12ac restaura g_transport_tile →
 * la nave viaja con la party). Sin RNG de destino.
 *
 * ⚠ El gate 0x1260 NO es «transport ≠ pie» a secas: es `cmp [g_transport_tile],0x1c`
 * EXACTO, y con t==0x1C la vía entera se sustituye por `call damage_ship` (0x1267,
 * no-op sin rand fuera de fragata por el gate 0x10A4) + salida (0x126A jmp 0x1313):
 * sin borrado de actor, sin "WHIRLPOOL!", sin teleport. Ese gate vive en el CALLER
 * (game.ts outdoorWorldTurn), careado y medido en vivo por #343
 * (re/notes/testigo-remolino-343.md §2). Esta función es sólo la reubicación.
 */
export function whirlpoolRelocate(state: GameState): void {
  state.position.floor = WHIRLPOOL_UNDERWORLD.floor;
  state.position.x = WHIRLPOOL_UNDERWORLD.x;
  state.position.y = WHIRLPOOL_UNDERWORLD.y;
}
