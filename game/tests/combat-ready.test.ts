/**
 * (R)eady EN COMBATE — COMBAT.OVL 0x09a2 → combat_cmd 0x544 code 3 → picker de equipo
 * ZSTATS 0x0f2e/0x0c5c. Aquí se testean las dos mecánicas NUEVAS del núcleo de combate:
 *   · `playerReady()` CONSUME el turno del combatiente activo, silencioso (sin "Pass"):
 *     el path de 'R' deja `[bp-4]=1` intacto (0x083e→0x0974). Debe avanzar el turno
 *     EXACTAMENTE como `playerPass()`, sólo que sin el eco "Pass".
 *   · `syncPlayerEquip()` refresca arma/alcance/defensa del combatiente tras un cambio
 *     de equipo (el binario refresca el arma del actor al equipar, 0x0d05/0x0f19).
 * El bloqueo de armadura (ids 9-15 tipo 0x40) se testea a nivel de `equipItem` en
 * equip.test.ts ("bloqueo de armadura en combate de mazmorra").
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  createNewGame,
  type ExtractedInitialState,
  type GameState,
} from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  type CombatMapData,
  type PartyCombatant,
} from "../src/core/combat/combat.js";

const EQUIPMENT_NOTHING = 0xff;

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function byName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}
function freshState(): GameState {
  const s = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  for (const c of s.characters) {
    c.currentHp = 999;
    c.maxHp = 999;
  }
  return s;
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
function makeCombat(state: GameState): Combat {
  return new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: byName("Giant Spider"), count: 1 }],
    seed: 777,
    state,
    defenseValues: data.defenseValues,
  });
}
/** Avanza los turnos de enemigo hasta que el activo sea un PJ (o se acabe). */
function advanceToPlayer(combat: Combat, guard = 60): void {
  let g = 0;
  while (!combat.over && g++ < guard) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind === "player") return;
    combat.tickEnemyTurns();
  }
}

describe("playerReady() — consume el turno como Pass pero SIN eco 'Pass'", () => {
  it("avanza el turno idéntico a playerPass (mismo seed) y no emite 'Pass'", () => {
    // Dos combates gemelos deterministas (mismo seed 777, mismo estado inicial).
    const cReady = makeCombat(freshState());
    const cPass = makeCombat(freshState());
    advanceToPlayer(cReady);
    advanceToPlayer(cPass);
    expect(cReady.currentUnit?.kind).toBe("player");
    expect(cPass.currentUnit?.kind).toBe("player");
    // El mismo combatiente actúa en ambos (lockstep).
    expect(cReady.currentUnit?.id).toBe(cPass.currentUnit?.id);

    const evReady = cReady.playerReady();
    const evPass = cPass.playerPass();

    // Mismo AVANCE de turno: el siguiente activo coincide.
    expect(cReady.currentUnit?.id).toBe(cPass.currentUnit?.id);
    // playerReady es SILENCIOSO; playerPass ecoa "Pass" (kind "echo": el binario
    // imprime "Pass\n" DS 0x6e60 sobre la fila del prompt ► — "►Pass", n6log_*).
    expect(evReady.some((e) => e.text === "Pass")).toBe(false);
    expect(evPass.some((e) => e.kind === "echo" && e.text === "Pass")).toBe(true);
  });

  it("no hace nada si no es el turno de un PJ (defensivo)", () => {
    const combat = makeCombat(freshState());
    // Fuerza un turno de enemigo si el primer activo lo es; si es PJ, igualmente el
    // contrato es: sólo actúa en turno de PJ.
    if (combat.currentUnit?.kind !== "enemy") {
      // Consume turnos de PJ hasta topar con un enemigo activo.
      let g = 0;
      while (combat.currentUnit?.kind === "player" && g++ < 20) combat.playerPass();
    }
    if (combat.currentUnit?.kind === "enemy") {
      const before = combat.currentUnit?.id;
      const ev = combat.playerReady();
      expect(ev).toEqual([]);
      expect(combat.currentUnit?.id).toBe(before); // no avanzó
    }
  });
});

describe("syncPlayerEquip() — refresca arma/alcance/defensa del combatiente", () => {
  it("fija el arma primaria (id/attack/range) recién equipada", () => {
    const state = freshState();
    const combat = makeCombat(state);
    advanceToPlayer(combat);
    const cur = combat.currentUnit!;
    expect(cur.kind).toBe("player");
    combat.syncPlayerEquip(cur.charIdx!, [{ id: 3, attack: 42, range: 7 }]);
    const after = combat.combatants.find((u) => u.id === cur.id)!;
    expect(after.attack).toBe(42);
    expect(after.attackRange).toBe(7);
    expect(after.weapons?.[0]?.id).toBe(3);
  });

  it("recalcula la defensa desde el record vivo (quitar todo → 0)", () => {
    const state = freshState();
    const combat = makeCombat(state);
    advanceToPlayer(combat);
    const cur = combat.currentUnit!;
    const rec = state.characters[cur.charIdx!]!;
    // Desnuda al PJ en el record y resincroniza: la defensa cae a 0 (playerDefense
    // no suma nada), sea cual sea la tabla defenseValues.
    rec.helmet = EQUIPMENT_NOTHING;
    rec.armor = EQUIPMENT_NOTHING;
    rec.weapon = EQUIPMENT_NOTHING;
    rec.shield = EQUIPMENT_NOTHING;
    rec.ring = EQUIPMENT_NOTHING;
    rec.amulet = EQUIPMENT_NOTHING;
    combat.syncPlayerEquip(cur.charIdx!, [{ id: EQUIPMENT_NOTHING, attack: 1, range: 1 }]);
    const after = combat.combatants.find((u) => u.id === cur.id)!;
    expect(after.defense).toBe(0);
  });

  it("no-op si el charIdx no está en la arena", () => {
    const combat = makeCombat(freshState());
    expect(() => combat.syncPlayerEquip(99, [{ id: 3, attack: 42, range: 7 }])).not.toThrow();
  });
});
