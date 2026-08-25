/**
 * FIDELIDAD «¿cuándo rige "All must use the same exit!"?» — el gate es CONTEXTUAL.
 *
 * DERIVACIÓN (disasm):
 *  - flee_off_edge SJOG 0x1bb2, gate en **0x1c04**: `test [g_unk_58a1], 0x80; je 0x1be5` —
 *    la restricción "All must use the same exit!" (DATA.OVL DS 0x8e88 / fileoff 0x8e98)
 *    SÓLO se comprueba si el bit 0x80 está puesto; si está limpio, el miembro huye LIBRE.
 *  - `g_unk_58a1` = modo de entrada al combate (ULTIMA.EXE 0x5f86 0x5f91 `mov [58a1], mode`).
 *      · CAMPO/overworld: caller 0x633a pasa mode **0** → bit 0x80 CLARO → **bordes libres**.
 *      · SALA de mazmorra: DUNGEON.OVL **0x00bf** `mov [58a1], 0x82` → bit 0x80 PUESTO →
 *        **same-exit** (cada borde lleva a una sala/pasillo distinto; el 1º fija el destino).
 *
 * El port aplicaba la restricción SIEMPRE (sobre-restricción infiel en campo). Fix:
 * `CombatOpts.roomCombat` (espejo del bit 0x80); playerEscape sólo la exige si es sala.
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
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);
const campFire = (): CombatMapData => combatMaps[0]!;
function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
function makeCombat(roomCombat: boolean): Combat {
  const state = freshState();
  return new Combat({
    map: campFire(),
    entryDirection: "south",
    party: party(state),
    enemies: [{ def: defs()[0]!, count: 1 }],
    seed: 1,
    state,
    defenseValues: data.defenseValues,
    roomCombat,
  });
}
/** Fuerza el turno a un PJ concreto (sin enemigos vivos: post-victoria simulada). */
function forceEnemiesGone(combat: Combat): void {
  for (const c of combat.combatants) if (c.kind === "enemy") c.status = "dead";
}
function msgs(ev: { kind: string; text?: string }[]): string[] {
  return ev.filter((e) => e.kind === "message" && e.text).map((e) => e.text!);
}

describe('gating de "All must use the same exit!" por contexto', () => {
  it("CAMPO (roomCombat=false): dos miembros pueden salir por bordes DISTINTOS — sin restricción", () => {
    const combat = makeCombat(false);
    forceEnemiesGone(combat);
    // 1er miembro sale al oeste. RE-BASELINE careo-combate T9: sin enemigos vivos
    // (forceEnemiesGone = post-victoria) el string de salida es "Leave!" (SJOG
    // 0x1b6c cuenta el bando contrario → 0x1bf4 DS 0x8ea6); "Escape!" (0x1c20 DS
    // 0x8eae) es SOLO con enemigos vivos.
    const first = combat.currentUnit!;
    expect(first.kind).toBe("player");
    const a = combat.playerEscape("west");
    expect(msgs(a)).toContain("Leave!");
    // 2º miembro sale al ESTE (borde distinto) → sale igual, NADA de restricción.
    const second = combat.currentUnit;
    if (second?.kind === "player") {
      const b = combat.playerEscape("east");
      expect(msgs(b)).toContain("Leave!");
      expect(msgs(b)).not.toContain("All must use the same exit!");
    }
  });

  it("SALA de mazmorra (roomCombat=true): el 2º miembro por otro borde = 'All must use the same exit!'", () => {
    const combat = makeCombat(true);
    forceEnemiesGone(combat);
    const first = combat.currentUnit!;
    expect(first.kind).toBe("player");
    combat.playerEscape("west"); // 1º fija la salida = oeste
    const second = combat.currentUnit;
    if (second?.kind === "player") {
      const b = combat.playerEscape("east"); // otro borde → BLOQUEADO
      expect(msgs(b)).toContain("All must use the same exit!");
      expect(msgs(b)).not.toContain("Leave!");
      // Pero por la MISMA salida (oeste) sí sale ("Leave!": post-victoria, T9).
      const c = combat.playerEscape("west");
      expect(msgs(c)).toContain("Leave!");
    }
  });
});
