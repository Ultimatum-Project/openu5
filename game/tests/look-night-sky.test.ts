/**
 * #321 — (L)ook al cielo (tile 0x59) DE NOCHE abre el firmamento, no sólo la frase.
 *
 * DERIVACIÓN (LOOKOBJ.OVL, disasm en re/disasm/LOOKOBJ.OVL.asm):
 *  · `look_dispatch` 0x0502 despacha por TILE y SIN MÁS GATE: `0558 cmp si,0x59` ·
 *    `055d call 0x366` (look_sky) · `0560 jmp 0x69c` (epílogo). El catalejo NO es la
 *    única puerta a la vista celeste: (L)ook sobre el tile la abre por este camino.
 *  · `look_sky` 0x0366 parte el día de la noche con DOS saltos: `036e cmp [g_hour],6`
 *    + `jb 0x3aa` y `0375 cmp [g_hour],0x12` + `jae 0x3aa` ⇒ NOCHE = h<6 || h>=18.
 *  · Rama DÍA (0x037c+): imprime DS 0x72f0 "the sun!\n" y DAÑA 1 HP al activo.
 *  · Rama NOCHE (0x03aa+): limpia las 121 celdas del búfer a 0xFF, planta el trípode
 *    `03d8 mov byte [g_vis_buffer+325], 0x59`, compone (0x03dd), pinta 80 estrellas
 *    (0x03ea, `si=0x50`, dos rand_range por estrella) y el zodíaco de 8 signos
 *    (0x0410-0x04e7), imprime DS 0x72fa "the night sky! " (0x04ea) y espera tecla.
 *
 * Los esperados van EN CRUDO (80 estrellas, 8 signos, 160 tiradas, las cuatro cotas
 * horarias, las tres coordenadas de telescopio) — ninguno se calcula desde el sujeto.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import { useSpyglass, type UseToolsCtx } from "../src/core/endgame/use-tools.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import type { WorldData, SmallMapLocation } from "../src/core/world/map.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readJson = <T>(p: string): T => JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

let world: WorldData;
let init: ExtractedInitialState;
let npcData: Record<number, NpcSlot[]>;
let look2Real: string[];

beforeAll(() => {
  const smallMapsRaw = readJson<SmallMapLocation[]>("maps/smallmaps.json");
  world = {
    overworld: readJson("maps/overworld.json"),
    underworld: readJson("maps/underworld.json"),
    smallMaps: new Map(smallMapsRaw.map((l) => [l.id, l])),
  };
  init = readJson("initial-state.json");
  npcData = readJson<Record<number, NpcSlot[]>>("npcs.json");
  look2Real = readJson<string[]>("look2.json");
});

const gameData = (): GameData => ({
  locationsX: Array.from({ length: 33 }, () => 250),
  locationsY: Array.from({ length: 33 }, () => 250),
  locationNames: Array.from({ length: 33 }, (_, i) => `Loc${i}`),
  look2: look2Real,
});

/** Mira al ESTE hacia (x,y) desde (x-1,y) a la hora dada y devuelve eventos + juego. */
function lookAt(
  location: number,
  floor: number,
  target: { x: number; y: number },
  hour: number,
): { events: GameEvent[]; game: Game } {
  const state: GameState = createNewGame(init);
  state.position = { location, floor, x: target.x - 1, y: target.y };
  state.time.hour = hour;
  state.time.minute = 0;
  const game = new Game(init, world, gameData(), state, {
    npcManager: new NpcManager(npcData),
    doors: new DoorManager(),
  });
  return { events: game.look("east"), game };
}

const zodiacOf = (events: GameEvent[]) => events.find((e) => e.kind === "zodiac-view");

// Los TRES tiles 0x59 del juego — censo COMPLETO de maps/smallmaps.json (overworld,
// underworld y dungeons dan CERO). Coordenadas en crudo; son el alcance real del fix.
// 🔴 La planta es el campo `z`, NO el índice del array `floors`: los mapas con sótano
// arrancan por debajo de 0 y los dos números se separan. El primer censo de este carril
// leyó el índice y puso z=4 en el castillo, que no existe (getActiveMap aborta nombrando
// la planta que falta — el rojo era del dato, no del port).
const TELESCOPES = [
  { name: "Moonglow", loc: 1, z: 1, at: { x: 17, y: 13 } },
  { name: "Skara Brae", loc: 7, z: 1, at: { x: 16, y: 14 } },
  { name: "Lord British's Castle", loc: 17, z: 3, at: { x: 16, y: 14 } },
];
const SKY = TELESCOPES[0]!;
// Control de TILE: el reloj de pie (0xFA) del castillo — también es un especial del
// MISMO dispatch, así que separa «es de noche» de «es el tile del cielo».
const CLOCK = { loc: 17, z: 1, at: { x: 12, y: 19 } };

describe("#321 — (L)ook al cielo de noche EMITE la vista celeste", () => {
  it("de noche: mensaje + zodiac-view con 80 estrellas y 8 signos", () => {
    const { events } = lookAt(SKY.loc, SKY.z, SKY.at, 22);
    expect(events.map((e) => e.kind)).toEqual(["message", "zodiac-view"]);
    const msg = events[0] as { text: string };
    expect(msg.text).toBe("Thou dost see the night sky!");
    const zv = zodiacOf(events);
    expect(zv?.zodiacView?.bgStars).toHaveLength(80); // look_sky 0x03ef: si = 0x50
    expect(zv?.zodiacView?.signs).toHaveLength(8); // bucle 0x0410-0x04e7: i = 0..7
  });

  it("de DÍA no hay vista: la rama diurna imprime 'the sun!' y daña (0x037c-0x03a4)", () => {
    const { events } = lookAt(SKY.loc, SKY.z, SKY.at, 12);
    expect(zodiacOf(events)).toBeUndefined();
    expect((events[0] as { text: string }).text).toBe("Thou dost see the sun!");
    expect(events.map((e) => e.kind)).toContain("party-changed"); // el daño solar sigue
  });

  it("las CUATRO cotas del gate horario, en crudo (h<6 || h>=18 = noche)", () => {
    const hay = (h: number) => zodiacOf(lookAt(SKY.loc, SKY.z, SKY.at, h).events) !== undefined;
    expect(hay(5)).toBe(true); // 0x036e `cmp [g_hour],6` + `jb` → noche
    expect(hay(6)).toBe(false); // el 6 NO salta: es día
    expect(hay(17)).toBe(false); // 0x0375 `cmp [g_hour],0x12` — el 17 no llega al `jae`
    expect(hay(18)).toBe(true); // 0x12 = 18: `jae` → noche
  });

  it("los TRES telescopios del juego abren la vista (censo completo de los mapas)", () => {
    for (const t of TELESCOPES) {
      const { events } = lookAt(t.loc, t.z, t.at, 22);
      expect(zodiacOf(events), `${t.name} de noche`).toBeDefined();
    }
  });

  it("control de TILE: el reloj de noche NO abre la vista (es el 0x59, no la hora)", () => {
    const { events } = lookAt(CLOCK.loc, CLOCK.z, CLOCK.at, 22);
    expect(zodiacOf(events)).toBeUndefined();
    expect((events[0] as { text: string }).text).toContain("10:00 PM.");
  });
});

describe("#321 — el consumo de RNG de la vista", () => {
  afterEach(() => {
    delete (globalThis as { __u5rng?: unknown }).__u5rng;
  });

  /** Pasos del generador que consume UN (L)ook, medidos con la sonda de rng-original. */
  function rngSteps(location: number, floor: number, at: { x: number; y: number }, hour: number) {
    const probe = { n: 0, seed: 0 };
    (globalThis as { __u5rng?: { n: number; seed: number } }).__u5rng = probe;
    lookAt(location, floor, at, hour);
    return probe.n;
  }

  it("la vista cuesta 160 tiradas: 80 estrellas × rand_range(9,182) + rand_range(9,172)", () => {
    // El DELTA contra el mismo comando sobre un tile sin vista aísla al zodíaco: lo que
    // consuma el resto de (L)ook (si consume algo) está en los dos lados y se cancela.
    const conVista = rngSteps(SKY.loc, SKY.z, SKY.at, 22);
    const sinVista = rngSteps(CLOCK.loc, CLOCK.z, CLOCK.at, 22);
    expect(conVista - sinVista).toBe(160);
  });

  it("de día el (L)ook al cielo consume lo mismo que un (L)ook sin vista", () => {
    expect(rngSteps(SKY.loc, SKY.z, SKY.at, 12)).toBe(rngSteps(CLOCK.loc, CLOCK.z, CLOCK.at, 12));
  });
});

describe("#321 — la ASIMETRÍA de las 18:00 entre las DOS puertas a la misma vista", () => {
  /**
   * El binario llega a la MISMA rama nocturna de `look_sky` por dos caminos, y cada uno
   * trae SU PROPIO corte horario — que no coinciden:
   *  · `look_sky` (LOOKOBJ 0x0375): `cmp [g_hour],0x12` + `jae 0x3aa` ⇒ el 18 es NOCHE.
   *  · `useSpyglass` (CAST 0x1a56): `cmp [g_hour],0x12` + `jbe 0x1a6a` ⇒ el 18 es DÍA.
   * ⇒ a las 18:00, en 1988, (L)ook al telescopio enseña el firmamento y el catalejo
   * responde "No stars!". El port reproduce las dos mitades por separado y esta guarda
   * existe para que nadie las «armonice» creyendo que corrige una incoherencia del clon:
   * la incoherencia es DEL ORIGINAL, y calcarla es la conducta fiel.
   */
  function spyglassCtx(state: GameState): UseToolsCtx {
    // El gate horario del catalejo no toca mapa ni transporte: con el ctx mínimo el
    // aserto queda sobre la ÚNICA variable que se está midiendo (la hora).
    return {
      state,
      dungeonState: null,
      rand: () => 0,
      mapTileWithOverrides: () => 0,
      setMapOverride: () => {},
      setVolatileTerrain: () => {},
      syncTransportFromTile: () => {},
    };
  }

  /** Catalejo en superficie de pueblo (pasa el gate de localización de CAST 0x1a41). */
  function spyglassAt(hour: number): GameEvent[] {
    const state: GameState = createNewGame(init);
    state.position = { location: SKY.loc, floor: SKY.z, x: 10, y: 10 };
    state.time.hour = hour;
    state.time.minute = 0;
    return useSpyglass(spyglassCtx(state));
  }

  it("a las 18:00 el (L)ook ENSEÑA el firmamento y el catalejo dice 'No stars!'", () => {
    expect(zodiacOf(lookAt(SKY.loc, SKY.z, SKY.at, 18).events)).toBeDefined();
    const spy = spyglassAt(18);
    expect(spy.map((e) => (e as { text?: string }).text)).toEqual(["Spyglass", "No stars!"]);
    expect(spy.find((e) => e.kind === "zodiac-view")).toBeUndefined();
  });

  it("a las 19:00 las DOS puertas abren la vista — el desacuerdo es de UNA hora", () => {
    // Control que ACOTA la asimetría. Sin él, el aserto de arriba se leería como «el
    // catalejo nunca enseña nada», que es una afirmación distinta y falsa.
    expect(zodiacOf(lookAt(SKY.loc, SKY.z, SKY.at, 19).events)).toBeDefined();
    expect(spyglassAt(19).find((e) => e.kind === "zodiac-view")).toBeDefined();
  });
});
