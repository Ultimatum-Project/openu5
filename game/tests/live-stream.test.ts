/**
 * Stream RNG VIVO unificado (Fase 1.1, Task 1 — deliberate-divergences §2).
 *
 * Verifica que `game.ts` consume UN único `OriginalRng` (el g_rng_seed vivo) con
 * el ORDEN de turno de `turn.ts` (viento → reloj → hazards → housekeeping →
 * spawn), y que `reseed()` lo siembra de forma reproducible. La secuencia byte
 * exacta la cruza el arnés de paridad (loops-run.ts ↔ re/tools/loops_parity.py);
 * aquí basta con el determinismo end-to-end y con que el paso avanza el stream.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 2,
  };
  return { ...base, ...over } as GameState;
}

/** Overworld 256×256 de hierba (5), sin locations. */
function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const makeGame = (s: GameState = makeState()): Game =>
  new Game({} as ExtractedInitialState, makeWorld(), gameData, s);

describe("stream vivo unificado (F.2)", () => {
  it("un paso exterior consume el stream vivo (avanza g_rng_seed)", () => {
    const game = makeGame(makeState({ food: 0 })); // comida 0 fuerza Starving! en el cambio de hora
    const seedBefore = (game as unknown as { liveRng: { getSeed(): number } }).liveRng.getSeed();
    game.move("north");
    const seedAfter = (game as unknown as { liveRng: { getSeed(): number } }).liveRng.getSeed();
    // El paso rodó al menos el viento (0,63): el stream avanzó de forma determinista.
    expect(seedAfter).not.toBe(seedBefore);
  });

  it("reseed reproduce la MISMA secuencia de estado", () => {
    const run = (): string => {
      const g = makeGame();
      g.reseed(1234);
      for (let i = 0; i < 20; i++) g.move(i % 2 ? "east" : "south");
      return JSON.stringify(g.state.position) + g.state.time.hour + g.state.gold;
    };
    expect(run()).toBe(run());
  });

  it("reseed a semillas distintas puede divergir (el stream es la fuente)", () => {
    const run = (seed: number): string => {
      const g = makeGame(makeState({ food: 0 }));
      g.reseed(seed);
      for (let i = 0; i < 40; i++) g.move(i % 2 ? "east" : "south");
      return JSON.stringify(g.state.characters.map((c) => c.currentHp));
    };
    // No es un requisito de fidelidad (dos seeds PODRÍAN coincidir), pero con
    // comida 0 y 40 pasos el hambre (rand(1,8)/miembro) diverge casi siempre.
    expect(run(1)).not.toBe(run(99999));
  });
});
