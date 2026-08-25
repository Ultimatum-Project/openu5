/**
 * Fase 1.3 · Flow 1 — Salida de pueblo interactiva (TOWN 0x600).
 *
 * Regla EXACTA del binario (kernel-survival.md §5.1, scout-prompts.md Flow 1,
 * verificada contra DOSBox): al pisar el borde de un small map con destino
 * TRANSITABLE, el original NO sale de inmediato — pregunta "Dost thou wish to
 * leave? " (DS 0x2690) con un getkey CRUDO (0xa49c, no consume el stream vivo).
 *   - 'Y' → sale al overworld (loc 0) SIN coste de reloj (0 min, VERIFICADO).
 *   - 'N'/ESC → NO sale ("No", DS 0x26d2); el bucle TOWN cobra 1 min (0x15D4).
 *
 * Estos tests ejercitan el MOTOR (`move()` pausa + `confirmTownExit()` resuelve);
 * la captura de tecla Y/N/ESC vive en main.ts (E2E en e2e/prompts.spec.ts).
 */
import { describe, expect, it } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

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

const TOWN_LOC = 13; // Iolo's Hut (idx 12 en locationsX/Y)

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    // Pegado al borde OESTE del small map (x=0): un paso al oeste sale del mapa.
    position: { location: TOWN_LOC, floor: 0, x: 0, y: 15 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

/** Small map 32×32 todo hierba (5, transitable) para la location del pueblo. */
function makeTownLocation(): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id: TOWN_LOC, name: "Iolo's Hut", floors: [{ z: 0, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([[TOWN_LOC, makeTownLocation()]]),
  };
}

// exitToOverworld lee locationsX/Y[loc-1]; da igual el valor concreto (overworld
// es todo hierba), solo que exista para idx 12.
const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState = makeState()): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s);
}

describe("Flow 1 — salida de pueblo interactiva (TOWN 0x600)", () => {
  it("pisar el borde transitable PAUSA: emite town-exit-prompt y NO cambia de location", () => {
    const game = makeGame();
    const events = game.move("west");

    // No sale todavía: sigue en el pueblo.
    expect(game.state.position.location).toBe(TOWN_LOC);
    // Emite el prompt (no el viejo "Leaving...").
    expect(events.some((e) => e.kind === "town-exit-prompt")).toBe(true);
    expect(events.some((e) => e.kind === "message" && e.text === "Leaving...")).toBe(false);
  });

  it("confirmTownExit(false) [N/ESC]: NO sale y cobra +1 minuto (TOWN 0x15D4)", () => {
    const game = makeGame();
    game.move("west"); // abre el prompt
    const minBefore = game.state.time.minute;

    const events = game.confirmTownExit(false);

    expect(game.state.position.location).toBe(TOWN_LOC); // sigue en el pueblo
    expect(game.state.time.minute).toBe(minBefore + 1); // turno de pueblo = 1 min
    // El eco "No" (TOWN 0x07be) es PRESENTACIÓN: lo pinta INLINE el reductor de prompts
    // (main.ts messageAppend tras "Dost thou wish to leave? "), NO el core. Aquí el core
    // sólo cobra el turno de pueblo — no debe emitir la palabra de respuesta.
    expect(events.some((e) => e.kind === "message" && e.text === "No")).toBe(false);
  });

  it("confirmTownExit(true) [Y]: sale a loc 0 SIN coste de reloj (0 min, VERIFICADO)", () => {
    const game = makeGame();
    game.move("west"); // abre el prompt
    const minBefore = game.state.time.minute;

    const events = game.confirmTownExit(true);

    expect(game.state.position.location).toBe(0); // overworld
    expect(game.state.time.minute).toBe(minBefore); // salir no cuesta minuto
    expect(events.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("el prompt es getkey crudo: abrir + confirmar Y NO consume RNG (seed del stream + órbita)", () => {
    // Prueba DIRECTA del "0 RNG" por la semilla viva (g_rng_seed, DS:0x5420): el
    // getkey del prompt (0xa49c) y la salida no tocan el stream. Se comparan DOS
    // cosas para no depender de que el consumo tenga efecto observable en el
    // estado:
    //   (1) la semilla justo tras move→prompt→Y debe ser EXACTA a la de reseed
    //       (si el prompt/salida consumieran un rand, divergiría al instante);
    //   (2) tras N pasos idénticos en overworld, semilla Y estado coinciden con
    //       una partida B que arranca ya en el overworld (misma semilla).
    const seedOf = (g: Game): number =>
      (g as unknown as { liveRng: { getSeed(): number } }).liveRng.getSeed();
    const snapshot = (g: Game): string =>
      JSON.stringify({ pos: g.state.position, min: g.state.time.minute });
    const OVERWORLD_START = { location: 0, floor: 0, x: 100, y: 100 };

    const a = makeGame();
    a.reseed(4242);
    const seed0 = seedOf(a); // semilla anclada, aún sin consumir nada
    a.move("west"); // abre el prompt (getkey crudo → 0 RNG)
    a.confirmTownExit(true); // Y → exitToOverworld a (100,100), 0 RNG, 0 min
    // (1) Prueba directa: cruzar el prompt no movió la semilla ni un paso.
    expect(seedOf(a)).toBe(seed0);

    const b = makeGame(makeState({ position: { ...OVERWORLD_START } }));
    b.reseed(4242);
    expect(seedOf(b)).toBe(seed0); // misma ancla de partida

    // (2) N pasos idénticos en overworld (cada uno SÍ consume rand: viento +
    // rollSpawnGate). Si A hubiera consumido RNG de más en el prompt, ni la
    // semilla ni el estado cuadrarían aquí.
    for (let i = 0; i < 12; i++) {
      a.move(i % 2 ? "east" : "south");
      b.move(i % 2 ? "east" : "south");
    }

    expect(seedOf(a)).toBe(seedOf(b));
    expect(snapshot(a)).toBe(snapshot(b));
  });
});
