/**
 * Vas Rel Por (idx 46) — el hechizo que teleporta a la PIEDRA LUNAR DE LA FASE QUE
 * TECLEAS. Ficha #341; derivación completa en `re/notes/vas-rel-por-341-derivacion.md`.
 *
 * Sujeto de estos tests: las DOS piezas de mecánica que el port estrena —
 * `moonstoneDestination` (la lectura de las cuatro tablas paralelas con su centinela) y
 * `Game.moonstoneTeleport` (`kernel_moongate_teleport`, `ULTIMA.EXE:0x47f4`) — más el
 * `getkey` PELADO del PromptManager, que es lo que separa este prompt de un `digit`.
 *
 * 🔴 LOS ESPERADOS VAN EN CRUDO. Las cuatro tablas se transcriben aquí como literales
 * (`0x5830` x · `0x5838` y · `0x5840` location · `0x5848` floor) en vez de leerse del
 * mismo objeto que las escribe: un aserto que calcula su esperado desde el sujeto pasa
 * con el sujeto roto.
 */
import { describe, expect, it } from "vitest";
import { PromptManager } from "../src/ui/prompt-manager.js";
import { moonstoneDestination } from "../src/core/world/moongates.js";
import { Game, type GameData } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const TOWN_LOC = 13; // una location de pueblo cualquiera dentro de la banda 1..0x20

function makeChar(): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
}

/**
 * Ocho piedras con valores DISTINTOS por fase y por campo — que el aserto pueda
 * distinguir «leyó la tabla correcta» de «leyó otra tabla con el mismo número».
 */
function makeMoonstones(): GameState["moonstones"] {
  return [
    { x: 0x10, y: 0x20, z: 0x00, location: 0, buried: true }, // fase 0 · sobremundo
    { x: 0x11, y: 0x21, z: 0xff, location: 0, buried: true }, // fase 1 · Underworld
    { x: 0x12, y: 0x22, z: 0x00, location: 0xff, buried: false }, // fase 2 · EN LA MOCHILA
    { x: 0x0d, y: 0x0e, z: 0x00, location: TOWN_LOC, buried: true }, // fase 3 · dentro de un pueblo
    { x: 0x14, y: 0x24, z: 0x00, location: 0, buried: true },
    { x: 0x15, y: 0x25, z: 0x00, location: 0, buried: true },
    { x: 0x16, y: 0x26, z: 0x00, location: 0, buried: true },
    { x: 0x17, y: 0x27, z: 0x00, location: 0, buried: true },
  ];
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot",
    transportTile: 0x1c,
    torchTurns: 0,
    torches: 2,
    prevHour: 8,
    moonstones: makeMoonstones(),
    // `hydrateUnderworldPlot` (la rama de destino=mundo grande) los lee: sin ellos el
    // fixture revienta con un TypeError que NO es del sujeto.
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    questFlags: {},
  };
  return { ...base, ...over } as GameState;
}

function makeTownLocation(): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id: TOWN_LOC, name: "Pueblo", floors: [{ z: 0, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[TOWN_LOC, makeTownLocation()]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState = makeState()): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s);
}

describe("moonstoneDestination — las CUATRO tablas de 0x47f4 con su centinela", () => {
  it("fase enterrada: devuelve x/y/z/location de SU fila, no de otra", () => {
    // Esperados EN CRUDO: la fila 3 de makeMoonstones, escrita a mano.
    expect(moonstoneDestination(makeState(), 3)).toEqual({
      x: 0x0d, y: 0x0e, z: 0x00, location: TOWN_LOC,
    });
    // Control de que el índice NO está pegado a 0: otra fase da otra fila.
    expect(moonstoneDestination(makeState(), 1)).toEqual({
      x: 0x11, y: 0x21, z: 0xff, location: 0,
    });
  });

  it("location == 0xFF (en la mochila) → null: es el gate de 0x47fd, y es el ÚNICO", () => {
    expect(moonstoneDestination(makeState(), 2)).toBeNull();
  });

  it("NO compara contra g_location: la piedra de otro sitio SÍ es destino válido", () => {
    // 0x47fd sólo mira el 0xFF. El `cmp …, g_location` es el gate de DIBUJO (0x4713), y
    // confundirlos rompería el viaje entre localizaciones — que es TODO el hechizo.
    const enPueblo = makeState({ position: { location: TOWN_LOC, floor: 0, x: 1, y: 1 } });
    expect(moonstoneDestination(enPueblo, 0)?.location).toBe(0);
  });

  it("fase fuera de la tabla (8) → null, sin reventar", () => {
    expect(moonstoneDestination(makeState(), 8)).toBeNull();
  });
});

describe("Game.moonstoneTeleport — kernel_moongate_teleport 0x47f4", () => {
  it("escribe los CUATRO campos desde la piedra (0x483d-0x4856)", () => {
    const game = makeGame();
    const events: ReturnType<Game["move"]> = [];
    expect(game.moonstoneTeleport(0, events)).toBe(true);
    // Crudos: fila 0 de makeMoonstones.
    expect(game.state.position.location).toBe(0);
    expect(game.state.position.x).toBe(0x10);
    expect(game.state.position.y).toBe(0x20);
    expect(game.state.position.floor).toBe(0);
    expect(events.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("z == 0xFF → floor 0xFF: el Underworld viaja en el 4º campo (0x5848)", () => {
    const game = makeGame();
    expect(game.moonstoneTeleport(1, [])).toBe(true);
    expect(game.state.position.floor).toBe(0xff);
    expect(game.state.position.x).toBe(0x11);
    expect(game.state.position.y).toBe(0x21);
  });

  it("piedra en la mochila: devuelve false y NO mueve al grupo (0x4804)", () => {
    const game = makeGame();
    const antes = { ...game.state.position };
    expect(game.moonstoneTeleport(2, [])).toBe(false);
    expect(game.state.position).toEqual(antes); // ni location, ni x, ni y, ni floor
  });

  it("destino en PUEBLO: carga el mapa y aterriza en la PIEDRA, no en la entrada estándar", () => {
    // El discriminante de la derivación: TOWN.OVL:0x11f0 NO escribe g_party_x/y — el
    // caller (0x4844/0x484b) ya las puso desde la piedra. Un port que reusara el
    // `loadSmallMap` del (E)nter tal cual te dejaría en SMALL_MAP_ENTRY.
    const game = makeGame();
    expect(game.moonstoneTeleport(3, [])).toBe(true);
    expect(game.state.position.location).toBe(TOWN_LOC);
    expect(game.state.position.x).toBe(0x0d);
    expect(game.state.position.y).toBe(0x0e);
    // Y el mapa activo es el del pueblo, no el sobremundo.
    expect(game.activeMap.kind).toBe("small");
  });

  it("desde un PUEBLO al sobremundo: la location vuelve a 0 con la coord de la piedra", () => {
    const game = makeGame(
      makeState({ position: { location: TOWN_LOC, floor: 0, x: 5, y: 5 } }),
    );
    expect(game.moonstoneTeleport(4, [])).toBe(true);
    expect(game.state.position.location).toBe(0);
    expect(game.state.position.x).toBe(0x14);
    expect(game.state.position.y).toBe(0x24);
  });
});

describe("prompt getkey PELADO (kernel 0x266c) — el de «To phase: »", () => {
  function makePm() {
    const echoes: string[] = [];
    const pm = new PromptManager({ hud: { echoSetLast: (t) => echoes.push(t) } });
    return { pm, echoes };
  }
  function key(k: string): KeyboardEvent {
    return { key: k, preventDefault: () => {} } as unknown as KeyboardEvent;
  }

  it("resuelve con la PRIMERA tecla y ecoa el carácter detrás del prefijo (0x0d13)", () => {
    const { pm, echoes } = makePm();
    let got: string | null = null;
    pm.current = { type: "getkey", prefix: "To phase: ", resolve: (k) => { got = k; } };
    expect(pm.handleKey(key("3"))).toBe(true);
    expect(got).toBe("3");
    expect(echoes.at(-1)).toBe("To phase: 3");
    expect(pm.current).toBeNull(); // getkey de UNA tecla: se cierra solo
  });

  it("una tecla NO válida TAMBIÉN resuelve — no re-lee como `digit` (0x0d06 sin bucle)", () => {
    // El aserto que separa este tipo de prompt del `digit`: con `digit` la 'q' se
    // ignoraría y el prompt seguiría vivo, dejando al jugador colgado donde el original
    // ya habría impreso "Failed!".
    const { pm } = makePm();
    let got: string | null = null;
    pm.current = { type: "getkey", prefix: "To phase: ", resolve: (k) => { got = k; } };
    pm.handleKey(key("q"));
    expect(got).toBe("q");
    expect(pm.current).toBeNull();
  });

  it("ESC resuelve pero NO se ecoa: el eco es sólo para imprimibles (`cmp al,0x20 / jb`)", () => {
    const { pm, echoes } = makePm();
    let got: string | null = null;
    pm.current = { type: "getkey", prefix: "To phase: ", resolve: (k) => { got = k; } };
    pm.handleKey(key("Escape"));
    expect(got).toBe("Escape");
    expect(echoes.at(-1)).toBe("To phase: "); // el prefijo, sin carácter pegado
  });

  it("las modificadoras sueltas no son una tecla: el prompt sigue VIVO", () => {
    const { pm } = makePm();
    let veces = 0;
    pm.current = { type: "getkey", prefix: "To phase: ", resolve: () => { veces += 1; } };
    for (const k of ["Shift", "Control", "Alt", "Meta", "CapsLock"]) {
      expect(pm.handleKey(key(k))).toBe(true); // consumida (prompt modal)
    }
    expect(veces).toBe(0);
    expect(pm.current).not.toBeNull();
  });
});
