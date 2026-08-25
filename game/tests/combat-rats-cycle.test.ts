/**
 * ARBITRAJE reporte «combate 4 ratas: el recuadro cicla ~50 veces sin acciones»
 * (usuario 2026-07-22, vídeo combate-ratas-ciclo-20260722.mov) — VEREDICTO: FIEL.
 *
 * El save del usuario está EDITADO (party con DEX 99). El planificador de turnos
 * del original recarga el countdown de iniciativa con `0x24 − velocidad` en
 * aritmética de BYTE, sin clamp:
 *   - spawn:    ULTIMA.EXE kernel 0x6506 @65a8-65ad `mov al,0x24 / sub al,[si+1]
 *               / mov [si+5],al` (velocidad del PJ = DEX del roster, @65a3-65a5)
 *   - recarga:  COMBAT.OVL 0x0B94 @0c4b-0c50 (idéntica, byte)
 * Con DEX 99 (0x63): 0x24 − 0x63 = 0xC1 = 193 → el PJ actúa 1 vez por cada
 * ~12 activaciones de una rata (speed 16..23, recarga 13..20). Con 4 ratas eso
 * son ~48 turnos enemigos entre turnos de party — el «recuadro cicla ~50 veces»
 * del usuario, calcado del original (el usuario confirma lo mismo en DOSBox).
 *
 * Y las ratas SÍ atacan estando adyacentes, pero NO PUEDEN acertar: el umbral
 * de acierto es `(DEX_def − vel_atk + 30) >> 1` (COMBAT.OVL @154d-155b) contra
 * `rand30()` ∈ [1,30] (kernel 0x3ABE = max(1, rand(0,60)>>1)); con defensor
 * DEX 99 el umbral ≥ 53 > 30 → fallo garantizado, y el fallo melé de la IA es
 * SILENCIOSO (COMBAT.OVL @035b-035f) → cero líneas en el log. Todo fiel.
 *
 * Estos tests fijan ese comportamiento como CALCO (no como bug) y guardan que
 * la tanda enemiga SIEMPRE cierra y devuelve el turno a la party.
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
  type CombatEvent,
  type PartyCombatant,
} from "../src/core/combat/combat.js";
import { initiativeReset, hitThreshold } from "../src/core/combat/formulas.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>(
  "../src/core/data/AdditionalEnemyFlags.json",
);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function freshState(dex?: number): GameState {
  const state = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  if (dex !== undefined) {
    for (const c of state.characters) c.dexterity = dex;
  }
  return state;
}

function byName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}

function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({
      charIdx: i,
      record,
      weapons: [{ attack: 10, range: 1 }],
    }));
}

function newCombat(state: GameState, seed: number, count = 4): Combat {
  return new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: byName("Giant Rat"), count }],
    seed,
    state,
    defenseValues: data.defenseValues,
  });
}

/** Pasa el turno de TODOS los PJ hasta abrir la fase enemiga. */
function passUntilEnemyPhase(combat: Combat): CombatEvent[] {
  const events: CombatEvent[] = [];
  let guard = 0;
  while (!combat.over && guard++ < 20) {
    const cur = combat.currentUnit;
    if (!cur || cur.kind === "enemy" || cur.charmed) break;
    events.push(...combat.playerPass());
  }
  return events;
}

/** Pacea la tanda enemiga (tickEnemyTurnStep) hasta volver al PJ; devuelve nº de pasos. */
function drainEnemyPhaseStepped(
  combat: Combat,
  cap: number,
): { steps: number; events: CombatEvent[] } {
  const events: CombatEvent[] = [];
  let steps = 0;
  while (!combat.over && steps < cap) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind !== "enemy" && !cur.charmed) break;
    steps++;
    events.push(...combat.tickEnemyTurnStep());
  }
  return { steps, events };
}

describe("tanda enemiga con 4 Giant Rats (party normal): resuelve siempre", () => {
  it("la tanda paceada (tickEnemyTurnStep) cierra y la ronda vuelve a un PJ", () => {
    for (const seed of [0x2b67, 0x1234, 0x0001, 0xbeef]) {
      const combat = newCombat(freshState(), seed);
      passUntilEnemyPhase(combat);
      expect(combat.currentUnit?.kind).toBe("enemy");
      const { steps } = drainEnemyPhaseStepped(combat, 64);
      expect(steps, `seed ${seed.toString(16)}: tanda sin cerrar`).toBeLessThan(64);
    }
  });

  it("combate COMPLETO (party ataca): cada tanda enemiga resuelve hasta el final", () => {
    for (const seed of [0x2b67, 0x1234, 0x0001, 0xbeef, 0x400, 0x7777]) {
      const combat = newCombat(freshState(), seed);
      let rounds = 0;
      while (!combat.over && rounds++ < 400) {
        const cur = combat.currentUnit;
        if (!cur) break;
        if (cur.kind === "player" && !cur.charmed) {
          const foes = combat.combatants.filter(
            (c) => c.kind === "enemy" && c.status === "active",
          );
          const adj = foes.find(
            (f) => Math.max(Math.abs(f.x - cur.x), Math.abs(f.y - cur.y)) <= 1,
          );
          if (adj) combat.playerAttack(adj.x, adj.y);
          else combat.playerPass();
          continue;
        }
        const { steps } = drainEnemyPhaseStepped(combat, 64);
        expect(
          combat.over || steps < 64,
          `seed ${seed.toString(16)} ronda ${rounds}: tanda enemiga sin cerrar en 64 pasos`,
        ).toBe(true);
      }
    }
  });
});

describe("quirk FIEL del save editado: party con DEX 99", () => {
  it("recarga de iniciativa = 0x24 − DEX en BYTE (kernel 0x6506 @65a8 / COMBAT @0c4b): DEX 99 → 193", () => {
    expect(initiativeReset(99)).toBe(0xc1); // 193: wrap de byte, sin clamp
    expect(initiativeReset(20)).toBe(0x10); // 16: rata base
    // DEX legítima (≤ 0x23) nunca wrapea; el wrap es exclusivo de saves editados.
    for (let dex = 1; dex <= 0x23; dex++) expect(initiativeReset(dex)).toBe(0x24 - dex);
  });

  it("umbral de acierto (COMBAT @154d): una rata (vel ≤23) JAMÁS acierta a un defensor DEX 99", () => {
    // rand30() ∈ [1,30] (kernel 0x3ABE); acierto ⇔ rand30 ≥ umbral.
    for (let ratSpeed = 16; ratSpeed <= 23; ratSpeed++) {
      expect(hitThreshold(99, ratSpeed)).toBeGreaterThan(30);
    }
  });

  it("con 4 ratas: ~48 turnos enemigos entre turnos de party (el «cicla ~50 veces» del vídeo), la tanda CIERRA y la party no recibe daño", () => {
    for (const seed of [0x2b67, 0xbeef]) {
      const combat = newCombat(freshState(99), seed);
      const hpBefore = combat.combatants
        .filter((c) => c.kind === "player")
        .map((c) => c.hp);
      passUntilEnemyPhase(combat);
      expect(combat.currentUnit?.kind).toBe("enemy");
      const { steps, events } = drainEnemyPhaseStepped(combat, 128);
      // 4 ratas × (193 / recarga 13..20) ≈ 39..59 activaciones por ronda de party.
      expect(steps).toBeGreaterThanOrEqual(36);
      expect(steps).toBeLessThanOrEqual(64);
      // La tanda CERRÓ: vuelve el prompt del PJ (no hay ciclo infinito).
      expect(combat.currentUnit?.kind).toBe("player");
      // Cero daño a la party (umbral inalcanzable): los fallos melé de la IA
      // son SILENCIOSOS (COMBAT @035b-035f) → cero líneas de acción en el log.
      const hpAfter = combat.combatants
        .filter((c) => c.kind === "player")
        .map((c) => c.hp);
      expect(hpAfter).toEqual(hpBefore);
      // Ningún golpe enemigo ACERTÓ (los "attacked" con hit:true no existen).
      expect(events.filter((e) => e.kind === "attacked" && e.hit)).toEqual([]);
    }
  });

  it("con 2 ratas: ~24 activaciones por ronda (el «~25 cambios» que contó el usuario)", () => {
    const combat = newCombat(freshState(99), 0x2b67, 2);
    passUntilEnemyPhase(combat);
    expect(combat.currentUnit?.kind).toBe("enemy");
    const { steps } = drainEnemyPhaseStepped(combat, 64);
    expect(steps).toBeGreaterThanOrEqual(18);
    expect(steps).toBeLessThanOrEqual(32);
    expect(combat.currentUnit?.kind).toBe("player");
  });
});
