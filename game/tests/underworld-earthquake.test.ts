/**
 * Terremoto ALEATORIO del underworld (task #31) — MAINOUT 0x0A60.
 *
 * Auditoría: el port YA consume `rand(0,255)` cada turno de underworld
 * (`underworldHazard`, hazards.ts) y aplica el daño en 0x69 — RNG idéntico al
 * original (parity verde, cubierto por re/parity/loops/outdoor-underworld-night).
 * Lo que faltaba era la PRESENTACIÓN: el original imprime "EARTHQUAKE!\n" y sacude
 * la pantalla (0x0a7a/0x0a7d) — el port lo disparaba SILENCIOSO. Este test fija
 * que ahora se emite el mensaje + evento quake, SIN tocar el consumo de RNG.
 * re/notes/quake-harpsichord.md §4b.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { EARTHQUAKE_MESSAGE } from "../src/core/world/loops/hazards.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0xff, x: 100, y: 100 }, // UNDERWORLD (floor 0xff)
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 2,
  };
  return { ...base, ...over } as GameState;
}

function makeWorld(): WorldData {
  const grass = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld: grass, underworld: grass, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

// Mundo ÚNICO compartido por todo el archivo (256×256 = 65 536 celdas de grass). Las
// tres pruebas sólo se MUEVEN sobre él y los overrides de tile viven en el estado del
// juego, NO en WorldData → move() no lo muta, así que reconstruirlo por iteración era
// puro coste de asignación. El test "NO dispara" hace 300 iteraciones; con un world
// nuevo por vuelta tardaba ~820 ms aislado pero ~3.2 s bajo la carga de la suite
// completa (contención de CPU), rozando el timeout de 5 s de vitest → flaky intermitente
// (#55). Compartir el world elimina la asignación y con ella la sensibilidad al timeout.
const SHARED_WORLD = makeWorld();
const makeGame = (s: GameState): Game =>
  new Game({} as ExtractedInitialState, SHARED_WORLD, gameData, s);

type Ev = ReturnType<Game["move"]>[number];
const hasQuake = (ev: Ev[]): boolean => ev.some((e) => e.kind === "quake");
const hasEqMsg = (ev: Ev[]): boolean =>
  ev.some((e) => e.kind === "message" && e.text === EARTHQUAKE_MESSAGE);
const hasQuakeSfx = (ev: Ev[]): boolean =>
  ev.some((e) => e.kind === "sfx" && e.sfx?.id === "quake");

/**
 * Semillas cuyo PRIMER paso de underworld dispara el terremoto (stream vivo:
 * viento(0,63) → hazard(0,255)==0x69). Localizadas por barrido del OriginalRng;
 * 4280 es la primera. (El PRNG es un LCG: con semillas secuenciales pequeñas el
 * valor en la posición del hazard no recorre 0x69 hasta ~4280 — el evento es
 * 1/256 sobre el STREAM vivo, no sobre semillas consecutivas.)
 */
const FIRING_SEEDS = [4280, 4281, 4282, 4283, 4284, 4285] as const;

describe("terremoto aleatorio del underworld (#31)", () => {
  it("al disparar el hazard, emite EARTHQUAKE! + evento quake + sfx quake, en orden", () => {
    const g = makeGame(makeState({ position: { location: 0, floor: 0xff, x: 100, y: 100 } }));
    g.reseed(FIRING_SEEDS[0]);
    const ev = g.move("north");
    expect(hasEqMsg(ev)).toBe(true);
    expect(hasQuake(ev)).toBe(true);
    expect(hasQuakeSfx(ev)).toBe(true);
    // Orden fiel (0x0a7a mensaje ANTES de 0x0a7d sacudida).
    const msgIdx = ev.findIndex((e) => e.kind === "message" && e.text === EARTHQUAKE_MESSAGE);
    const qIdx = ev.findIndex((e) => e.kind === "quake");
    expect(msgIdx).toBeLessThan(qIdx);
  });

  it("un turno de underworld que NO dispara el hazard no emite terremoto", () => {
    // La semilla firing menos 1 (o cualquiera que no dispare): comprobamos que la
    // mayoría de turnos son mudos (el evento es 1/256, no cada turno).
    let silent = 0;
    for (let seed = 0; seed < 300; seed++) {
      const g = makeGame(makeState());
      g.reseed(seed);
      const ev = g.move("north");
      if (!hasEqMsg(ev) && !hasQuake(ev)) silent++;
    }
    expect(silent).toBeGreaterThan(250); // ~299/300 mudos
  });

  it("gate g_floor!=0: semillas que SÍ disparan en el underworld NO disparan en superficie", () => {
    // Las FIRING_SEEDS disparan el hazard en el underworld (wind→hazard==0x69). En
    // floor 0 el `cmp g_floor,0; je` corta ANTES de la tirada → jamás EARTHQUAKE.
    for (const seed of FIRING_SEEDS) {
      const under = makeGame(makeState({ position: { location: 0, floor: 0xff, x: 100, y: 100 } }));
      under.reseed(seed);
      expect(hasEqMsg(under.move("north"))).toBe(true); // underworld: dispara

      const surf = makeGame(makeState({ position: { location: 0, floor: 0, x: 100, y: 100 } }));
      surf.reseed(seed);
      const ev = surf.move("north");
      expect(hasEqMsg(ev) || hasQuake(ev)).toBe(false); // superficie: mudo
    }
  });
});
