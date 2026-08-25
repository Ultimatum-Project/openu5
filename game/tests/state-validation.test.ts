/**
 * R5 (auditoría de calidad) — validación estructural de `deserialize` en el camino de
 * datos NO confiables (`importSave` pasa ficheros arbitrarios del usuario). Regla:
 * campos críticos siempre presentes en un save v1 se exigen con su tipo; los campos
 * añadidos después sólo se validan de tipo SI están (ausente = merge tolerado, compat
 * de saves viejos — matiz del verdict R5).
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, GameState } from "../src/core/state.js";
import { deserialize, serialize } from "../src/core/state.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1, characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, keys: 0, gems: 0, torches: 2, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

describe("deserialize — validación estructural del import (R5)", () => {
  it("round-trip de un estado válido pasa", () => {
    const s = makeState();
    expect(() => deserialize(serialize(s))).not.toThrow();
  });

  it("characters:[{}] (el escenario del informe) es rechazado", () => {
    const raw = JSON.stringify({ ...makeState(), characters: [{}] });
    expect(() => deserialize(raw)).toThrow(/Save corrupto/);
  });

  it("un personaje con hp no numérico es rechazado", () => {
    const bad = { ...makeChar(), currentHp: "lots" } as unknown as CharacterState;
    const raw = JSON.stringify(makeState({ characters: [bad] }));
    expect(() => deserialize(raw)).toThrow(/currentHp/);
  });

  it("position malformada es rechazada", () => {
    const raw = JSON.stringify({
      ...makeState(),
      position: { location: 0, floor: 0, x: "3", y: 22 },
    });
    expect(() => deserialize(raw)).toThrow(/position/);
  });

  it("partySize fuera de rango (0 / mayor que el roster) es rechazado", () => {
    expect(() => deserialize(JSON.stringify({ ...makeState(), partySize: 0 }))).toThrow(
      /partySize/,
    );
    expect(() => deserialize(JSON.stringify({ ...makeState(), partySize: 7 }))).toThrow(
      /partySize/,
    );
  });

  it("una tabla de cantidades con basura es rechazada", () => {
    const raw = JSON.stringify({ ...makeState(), spellQuantities: [1, null, "x"] });
    expect(() => deserialize(raw)).toThrow(/spellQuantities/);
  });

  it("campos escalares AÑADIDOS tras v1 ausentes se toleran (merge de saves viejos)", () => {
    const s = makeState() as unknown as Record<string, unknown>;
    delete s.skullKeys; // campo posterior: ausente NO rompe (lo hereda el merge)
    delete s.reagentQuantities;
    expect(() => deserialize(JSON.stringify(s))).not.toThrow();
  });

  it("pero presentes con tipo malo son rechazados", () => {
    const raw = JSON.stringify({ ...makeState(), gold: "1e9" });
    expect(() => deserialize(raw)).toThrow(/gold/);
  });
});
