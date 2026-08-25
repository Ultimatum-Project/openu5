/**
 * Chunking del pacer de la tanda enemiga (careo-combate T11 / auditoría Q2).
 *
 * El pacer de la piel (main.ts) llama `tickEnemyTurnStep()` por beat — la API
 * canónica del hotfix (reconciliación triple-fix: la cota `maxActions` de
 * lote-tests y el `tickOneEnemyTurn` de lote-guardas eran el MISMO paso con otro
 * ropaje y se retiraron) — para intercalar ~400 ms entre acciones de IA; la
 * automatización (beat 0) llama `tickEnemyTurns()` (tanda completa síncrona,
 * flujo previo byte-idéntico). Este test fija el CONTRATO que hace válido el
 * paceo: trocear la tanda en pasos de 1 acción produce EXACTAMENTE la misma
 * secuencia de eventos y el mismo consumo de RNG (finalSeed) que la llamada
 * única — el beat es 100% presentación, jamás puede mover un digest.
 *
 * (Sin el paso, el brazo del pacer era INALCANZABLE: la 1ª llamada síncrona
 * resolvía la tanda entera y el «paceo» T11 nunca paceó — el defecto que Q2
 * predijo que aterrizaría en verde por falta de red.)
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

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>(
  "../src/core/data/AdditionalEnemyFlags.json",
);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
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

/** Combate con un grupo de 4 esqueletos (tanda multi-acción) sobre CampFire. */
function newCombat(state: GameState, seed: number): Combat {
  return new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: byName("Skeleton"), count: 4 }],
    seed,
    state,
    defenseValues: data.defenseValues,
  });
}

/** Pasa el turno de TODOS los PJ hasta abrir la fase enemiga (traza de los pass). */
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

/** Resuelve la tanda enemiga tras un pass del PJ, con la granularidad dada:
 *  drain entero (`tickEnemyTurns`) o de a un paso (`tickEnemyTurnStep`, el pacer). */
function passAndTick(combat: Combat, granularity: "drain" | "step" = "drain"): CombatEvent[] {
  const events: CombatEvent[] = [];
  let guard = 0;
  while (!combat.over && guard++ < 200) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind === "enemy" || cur.charmed) {
      events.push(
        ...(granularity === "drain" ? combat.tickEnemyTurns() : combat.tickEnemyTurnStep()),
      );
      continue;
    }
    break; // de vuelta al prompt del PJ: tanda terminada
  }
  return events;
}

describe("tickEnemyTurnStep — chunking del pacer (T11/Q2)", () => {
  it("trocear en llamadas de 1 acción ≡ llamada única: misma traza y mismo finalSeed", () => {
    const seed = 0x2b67;
    const a = newCombat(freshState(), seed);
    const b = newCombat(freshState(), seed);

    // Pasa el turno de TODOS los PJ hasta abrir la fase enemiga en ambos.
    const passA = passUntilEnemyPhase(a);
    const passB = passUntilEnemyPhase(b);
    expect(JSON.stringify(passA)).toBe(JSON.stringify(passB));
    expect(a.currentUnit?.kind).toBe("enemy");

    // A: tanda de una vez (flujo de automatización). B: de a UNA acción (pacer).
    const evA = passAndTick(a);
    const evB = passAndTick(b, "step");

    expect(evA.length).toBeGreaterThan(0);
    expect(JSON.stringify(evB)).toBe(JSON.stringify(evA));
    expect(b.finalSeed).toBe(a.finalSeed);
    // Ambos quedan en el MISMO punto: turno de un PJ (o combate cerrado igual).
    expect(b.over).toBe(a.over);
    expect(b.currentUnit?.id).toBe(a.currentUnit?.id);
  });

  it("tickEnemyTurnStep procesa exactamente una acción de IA y devuelve el control", () => {
    const combat = newCombat(freshState(), 0x2b67);
    passUntilEnemyPhase(combat);
    expect(combat.currentUnit?.kind).toBe("enemy"); // la fase enemiga abrió de verdad
    const before = combat.currentUnit!.id;
    combat.tickEnemyTurnStep();
    // Tras UNA acción quedan enemigos por actuar (grupo de 4): la tanda NO se agotó
    // en la llamada — la condición que arma el pacer de main.ts es alcanzable.
    expect(combat.over).toBe(false);
    const cur = combat.currentUnit;
    expect(cur?.kind === "enemy" || cur?.charmed).toBe(true);
    expect(cur?.id).not.toBe(before);
  });
});
