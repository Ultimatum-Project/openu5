/**
 * #356 — FIDELIDAD «quién entra al combate» + la red del barrido de turnos.
 *
 * DERIVACIÓN (verificada en el disasm, 2026-08-16):
 *  - Colocador del party kernel `0x6936` (llamado por combat_spawn_encounter `0x6bc2`
 *    con !(flags&4)): bucle slot 0..g_party_size−1 (@0x6b71). El predicado de entrada es
 *    el STATUS del roster, no la HP: @0x69e1 `cmp byte [slot*32+0x55b3],0x44` ('D') →
 *    @0x69e8 `jmp 0x6b6e` = `inc slot` SIN spawn (0x6506 no corre). El muerto NO entra:
 *    sin registro 0xBA14, sin objeto 0x5C5A y SIN cadáver — la ficha decía «planta el
 *    cadáver 0x1E del que entra muerto» y está REFUTADA por esta lectura.
 *  - El hueco se conserva: la tabla de posiciones 0x1724/0x172c se indexa por SLOT
 *    (@0x6a4f `bx = [bp-4]`), no por índice compactado.
 *  - El DORMIDO sí entra, dormido: @0x6b59 `cmp byte [slot*32+0x55b3],0x53` ('S') →
 *    @0x6b63 `call 0x68ae` (flag 8 @0x68e1, tile 0x1E @0x68ee). En esa rama NO corre el
 *    status-pass 0x6794 (@0x6b66 salta a 0x6b6e) ⇒ el Ring of Invisibility no marca a
 *    un durmiente al entrar. Su DEX defensiva es 1 en la tirada 0x14D6 (COMBAT:0x139A
 *    @13cb `test [rec+2],8` → @13b2 `mov ax,1`).
 *  - Red del barrido COMBAT:0x0bfa-0x0c1f: PJ ACTIVO (sin flag 0x20) cuyo roster ya dice
 *    'D' (@0x0c03) → `or [si+2],0x20` + `call 0x1574(idx,0x63)` cuya rama de jugador
 *    (@15c5-1604) hace HP=0 (15da), cadáver 0x1E (15f2-15f8) y active=0xFF (15fc-1604).
 *  - Despertar kernel `0x6800`: @0x682b roster 'S'→'G'; @0x6832-0x685a restaura el tile
 *    de render (0x1D si invisible, si no `+1 ← +0` = sprite de clase).
 *
 * MUTANTE que esta suite mata (verificado a mano): volver el predicado de entrada a
 * `currentHp > 0` (o empujar al 'D' como combatiente "dead") pone en rojo los asertos
 * de población y el del hp-0-'G' que SÍ entra.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import { Combat, type CombatMapData, type PartyCombatant } from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function defs(): EnemyDef[] {
  return buildEnemyDefs(data, additionalFlags);
}
function mapNamed(name: string): CombatMapData {
  const m = combatMaps.find((c) => c.name === name);
  if (!m) throw new Error(`arena no encontrada: ${name}`);
  return m;
}
function freshState(): GameState {
  const state = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  while (state.characters.length < 6) {
    state.characters.push({ ...state.characters[0]!, name: `M${state.characters.length}` });
  }
  return state;
}
function partyOfN(state: GameState, n: number): PartyCombatant[] {
  return state.characters
    .slice(0, n)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
function makeCombat(state: GameState, n: number): Combat {
  return new Combat({
    map: mapNamed("Glade"),
    entryDirection: "south", // south[0..2] de Glade = (5,7),(6,8),(4,8) — test de placement
    party: partyOfN(state, n),
    enemies: [{ def: defs()[0]!, count: 1 }],
    seed: 1,
    state,
    defenseValues: data.defenseValues,
  });
}
const players = (c: Combat) => c.combatants.filter((u) => u.kind === "player");

describe("#356: el miembro con roster 'D' NO entra al combate (kernel 0x6936 @0x69e1)", () => {
  it("party de 3 con el slot 1 muerto → DOS combatientes-PJ, hueco en south[1], sin cadáver", () => {
    const state = freshState();
    state.characters[1]!.status = "D";
    state.characters[1]!.currentHp = 0;
    const combat = makeCombat(state, 3);
    const ps = players(combat);
    // Población: el muerto no tiene registro (ni "dead" ni nada).
    expect(ps.length).toBe(2);
    expect(ps.map((u) => u.charIdx)).toEqual([0, 2]);
    // El hueco de SU posición se conserva: slot 0 → (5,7), slot 2 → (4,8); (6,8) vacío.
    expect(ps.map((u) => ({ x: u.x, y: u.y }))).toEqual([
      { x: 5, y: 7 },
      { x: 4, y: 8 },
    ]);
    // SIN cadáver: 0x1E sólo lo planta 0x1574 al morir EN la arena (esperado EN CRUDO:
    // ningún tile 30 en la capa de restos tras montar la arena).
    expect(combat.lootTiles().filter((l) => l.tile === 0x1e)).toEqual([]);
  });

  it("discriminante status-vs-hp: hp 0 con status 'G' SÍ entra (0x6936 no lee la HP)", () => {
    // Mutante cubierto: con el predicado viejo (`currentHp > 0`) este miembro salía
    // "dead" — el binario sólo mira el byte 0x55b3 ('D').
    const state = freshState();
    state.characters[1]!.status = "G";
    state.characters[1]!.currentHp = 0;
    const combat = makeCombat(state, 3);
    const ps = players(combat);
    expect(ps.length).toBe(3);
    expect(ps[1]!.status).toBe("active");
    expect(ps[1]!.hp).toBe(0);
  });

  it("el vivo con hp bajos entra activo (hp 1, 'G')", () => {
    const state = freshState();
    state.characters[1]!.currentHp = 1;
    const combat = makeCombat(state, 3);
    expect(players(combat).length).toBe(3);
    expect(players(combat)[1]!.status).toBe("active");
  });
});

describe("#356: el miembro con roster 'S' entra DORMIDO (0x6936 @0x6b59 → 0x68ae)", () => {
  it("sleeping=true + tile de render 0x1E; dex defensiva 1 vía flag 8 (0x139A)", () => {
    const state = freshState();
    state.characters[1]!.status = "S";
    const combat = makeCombat(state, 3);
    const s = players(combat)[1]!;
    expect(s.sleeping).toBe(true);
    expect(s.renderTile).toBe(0x1e); // 0x68ee `mov byte [bx+0x5c5b],0x1e`
    expect(s.status).toBe("active"); // dormido ≠ muerto: sigue en la arena
  });

  it("durmiente con Ring of Invisibility: NO se marca invisible (la rama 'S' salta 0x6794)", () => {
    const state = freshState();
    state.characters[1]!.status = "S";
    state.characters[1]!.ring = 0x2a; // Ring of Invisibility (RING_INVIS)
    const combat = makeCombat(state, 3);
    const s = players(combat)[1]!;
    expect(s.invisible).toBe(false); // @0x6b66 `jmp 0x6b6e`: el pase 0x6794 no corre
    expect(s.renderTile).toBe(0x1e); // gana el tile del sueño, no la silueta 0x1D
    // Control positivo del pase: el mismo anillo DESPIERTO sí marca (rama else @0x6b68).
    const state2 = freshState();
    state2.characters[1]!.ring = 0x2a;
    const combat2 = makeCombat(state2, 3);
    expect(players(combat2)[1]!.invisible).toBe(true);
    expect(players(combat2)[1]!.renderTile).toBe(0x1d);
  });

  it("si el durmiente era el miembro ACTIVO, active_char pasa a 0xFF (0x68ae @0x68f3)", () => {
    const state = freshState();
    state.characters[1]!.status = "S";
    state.activeCharacter = 1;
    makeCombat(state, 3);
    expect(state.activeCharacter).toBe(0xff);
  });

  it("al despertar: roster 'S'→'G' (0x6800 @0x682b) y el tile 0x1E se restaura (@0x6848)", () => {
    const state = freshState();
    state.characters[1]!.status = "S";
    state.characters[1]!.currentHp = 99;
    state.characters[1]!.maxHp = 99;
    const combat = makeCombat(state, 3);
    const s = players(combat)[1]!;
    // Conduce turnos (RNG determinista, seed 1) hasta que el durmiente despierte
    // (1/16 por turno propio, playerSleepTurn) o muera — cota dura de 400 ticks.
    let ticks = 0;
    while (s.sleeping && s.status === "active" && !combat.over && ticks < 400) {
      ticks++;
      const cur = combat.currentUnit;
      if (!cur) break;
      if (cur.kind === "enemy") combat.tickEnemyTurns();
      else combat.playerPass();
    }
    expect(s.status).toBe("active"); // sobrevivió (hp 99 vs un enemigo débil)
    expect(s.sleeping).toBe(false);
    expect(state.characters[1]!.status).toBe("G");
    expect(s.renderTile).toBeUndefined(); // restaurado: vuelve su sprite de clase
  });
});

describe("#356: red del barrido (COMBAT:0x0bfa-0x0c1f) — roster 'D' con combatiente activo", () => {
  it("mutar el roster a 'D' bajo el combate → muerto + cadáver 0x1E en SU celda", () => {
    const state = freshState();
    const combat = makeCombat(state, 3);
    const victim = players(combat)[1]!;
    const cell = { x: victim.x, y: victim.y }; // (6,8) = south[1] de Glade
    // Mutación directa del roster, como la trampa de un cofre de arena (damageMember
    // @2a52 pone 'D' a hp 0 sin tocar el registro de combate).
    state.characters[1]!.status = "D";
    state.characters[1]!.currentHp = 0;
    void combat.currentUnit; // un paso del barrido: la red pasa por su slot (0x0c03)
    expect(victim.status).toBe("dead");
    expect(victim.hp).toBe(0);
    // Esperado EN CRUDO: cadáver tile 30 en (6,8).
    expect(combat.lootTiles()).toContainEqual({ x: cell.x, y: cell.y, tile: 0x1e });
  });

  it("si el rematado era el miembro ACTIVO → active_char = 0xFF (0x1574 @15fc-1604)", () => {
    const state = freshState();
    const combat = makeCombat(state, 3);
    state.activeCharacter = 1;
    state.characters[1]!.status = "D";
    state.characters[1]!.currentHp = 0;
    void combat.currentUnit;
    expect(state.activeCharacter).toBe(0xff);
  });
});
