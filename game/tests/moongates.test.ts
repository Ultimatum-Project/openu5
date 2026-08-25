/**
 * Tests de moongates con assets REALES (game/assets/).
 * moonPhases sale de data.json; las 8 moonstones iniciales de initial-state.json.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  moonPhasesForDay,
  activeGatePhase,
  moongatePositions,
  moongateAt,
  moongateDestination,
  buryMoonstone,
  digUpMoonstone,
  TOTAL_MOONSTONES,
} from "../src/core/world/moongates.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import type { GameTime } from "../src/core/time.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readJson = <T>(p: string): T =>
  JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

let moonPhases: number[];
let init: ExtractedInitialState;

beforeAll(() => {
  moonPhases = readJson<{ moonPhases: number[] }>("data.json").moonPhases;
  init = readJson("initial-state.json");
});

const newGame = (): GameState => createNewGame(init);
const at = (day: number, hour: number): GameTime => ({
  year: 139,
  month: 1,
  day,
  hour,
  minute: 0,
});

/** Coordenadas canónicas de las 8 moonstones/moongates de la partida nueva. */
const MOONGATE_COORDS: readonly [number, number][] = [
  [224, 133], // fase 0 NewMoon        — Moonglow
  [96, 102], //  fase 1 CrescentWaxing — Britain
  [38, 224], //  fase 2 FirstQuarter   — Jhelom
  [50, 37], //   fase 3 GibbousWaxing  — Yew
  [166, 19], //  fase 4 FullMoon       — Minoc
  [104, 194], // fase 5 GibbousWaning  — Trinsic
  [23, 126], //  fase 6 LastQuarter    — Skara Brae
  [187, 167], // fase 7 CrescentWaning — New Magincia
];

describe("fases lunares (MOON_PHASES de DATA.OVL)", () => {
  it("moonPhasesForDay del día 1: ambas lunas en fase 0 (NewMoon)", () => {
    expect(moonPhasesForDay(moonPhases, 1)).toEqual({ felucca: 0, trammel: 0 });
  });

  it("moonPhasesForDay del día 15: Felucca 0, Trammel 4 (FullMoon)", () => {
    expect(moonPhasesForDay(moonPhases, 15)).toEqual({ felucca: 0, trammel: 4 });
  });
});

describe("activeGatePhase (solo de noche)", () => {
  it("mediodía (12:00) no hay puerta", () => {
    expect(activeGatePhase(at(15, 12), moonPhases)).toBeNull();
  });

  it("noche temprana (22:00) usa la fase de Trammel del día", () => {
    // Día 15: Trammel = 4.
    expect(activeGatePhase(at(15, 22), moonPhases)).toBe(4);
  });

  it("madrugada (03:00) usa la fase de Felucca del día", () => {
    // Día 15: Felucca = 0.
    expect(activeGatePhase(at(15, 3), moonPhases)).toBe(0);
  });

  it("las puertas solo existen entre 20:00 y 04:59", () => {
    expect(activeGatePhase(at(1, 5), moonPhases)).toBeNull(); // amanece
    expect(activeGatePhase(at(1, 19), moonPhases)).toBeNull(); // aún de día
    expect(activeGatePhase(at(1, 20), moonPhases)).not.toBeNull();
    expect(activeGatePhase(at(1, 4), moonPhases)).not.toBeNull();
  });
});

describe("moonstones iniciales (INIT.GAM canónico)", () => {
  it("hay 8 moonstones y todas empiezan enterradas", () => {
    const state = newGame();
    expect(state.moonstones.length).toBe(TOTAL_MOONSTONES);
    expect(state.moonstones.every((m) => m.buried)).toBe(true);
    expect(state.moonstones.every((m) => m.z === 0)).toBe(true); // todas en Britannia
  });

  it("sus posiciones son las 8 ciudades-moongate canónicas", () => {
    const state = newGame();
    state.moonstones.forEach((m, phase) => {
      expect([m.x, m.y]).toEqual(MOONGATE_COORDS[phase]);
    });
  });

  it("moongatePositions lista las 8 con su fase", () => {
    const positions = moongatePositions(newGame());
    expect(positions.length).toBe(8);
    expect(positions.map((p) => p.phase)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("moongateAt / moongateDestination", () => {
  it("moongateDestination a las 22:00 del día 1 apunta a la moonstone de Moonglow", () => {
    // Día 1: Trammel = 0 → fase 0 → moonstone de Moonglow (224,133,z0).
    const dest = moongateDestination(newGame(), at(1, 22), moonPhases);
    expect(dest).toEqual({ x: 224, y: 133, z: 0 });
  });

  it("moongateDestination a las 22:00 del día 15 apunta a la moonstone de Minoc", () => {
    // Día 15: Trammel = 4 → fase 4 → moonstone de Minoc (166,19,z0).
    const dest = moongateDestination(newGame(), at(15, 22), moonPhases);
    expect(dest).toEqual({ x: 166, y: 19, z: 0 });
  });

  it("de día no hay destino de puerta", () => {
    expect(moongateDestination(newGame(), at(1, 12), moonPhases)).toBeNull();
  });

  it("moongateAt: de noche hay puerta sobre una moonstone enterrada, de día no", () => {
    const state = newGame();
    const [x, y] = MOONGATE_COORDS[0]!; // Moonglow, en Britannia (no underworld)
    expect(moongateAt(state, at(1, 22), moonPhases, x, y, false, 0)).toBe(true);
    expect(moongateAt(state, at(1, 12), moonPhases, x, y, false, 0)).toBe(false);
    // Sin moonstone en esa casilla: no hay puerta.
    expect(moongateAt(state, at(1, 22), moonPhases, 0, 0, false, 0)).toBe(false);
  });

  // ── #149 · el gate de DIBUJO va por LOCALIZACIÓN (ULTIMA.EXE:0x4713) ────────────────
  // `mov al,[g_location]` + `cmp byte [bx+0x5840],al` + `jne` → sin puerta. La piedra sólo
  // pinta su puerta DONDE está enterrada.
  // ⚠ El testigo entierra en un PUEBLO a propósito: con localización 0 el predicado nuevo y
  // el viejo dan lo mismo y el aserto pasaría con el código roto (misma lección que
  // moonstone-buried-codec.test.ts). MINOC = 0x0e.
  const MINOC = 0x0e;
  const enterradaEn = (loc: number): GameState => {
    const st = newGame();
    const [x0, y0] = MOONGATE_COORDS[0]!;
    digUpMoonstone(st, x0, y0, 0); // fase 0 a la mochila
    buryMoonstone(st, 0, 77, 88, 0, loc); // y de vuelta al suelo en `loc`
    return st;
  };

  it("🔴 #149 enterrada en un PUEBLO: NO pinta puerta en el sobremundo", () => {
    expect(moongateAt(enterradaEn(MINOC), at(1, 22), moonPhases, 77, 88, false, 0)).toBe(false);
  });

  it("#149 CONTROL: la MISMA celda con la piedra del sobremundo SÍ pinta", () => {
    // Separa «rechaza por la localización» de «rechaza siempre»: sin este control, un
    // `return false` pelado en moongateAt pasaría el caso de arriba.
    expect(moongateAt(enterradaEn(0), at(1, 22), moonPhases, 77, 88, false, 0)).toBe(true);
  });

  it("#149 CONTROL: y DENTRO de Minoc esa misma piedra SÍ pinta", () => {
    // La otra mitad: el gate no es «sólo el sobremundo», es «SU sitio».
    expect(moongateAt(enterradaEn(MINOC), at(1, 22), moonPhases, 77, 88, false, MINOC)).toBe(true);
  });
});

describe("enterrar / desenterrar", () => {
  it("desenterrar pasa la moonstone al inventario y devuelve su fase", () => {
    const state = newGame();
    const [x, y] = MOONGATE_COORDS[4]!; // Minoc, fase 4
    const phase = digUpMoonstone(state, x, y, 0);
    expect(phase).toBe(4);
    expect(state.moonstones[4]!.buried).toBe(false);
    // Ya no hay puerta ahí de noche.
    expect(moongateAt(state, at(15, 22), moonPhases, x, y, false, 0)).toBe(false);
    // Y su destino de fase 4 desaparece (está en inventario).
    expect(moongateDestination(state, at(15, 22), moonPhases)).toBeNull();
  });

  it("desenterrar en una casilla sin moonstone devuelve null", () => {
    expect(digUpMoonstone(newGame(), 1, 1, 0)).toBeNull();
  });

  it("enterrar reubica la moonstone en la nueva casilla", () => {
    const state = newGame();
    digUpMoonstone(state, 166, 19, 0); // saca la fase 4
    buryMoonstone(state, 4, 50, 60, 0xff, 0); // la entierra en el Underworld (localización 0)
    expect(state.moonstones[4]).toEqual({ x: 50, y: 60, buried: true, z: 0xff, location: 0 });
    expect(moongateAt(state, at(15, 22), moonPhases, 50, 60, true, 0)).toBe(true);
  });
});

// ── #149 · el DIBUJO no consulta la fase lunar (kernel_moongate_render 0x475a) ──────────
//
// El bucle de dibujo del binario (0x47a2-0x47e6) recorre las OCHO piedras (`si=0..7`,
// `cmp si,8` en 0x47e3) y su único predicado es 0x4702 (localización + planta + ventana):
// NINGUNA lectura de g_felucca_phase/g_trammel_phase en toda la rutina — la fase sólo
// decide el DESTINO al pisar (0x4962-0x4977). Derivación sellada: shrines.md §1.3 («De
// noche se pinta la puerta en TODAS las moonstones enterradas visibles»).
//
// El port colgaba `activeMoongates()` de `moongateDestination(...)`: con la piedra de la
// fase ACTIVA en la mochila devolvía [] y apagaba las SIETE puertas restantes.
//
// ⚠ Los esperados van EN CRUDO (coordenadas literales, no derivadas de state.moonstones):
// día 15 a las 22:00 ⇒ fase activa = Trammel = 4 (byte crudo 0x34 en DATA.OVL:0x1EEA+28)
// = la piedra de Minoc (166,19). Desenterrarla es desenterrar LA ACTIVA.
describe("#149 · Game.activeMoongates / checkMoongate (dibujo sin fase)", () => {
  /** Overworld 256×256 de hierba (5, walkable) para que move() avance. */
  const grassWorld = (): WorldData => ({
    overworld: Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5)),
    underworld: Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5)),
    smallMaps: new Map(),
  });

  const nightGame = (mutate?: (st: GameState) => void): Game => {
    const st = newGame();
    st.time = { year: 139, month: 1, day: 15, hour: 22, minute: 0 };
    // La partida nueva arranca DENTRO de la cabaña de Iolo (location != 0) y el render
    // de moongates solo corre en el sobremundo: al sobremundo antes de preguntar.
    st.position = { location: 0, floor: 0, x: 100, y: 100 };
    mutate?.(st);
    const data: GameData = {
      locationsX: [],
      locationsY: [],
      locationNames: [],
      moonPhases,
    };
    return new Game({} as ExtractedInitialState, grassWorld(), data, st);
  };

  const coords = (gates: { x: number; y: number }[]): string[] =>
    gates.map((g) => `${g.x},${g.y}`).sort();

  it("CONTROL: con las 8 enterradas, de noche hay 8 puertas (las canónicas)", () => {
    const game = nightGame();
    expect(coords(game.activeMoongates())).toEqual(
      [
        "224,133", // Moonglow (fase 0)
        "96,102", //  Britain  (fase 1)
        "38,224", //  Jhelom   (fase 2)
        "50,37", //   Yew      (fase 3)
        "166,19", //  Minoc    (fase 4 — la ACTIVA a las 22:00 del día 15)
        "104,194", // Trinsic  (fase 5)
        "23,126", //  Skara    (fase 6)
        "187,167", // Magincia (fase 7)
      ].sort(),
    );
  });

  it("🔴 desenterrar la piedra de la fase ACTIVA apaga SU puerta y solo la suya", () => {
    // Antes del fix: activeMoongates() devolvía [] — las 8 apagadas por un `if (!dest)`.
    const game = nightGame((st) => {
      expect(digUpMoonstone(st, 166, 19, 0)).toBe(4); // la de Minoc = la fase activa
    });
    expect(coords(game.activeMoongates())).toEqual(
      ["224,133", "96,102", "38,224", "50,37", "104,194", "23,126", "187,167"].sort(),
    );
  });

  it("estado-stub SIN array moonstones: activeMoongates devuelve [] y NO revienta", () => {
    // Contrato real ya documentado en buriedMoonstoneAt: hay estados-stub (parity runs,
    // snapshots de piel — los tests de la banda celeste de skin-coreview) sin el array.
    // Antes el `if (!dest) return []` salía ANTES de tocar moongatePositions y lo tapaba;
    // al retirarlo (#149), moongatePositions corre incondicional y debe tolerarlo.
    // Cazado por la batería: TypeError en moongates.ts:176 vía coreview.visField.
    const game = nightGame((st) => {
      (st as { moonstones?: unknown }).moonstones = undefined;
    });
    expect(game.activeMoongates()).toEqual([]);
  });

  it("CONTROL: de día (12:00) no hay puerta ninguna aunque estén las 8", () => {
    const game = nightGame((st) => {
      st.time = { year: 139, month: 1, day: 15, hour: 12, minute: 0 };
    });
    expect(game.activeMoongates()).toEqual([]);
  });

  // ── el pisar con la piedra activa en la mochila: la puerta se CIERRA sin teleporte ──
  // kernel_moongate_enter corre TODA la presentación (sonido 0x48e5 · disolución 0x1068 ·
  // cierre 0x4912-0x492b · tile 5 en 0x493c) ANTES de llamar al teleport 0x47f4, y éste
  // devuelve 0 SIN tocar estado si `[bx+0x5840] == 0xff` (0x47fd). ⇒ el party se queda
  // sobre la casilla, con la misma presentación que el edge de medianoche.
  it("🔴 pisar una puerta con la piedra ACTIVA en la mochila: cierra, suena y NO teleporta", () => {
    const hookCalls: boolean[] = [];
    const game = nightGame((st) => {
      digUpMoonstone(st, 166, 19, 0); // fase 4 (activa) a la mochila
      st.position = { location: 0, floor: 0, x: 95, y: 102 }; // al oeste de Britain (96,102)
    });
    game.setMoongateTransitHook((t) => hookCalls.push(t));
    const events = game.move("east"); // pisa la puerta de la piedra 1 (Britain)
    expect(game.state.position.x).toBe(96); // sigue SOBRE la puerta…
    expect(game.state.position.y).toBe(102); // …no en (166,19) ni en ningún otro sitio
    expect(hookCalls).toEqual([false]); // presentación de cierre SIN fase de llegada
    expect(events.some((e) => e.kind === "sfx" && e.sfx?.id === "moongate")).toBe(true);
  });

  it("CONTROL: con la piedra activa enterrada, pisar esa misma puerta SÍ teleporta a Minoc", () => {
    const hookCalls: boolean[] = [];
    const game = nightGame((st) => {
      st.position = { location: 0, floor: 0, x: 95, y: 102 };
    });
    game.setMoongateTransitHook((t) => hookCalls.push(t));
    game.move("east");
    expect(game.state.position.x).toBe(166); // destino = piedra de la fase 4 (Minoc)
    expect(game.state.position.y).toBe(19);
    expect(hookCalls).toEqual([true]);
  });
});

// ── #352 · la FÍSICA de la moongate escribe LOCATION (0x48a8 → 0x4977 call 0x47f4) ──────
//
// Derivación (ULTIMA.EXE.asm):
//  · El predicado de «¿hay puerta pisable?» del binario es el TILE: 0x48b3-0x48bd empuja
//    g_party_x/g_party_y y llama a get_tile_ptr (0x4402); 0x48c2 `cmp byte [bx], 0xdc` —
//    la física CONSUME el tile que escribió el render (0x47d2, bajo el predicado por
//    piedra 0x4702: location + floor + ventana). Física y dibujo comparten predicado POR
//    CONSTRUCCIÓN (fuente única); el port lo calca compartiendo `moongateAt`.
//  · El destino NO es un (x,y) pelado: 0x4962-0x4976 elige la fase (Felucca si hour<0xc,
//    Trammel si no, byte −0x30) y 0x4977 hace `call 0x47f4` = kernel_moongate_teleport —
//    LA MISMA rutina que Vas Rel Por (#341) — que escribe los CUATRO campos desde la
//    piedra: 0x4841 g_location · 0x4848 g_party_x · 0x484f g_party_y · 0x4856 g_floor.
//
// El cabo #352: el port pasaba por `moongateDestination`, que DESCARTA `location` — la
// puerta física nunca te cambiaba de localización aunque la piedra de la fase activa
// estuviera enterrada dentro de un pueblo.
//
// ⚠ Esperados EN CRUDO: día 15 · 22:00 ⇒ fase activa = Trammel = 4 (byte 0x34 de
// DATA.OVL:0x1EEA). El pueblo destino es la location 14 (0x0E) y la piedra se re-entierra
// en (10, 12) — literales, no derivados del sujeto.
describe("#352 · checkMoongate — la física escribe location (0x4977 → 0x47f4)", () => {
  const TOWN = 0x0e;

  /** Mundo de hierba CON un small map para el pueblo destino (el teleport lo carga). */
  const worldWithTown = (): WorldData => {
    const tiles32 = () => Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
    return {
      overworld: Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5)),
      underworld: Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5)),
      smallMaps: new Map([[TOWN, { id: TOWN, name: "Pueblo", floors: [{ z: 0, tiles: tiles32() }] }]]),
    };
  };

  const nightGameWithTown = (mutate?: (st: GameState) => void): Game => {
    const st = newGame();
    st.time = { year: 139, month: 1, day: 15, hour: 22, minute: 0 };
    st.position = { location: 0, floor: 0, x: 95, y: 102 }; // al oeste de Britain (96,102)
    mutate?.(st);
    const data: GameData = {
      locationsX: Array.from({ length: 32 }, () => 100),
      locationsY: Array.from({ length: 32 }, () => 100),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
      moonPhases,
    };
    return new Game({} as ExtractedInitialState, worldWithTown(), data, st);
  };

  it("🔴 piedra ACTIVA re-enterrada en un pueblo: pisar la puerta te mete EN el pueblo", () => {
    // Antes del fix: el party aterrizaba en (10,12) del SOBREMUNDO con location 0.
    const hookCalls: boolean[] = [];
    const game = nightGameWithTown((st) => {
      expect(digUpMoonstone(st, 166, 19, 0)).toBe(4); // la piedra de la fase ACTIVA…
      buryMoonstone(st, 4, 10, 12, 0, TOWN); // …re-enterrada DENTRO de la location 14
    });
    game.setMoongateTransitHook((t) => hookCalls.push(t));
    game.move("east"); // pisa la puerta de la piedra 1 (Britain, 96,102, location 0)
    expect(game.state.position.location).toBe(0x0e); // 0x4841: g_location DESDE la piedra
    expect(game.state.position.x).toBe(10); // 0x4848
    expect(game.state.position.y).toBe(12); // 0x484f
    expect(game.state.position.floor).toBe(0); // 0x4856
    expect(game.activeMap.kind).toBe("small"); // y el mapa activo es el del pueblo
    expect(hookCalls).toEqual([true]);
  });

  it("pisar donde el DIBUJO dice no-hay-puerta (piedra de otro sitio) NO teleporta", () => {
    // La celda (166,19) del sobremundo tiene la piedra 4 — pero enterrada EN el pueblo
    // (location 14 ≠ 0): el mismo predicado que apaga el dibujo (0x4702/0x4713 vía
    // moongateAt) niega la física. El party simplemente camina la casilla.
    const hookCalls: boolean[] = [];
    const game = nightGameWithTown((st) => {
      digUpMoonstone(st, 166, 19, 0);
      buryMoonstone(st, 4, 166, 19, 0, TOWN); // mismas (x,y), OTRA localización
      st.position = { location: 0, floor: 0, x: 165, y: 19 };
    });
    game.setMoongateTransitHook((t) => hookCalls.push(t));
    const events = game.move("east");
    expect(game.state.position.x).toBe(166); // caminó la casilla…
    expect(game.state.position.y).toBe(19);
    expect(game.state.position.location).toBe(0); // …sin teleport ni cambio de localización
    expect(hookCalls).toEqual([]); // ni presentación de cruce
    expect(events.some((e) => e.kind === "sfx" && e.sfx?.id === "moongate")).toBe(false);
  });

  it("CONTROL: piedra activa en el SOBREMUNDO — teleporta y location QUEDA en 0", () => {
    // Separa «escribe location desde la piedra» de «carga un pueblo siempre»: con la
    // piedra 4 de fábrica (166,19, location 0) el viaje es sobremundo→sobremundo y el
    // stream de eventos del move es EL MISMO que antes del fix (guarda de la ventana:
    // ningún tour/digest puede moverse por este camino con el corpus de fábrica).
    const game = nightGameWithTown();
    const events = game.move("east");
    expect(game.state.position.location).toBe(0);
    expect(game.state.position.x).toBe(166);
    expect(game.state.position.y).toBe(19);
    expect(game.activeMap.kind).toBe("overworld");
    expect(events.map((e) => e.kind)).toEqual(["walk-echo", "moved", "sfx", "sfx", "map-changed"]);
    expect(events.filter((e) => e.kind === "sfx").map((e) => e.sfx?.id)).toEqual(["move-step", "moongate"]);
  });
});
