/**
 * FIDELIDAD «colocación inicial del party» al entrar en combate de campo.
 *
 * DERIVACIÓN (ULTIMA.EXE, verificado en el disasm):
 *  - Cargador de arena `0x60ec`: copia la formación del party desde arena+0x6b (X) / +0x71
 *    (Y) → tablas 0x1724 / 0x172c. El offset es FIJO = FILA 3 del mapa de combate.
 *  - Formato del mapa (docs/formats/maps.md §4 + extractor/parsers/combatmap.ts): filas 1-4
 *    = las 4 direcciones de entrada (1=East, 2=West, **3=South**, 4=North), 6 posiciones cada
 *    una (X en byte 11+p, Y en 17+p). ⇒ arena+0x6b = fila 3 = **SOUTH**.
 *  - Colocador del party `0x6936` (mismo para camp y combate de campo, vía 0x5f86→0x6bc2):
 *    coloca el miembro i en (0x1724[i], 0x172c[i]) = playerStarts["south"][i]. Muertos
 *    ('D') dejan hueco (0x69e1). ⇒ la formación de N miembros = los PRIMEROS N de "south".
 *  - Cross-check camp: camp-scene-kernel.md midió CAMP.mov 3/3 = playerStarts["south"][0..2].
 *
 * TESTIGO del usuario (grabación del original, campo de hierba, 3 miembros): triángulo con
 * líder arriba-centro y dos flanqueando abajo-izq/dcha. Glade (grass) south[0..2] =
 * (5,7),(6,8),(4,8) = EXACTAMENTE ese triángulo. El port usaba "east" (línea diagonal) → BUG.
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
/** N miembros de party (arma melee trivial). */
function partyOfN(state: GameState, n: number): PartyCombatant[] {
  return state.characters
    .slice(0, n)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}

/** Coords de los combatientes-jugador tras entrar, en orden de miembro. */
function playerCells(combat: Combat): Array<{ x: number; y: number }> {
  return combat.combatants
    .filter((c) => c.kind === "player")
    .map((c) => ({ x: c.x, y: c.y }));
}
function placeParty(mapName: string, n: number): Array<{ x: number; y: number }> {
  const state = freshState();
  // Rellena hasta 6 PJs vivos para poder pedir N miembros.
  while (state.characters.length < 6) {
    state.characters.push({ ...state.characters[0]!, name: `M${state.characters.length}` });
  }
  const combat = new Combat({
    map: mapNamed(mapName),
    entryDirection: "south", // FIEL: combate de campo entra por la formación SOUTH (fila 3)
    party: partyOfN(state, n),
    enemies: [{ def: defs()[0]!, count: 1 }],
    seed: 1,
    state,
    defenseValues: data.defenseValues,
  });
  return playerCells(combat);
}

describe("colocación del party = formación SOUTH del arena, por índice de miembro", () => {
  it("3 miembros en Glade (grass) = TRIÁNGULO del testigo: (5,7) líder, (6,8)+(4,8) flancos", () => {
    expect(placeParty("Glade", 3)).toEqual([
      { x: 5, y: 7 }, // líder arriba-centro
      { x: 6, y: 8 }, // flanco abajo-derecha
      { x: 4, y: 8 }, // flanco abajo-izquierda
    ]);
  });

  it("la formación DEPENDE DEL Nº de miembros = prefijo de south[] (Glade, 1..6)", () => {
    const south = mapNamed("Glade").playerStarts.south;
    for (let n = 1; n <= 6; n++) {
      expect(placeParty("Glade", n)).toEqual(south.slice(0, n));
    }
  });

  it("otra arena (CampFire) también coloca por south[] (surround de la hoguera)", () => {
    // south[0..2] de CampFire = (6,6),(4,4),(6,4) — el mismo juego que midió camp-scene 3/3.
    expect(placeParty("CampFire", 3)).toEqual([
      { x: 6, y: 6 },
      { x: 4, y: 4 },
      { x: 6, y: 4 },
    ]);
  });
});
