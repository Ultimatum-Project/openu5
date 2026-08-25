/**
 * #41 — EL COFRE DE LA ARENA LEE EL CENTINELA, NO LA SOMBRA.
 *
 * Al entrar en combate el binario SALVA la localización en una copia sombra y deja el
 * centinela 0xFF en la global que todo el mundo lee:
 *   ULTIMA.EXE `run_combat_encounter` 0x5f86 — `5fa8 mov al,[g_location]` /
 *     `5fab mov [g_unk_5894],al` / `5fb4 mov byte [g_location],0xff` / `6091-6094` restaura.
 *   DUNGEON.OVL `dng_enter_room` 0x0000 — `007e/0081` salva · `00a8` pone 0xFF · `00d5`/`0106`
 *     restauran. (La sala de mazmorra también es combate ⇒ mismo centinela.)
 *
 * `open_chest_world` (SJOG 0x112C) hace TRES lecturas y las TRES son del CENTINELA:
 *   `11e9 cmp byte [g_location],1` · `11f0 cmp byte [g_location],0x20` (gate de karma)
 *   `1225 cmp byte [g_location],0x7f` (cola arena-only 0x122c-0x1296)
 * y el despachador de trampa (kernel 0x2FD0) bifurca en `2fe6 cmp byte [g_location],0x7f`.
 *
 * ⇒ DOS consecuencias, y TIRAN DEL MISMO VALOR EN DIRECCIONES OPUESTAS (por eso van los
 * dos tests: quien «arregle» el karma dejando el pueblo perpetúa BOMB/GAS en la arena, y
 * quien fuerce 0xFF sólo en la trampa deja el karma inventado):
 *   (1) karma: `1 ≤ 0xFF ≤ 0x20` es FALSO ⇒ abrir un cofre de arena en un PUEBLO no resta
 *       karma. El port restaba −2.
 *   (2) trampa: `0xFF > 0x7f` ⇒ `2ff4 rand_range(1,0)` = SÓLO ACID(0)/POISON(1). El port
 *       pasaba la location del pueblo (≤0x20) y tomaba `3001 rand_range(7,0)` +
 *       TRAP_TYPE_TABLE = los cuatro tipos, así que podía sacar BOMB y GAS.
 * 🔴 (2) MUEVE STREAM: BOMB (`0x2aa8`) tira `rand(1,8)` por miembro VIVO y ACID (`0x3abe`)
 * una sola; GAS/POISON cero. El nº de tiradas posteriores difiere ⇒ ventana de sellos.
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
import {
  Combat,
  type CombatMapData,
  type CombatEvent,
  type PartyCombatant,
} from "../src/core/combat/combat.js";
import { chestTrap } from "../src/core/world/commands.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

/** Un pueblo cualquiera dentro de la banda 1..0x20 del gate de karma (0x0f = 15). */
const TOWN_LOCATION = 0x0f;
const TILE_CHEST_TRAP = 0x81; // combat.ts:82 (cofre | bit 0x80 de trampa)

function defs(): EnemyDef[] {
  return buildEnemyDefs(data, additionalFlags);
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}

/** Combate en un PUEBLO (position.location = 0x0f) con un cofre TRAMPEADO plantado. */
function arenaWithTrappedChest(seed: number): { c: Combat; state: GameState; cell: { x: number; y: number } } {
  const state = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  state.position.location = TOWN_LOCATION; // la SOMBRA: el combate empezó en un pueblo
  state.karma = 50;
  const spider = defs().find((e) => e.name === "Giant Spider")!;
  const c = new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: spider, count: 1 }],
    seed,
    state,
    defenseValues: data.defenseValues,
  });
  // El PJ activo abre hacia el ESTE: plantamos el cofre trampeado en su celda vecina.
  const cur = c.currentUnit!;
  expect(cur.kind).toBe("player");
  const cell = { x: cur.x + 1, y: cur.y };
  const priv = c as unknown as { lootLayer: Map<string, number>; chestContents: Map<string, number> };
  priv.lootLayer.set(`${cell.x}:${cell.y}`, TILE_CHEST_TRAP);
  priv.chestContents.set(`${cell.x}:${cell.y}`, 0x80 | 0x20); // bit de trampa + contenido
  return { c, state, cell };
}

function texts(ev: CombatEvent[]): string[] {
  return ev.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);
}

describe("#41 cofre de arena — el gate lee g_location = 0xFF (centinela), no la sombra", () => {
  it("abrir un cofre de arena con el combate en un PUEBLO NO toca el karma (0x11e9/0x11f0 con 0xFF)", () => {
    const { c, state } = arenaWithTrappedChest(12345);
    expect(state.position.location).toBe(TOWN_LOCATION); // la sombra sigue siendo el pueblo
    const karmaAntes = state.karma;
    c.playerOpen("east");
    expect(state.karma).toBe(karmaAntes);
  });

  it("la trampa de un cofre de arena sale SIEMPRE de {ACID, POISON} — nunca BOMB ni GAS (0x2fe6 → 0x2ff4)", () => {
    const vistos = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      const { c } = arenaWithTrappedChest(seed);
      const lineas = texts(c.playerOpen("east"));
      const i = lineas.indexOf("Trapped!");
      expect(i).toBeGreaterThanOrEqual(0); // el cofre plantado LLEVA el bit 0x80
      const tipo = lineas[i + 1]!;
      expect(["ACID!", "POISON!"]).toContain(tipo);
      vistos.add(tipo);
    }
    // Control de que el testigo no es degenerado: si las 8 semillas dieran el MISMO tipo,
    // el aserto pasaría con la rama equivocada devolviendo siempre ese tipo por azar.
    expect(vistos.size).toBe(2);
  });

  it("CONTROL — la rutina compartida sigue dando los CUATRO tipos con una location de pueblo", () => {
    // Discrimina llamador de llamado: `chestTrap` no cambia; lo que cambió es QUÉ location
    // le pasa el cofre de la arena. Con ≤0x20 la tabla completa (0x3001) sigue viva, que es
    // lo que necesitan los DOS callers de fuera de combate (game.ts y dungeon.ts).
    const tipos = new Set<string>();
    for (let r = 0; r <= 7; r++) {
      const miembros = [
        { name: "A", status: "G", currentHp: 40, maxHp: 40 },
        { name: "B", status: "G", currentHp: 40, maxHp: 40 },
      ] as never;
      let primera = true;
      const rand = (lo: number, hi: number): number => {
        if (primera) {
          primera = false;
          expect([lo, hi]).toEqual([0, 7]); // la rama de pueblo ES la tabla completa (0x3001)
          return r;
        }
        return lo;
      };
      tipos.add(chestTrap(TOWN_LOCATION, 0, miembros, rand, 2).type);
    }
    // Los ocho índices de DS:0x559e cubren los CUATRO tipos; BOMB y GAS son justo los dos
    // que la arena NO puede producir.
    expect([...tipos].sort()).toEqual(["ACID", "BOMB", "GAS", "POISON"]);
  });
});
