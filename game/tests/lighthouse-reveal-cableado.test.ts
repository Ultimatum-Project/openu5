/**
 * 🔴 GUARDA DEL CABLEADO (#326) — patrón de mirror-reflection.test.ts: las guardas
 * de predicado (lighthouse-beam.test.ts) seguirían verdes si nadie llamara a
 * `beamLitWindowCells`/`revealViewport` desde coreview. Esta suite mira el SNAPSHOT
 * que consumen las pieles (clase #133: tener test ≠ estar vigilado).
 *
 *   · HAZ DEL FARO: activación nocturna (0x70c8, cuña {0,1,2}), giro por paso
 *     (`tickBeam` = una pasada de viewport_redraw 0x5951), congelación por An Tym
 *     (latch [0x5891], 0x591d/5938) y puerta de día (0x70a6/0x70b4).
 *   · REVELADO de la poción BLANCA: CAST2 0x046c → 0x5d0a con radio -1, cuya rama
 *     (5d45 `jle` → 5d8f-5df3) NO floodea: copia el tile CRUDO de cada celda.
 *     El testigo que separa esa mecánica de un `computeVisibleWindow(∞)` es una
 *     SALA SELLADA: el flood no la alcanza ni con radio infinito; la copia cruda
 *     sí la enseña (por eso el ledger la llama xray).
 */
import { describe, expect, it, vi } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { TILE_HIDDEN, VIEW_HALF, VIEW_WINDOW } from "../src/skin/api.js";
import { LIGHTHOUSE_LIGHT_TILE } from "../src/core/world/lighthouse.js";
import { DEATH_VISION_FRAMES } from "../src/core/magic/cast.js";

const LOC = 0x16; // Paws (id cualquiera de pueblo)
const PX = 10;
const PY = 10;
const FLOOR = 68; // BrickFloor (transparente)
const WALL = 0x4f; // StoneWall (ALWAYS_OPAQUE)

const idx = (col: number, row: number): number => row * VIEW_WINDOW + col;

/** Pueblo 32×32 de suelo de ladrillo, con parches opcionales de tiles. */
function world(patches: readonly (readonly [number, number, number])[]): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => FLOOR));
  for (const [x, y, t] of patches) tiles[y]![x] = t;
  const town: SmallMapLocation = { id: LOC, name: "Paws", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[LOC, town]]) };
}

function makeGame(
  patches: readonly (readonly [number, number, number])[],
  hour = 23,
): Game {
  const char: CharacterState = {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
  const state = {
    characters: [char], partySize: 1, activeCharacter: 0,
    food: 100, gold: 10, karma: 50,
    time: { year: 139, month: 4, day: 7, hour, minute: 0 },
    turnsSinceStart: 0,
    position: { location: LOC, floor: 0, x: PX, y: PY },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: hour,
  } as unknown as GameState;
  const gameData: GameData = {
    locationsX: Array.from({ length: 32 }, () => 250),
    locationsY: Array.from({ length: 32 }, () => 250),
    locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  };
  return new Game({} as ExtractedInitialState, world(patches), gameData, state);
}

// El emisor a UNA casilla al este de la party: mapa (11,10) → ventana (6,5).
const FARO: readonly [number, number, number] = [PX + 1, PY, LIGHTHOUSE_LIGHT_TILE];
// Celdas de VENTANA del rayo NORTE (fase 0-2) y del rayo SUR (fase 8-10) del emisor.
const NORTE_LEJOS = idx(6, 2); // emisor + (0,-3): radial 10 > 2 — sólo la enciende el haz
const SUR_LEJOS = idx(6, 8); // emisor + (0,3)

describe("haz del faro — CABLEADO en el snapshot (activación, giro, An Tym, día)", () => {
  it("de noche, el primer redibujo ACTIVA la cuña {0,1,2}: el rayo norte se ve", () => {
    const view = new CoreViewImpl(makeGame([FARO]));
    const snap = view.snapshot();
    expect(snap.window[NORTE_LEJOS]).toBe(FLOOR); // el pasillo del rayo, revelado
    expect(snap.window[SUR_LEJOS]).toBe(TILE_HIDDEN); // la cuña aún no mira al sur
  });

  it("NEGATIVO: sin emisor, esas mismas celdas son negras de noche", () => {
    const snap = new CoreViewImpl(makeGame([])).snapshot();
    expect(snap.window[NORTE_LEJOS]).toBe(TILE_HIDDEN);
    expect(snap.window[SUR_LEJOS]).toBe(TILE_HIDDEN);
  });

  it("ocho pasos de `tickBeam` GIRAN la cuña al sur (fase 8 = {8,9,10})", () => {
    const view = new CoreViewImpl(makeGame([FARO]));
    view.snapshot(); // activa (fase 0)
    for (let i = 0; i < 8; i++) view.tickBeam();
    const snap = view.snapshot();
    expect(snap.window[SUR_LEJOS]).toBe(FLOOR); // ahora barre el sur
    expect(snap.window[NORTE_LEJOS]).toBe(TILE_HIDDEN); // y el norte se apagó
  });

  it("An Tym congela la fase: `tickBeam` con g_time_spell='T' no mueve la cuña", () => {
    const game = makeGame([FARO]);
    const view = new CoreViewImpl(game);
    view.snapshot(); // activa (fase 0)
    (game.state as { timeSpell?: string }).timeSpell = "T";
    for (let i = 0; i < 8; i++) view.tickBeam();
    view.notifyDirty();
    const snap = view.snapshot();
    expect(snap.window[NORTE_LEJOS]).toBe(FLOOR); // sigue mirando al norte
    expect(snap.window[SUR_LEJOS]).toBe(TILE_HIDDEN);
  });

  it("puerta de DÍA (>= 0x32): la fase cae a 0xff, y la noche re-activa en {0,1,2}", () => {
    const game = makeGame([FARO], 12); // mediodía: luz 0x32
    const view = new CoreViewImpl(game);
    view.snapshot(); // gate: fase 0xff (todo se ve igual: es de día)
    game.state.time.hour = 23;
    view.notifyDirty(); // el reloj cambió (mismo canal que usa main.ts)
    const snap = view.snapshot(); // re-activación: cuña {0,1,2}, no una fase girada
    expect(snap.window[NORTE_LEJOS]).toBe(FLOOR);
    expect(snap.window[SUR_LEJOS]).toBe(TILE_HIDDEN);
  });
});

describe("revelado de la poción blanca — CABLEADO en el snapshot", () => {
  // SALA SELLADA 3×3 al este: muros en el anillo, suelo en el centro (14,10).
  // El interior es INALCANZABLE para el flood (con cualquier radio): sólo la
  // copia cruda de 5d8f-5df3 lo enseña. Mata al mutante `computeVisibleWindow(∞)`.
  const SELLADA: readonly (readonly [number, number, number])[] = [
    [13, 9, WALL], [14, 9, WALL], [15, 9, WALL],
    [13, 10, WALL], [15, 10, WALL],
    [13, 11, WALL], [14, 11, WALL], [15, 11, WALL],
  ];
  const INTERIOR = idx(9, VIEW_HALF); // mapa (14,10) → ventana (9,5)

  it("sin revelado: el interior sellado es negro (día incluido — el flood no cruza)", () => {
    const view = new CoreViewImpl(makeGame(SELLADA, 12)); // día, radio 0x32
    expect(view.snapshot().window[INTERIOR]).toBe(TILE_HIDDEN);
  });

  // Primitiva UNIFICADA de la confluencia #319+#326: la poción reusa
  // `revealViewport` (la de Wis An Ylem, main). Reloj fingido como en
  // wis-an-ylem-reveal-319.test.ts.
  it("revealViewport: la ventana ENTERA se ve — interior sellado incluido — y al expirar se restaura", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000);
      const view = new CoreViewImpl(makeGame(SELLADA)); // noche (peor caso)
      expect(view.snapshot().window[INTERIOR]).toBe(TILE_HIDDEN);
      view.revealViewport(DEATH_VISION_FRAMES * 55); // el paceador de la poción pasa esto
      const revelado = view.snapshot();
      expect(revelado.window[INTERIOR]).toBe(FLOOR); // rayos X: el interior, crudo
      // Y ninguna celda del mapa queda oculta (TODO visible, como la copia cruda).
      for (const t of revelado.window) expect(t).not.toBe(TILE_HIDDEN);
      vi.setSystemTime(1_000_000 + DEATH_VISION_FRAMES * 55 + 1);
      expect(view.snapshot().window[INTERIOR]).toBe(TILE_HIDDEN); // el 0x5910 final
    } finally {
      vi.useRealTimers();
    }
  });

  it("el revelado NOTIFICA (repinta) y es MUDO: onDirty sí, onSfx no", () => {
    const view = new CoreViewImpl(makeGame(SELLADA));
    let dirty = 0;
    let sfx = 0;
    view.subscribe({ onDirty: () => dirty++, onSfx: () => sfx++ });
    view.revealViewport(DEATH_VISION_FRAMES * 55);
    expect(dirty).toBe(1);
    expect(sfx).toBe(0); // la poción llama a 0x046c SIN el push 6 del jingle
  });
});
