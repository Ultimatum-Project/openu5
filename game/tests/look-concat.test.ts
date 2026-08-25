/**
 * (L)ook — concatenación look_generic + texto especial (LOOKOBJ look_dispatch 0x0502),
 * ejercitada por el camino REAL de `Game.look()` con los mapas y LOOK2.DAT del original.
 *
 * El asm llama a look_generic (la frase base de LOOK2.DAT) INCONDICIONALMENTE para
 * reloj(0xFA/FB)/Flame(0xDE)/mazmorra(0xDF) y CONCATENA después el texto dinámico
 * (hora/virtud/rama). Cielo(0x59)/pozo(0xA1)/fuente saltan look_generic. Verificamos:
 *  - reloj y Flame producen "Thou dost see <LOOK2>" + sufijo;
 *  - la frase base sale de LOOK2 (dato), NO de un literal hardcodeado — inyectando un
 *    LOOK2 centinela y comprobando que el genérico cambia con el dato;
 *  - el cielo REEMPLAZA (no concatena): un LOOK2 centinela para 0x59 NO aparece.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
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

const gameData = (look2: string[]): GameData => ({
  locationsX: Array.from({ length: 33 }, () => 250),
  locationsY: Array.from({ length: 33 }, () => 250),
  locationNames: Array.from({ length: 33 }, (_, i) => `Loc${i}`),
  look2,
});

/** Mira al ESTE hacia (x,y) desde (x-1,y) en un mapa/floor y devuelve el texto. */
function lookEast(
  location: number,
  floor: number,
  target: { x: number; y: number },
  look2: string[],
  patch?: (s: GameState) => void,
): string {
  const state: GameState = createNewGame(init);
  state.position = { location, floor, x: target.x - 1, y: target.y };
  patch?.(state);
  const game = new Game(init, world, gameData(look2), state, {
    npcManager: new NpcManager(npcData),
    doors: new DoorManager(),
  });
  const events = game.look("east");
  const msg = events.find((e) => e.kind === "message") as { text: string } | undefined;
  return msg?.text ?? "";
}

/** Como `lookEast` pero devuelve los eventos y el estado mutado (para el daño del sol). */
function lookEastState(
  location: number,
  floor: number,
  target: { x: number; y: number },
  look2: string[],
  patch?: (s: GameState) => void,
): { events: GameEvent[]; state: GameState } {
  const state: GameState = createNewGame(init);
  state.position = { location, floor, x: target.x - 1, y: target.y };
  patch?.(state);
  const game = new Game(init, world, gameData(look2), state, {
    npcManager: new NpcManager(npcData),
    doors: new DoorManager(),
  });
  const events = game.look("east");
  return { events, state };
}

// Tiles reales confirmados en smallmaps.json:
//  · reloj 0xFA  → Castillo LB (loc 17), floor z=1, (12,19)
//  · Flame 0xDE  → Lycaeum (loc 30 = 0x1e → "Truth"), floor z=2, (15,8)
//  · cielo 0x59  → Moonglow (loc 1), floor z=1, (17,13)
const CLOCK = { loc: 17, z: 1, at: { x: 12, y: 19 } };
const FLAME = { loc: 30, z: 2, at: { x: 15, y: 8 } };
const SKY = { loc: 1, z: 1, at: { x: 17, y: 13 } };

describe("reloj (0xFA) — Game.look concatena genérico(LOOK2) + hora", () => {
  it("14:30 → 'Thou dost see <LOOK2 reloj>2:30 PM.'", () => {
    const text = lookEast(CLOCK.loc, CLOCK.z, CLOCK.at, look2Real, (s) => {
      s.time.hour = 14;
      s.time.minute = 30;
    });
    expect(text).toBe(`Thou dost see ${look2Real[0xfa]}2:30 PM.`);
    // "2 líneas": debe contener AMBAS partes (genérico + hora), no sólo la especial.
    expect(text).toContain("grandfather clock");
    expect(text).toContain("2:30 PM.");
  });

  it("la frase genérica sale de LOOK2 (dato), no de un literal — centinela", () => {
    const look2 = look2Real.slice();
    look2[0xfa] = "a SENTINEL device @@ ";
    const text = lookEast(CLOCK.loc, CLOCK.z, CLOCK.at, look2, (s) => {
      s.time.hour = 14;
      s.time.minute = 30;
    });
    expect(text).toBe("Thou dost see a SENTINEL device @@ 2:30 PM.");
  });
});

describe("Flame (0xDE) — Game.look concatena genérico(LOOK2) + virtud", () => {
  it("Lycaeum (loc 0x1e) → '...the Flame of Truth'", () => {
    const text = lookEast(FLAME.loc, FLAME.z, FLAME.at, look2Real);
    expect(text).toBe(`Thou dost see ${look2Real[0xde]}Truth`);
    expect(text).toContain("Flame of");
    expect(text).toContain("Truth");
  });

  it("la virtud se concatena a la frase LOOK2 del dato — centinela", () => {
    const look2 = look2Real.slice();
    look2[0xde] = "the Torch of ";
    const text = lookEast(FLAME.loc, FLAME.z, FLAME.at, look2);
    expect(text).toBe("Thou dost see the Torch of Truth");
  });
});

describe("cielo (0x59) — REEMPLAZA look_generic (NO concatena) — regresión", () => {
  it("día → 'Thou dost see the sun!' e IGNORA el LOOK2 del tile", () => {
    const look2 = look2Real.slice();
    look2[0x59] = "SENTINEL-SKY-SHOULD-NOT-APPEAR";
    const text = lookEast(SKY.loc, SKY.z, SKY.at, look2, (s) => {
      s.time.hour = 12;
      s.time.minute = 0;
    });
    expect(text).toBe("Thou dost see the sun!");
    expect(text).not.toContain("SENTINEL");
  });
});

// Mirar al SOL DAÑA (LOOKOBJ look_sky 0x0383-0x03a4): de día, apply_damage(activo, 1) —
// HP literal, sin RNG, puede MATAR (a 1 HP → status 'D' + deselección del activo). De
// noche ("the night sky!") NO daña. El daño vive en Game.look() (no en la pura), así que
// look.test.ts (que sólo ejercita lookSpecialDescription) sigue intacto.
describe("cielo (0x59) — mirar al sol DAÑA al personaje activo (look_sky 0x0383)", () => {
  it("de día resta 1 HP al personaje activo y emite party-changed", () => {
    const { events, state } = lookEastState(SKY.loc, SKY.z, SKY.at, look2Real, (s) => {
      s.time.hour = 12;
      s.time.minute = 0;
      s.activeCharacter = 0;
      s.characters[0]!.currentHp = 10;
    });
    expect(state.characters[0]!.currentHp).toBe(9);
    expect(events.some((e) => e.kind === "party-changed")).toBe(true);
    expect(events.some((e) => e.kind === "message" && e.text === "Thou dost see the sun!")).toBe(true);
  });

  it("de noche (the stars) NO daña", () => {
    const { events, state } = lookEastState(SKY.loc, SKY.z, SKY.at, look2Real, (s) => {
      s.time.hour = 2; // < 6 → noche
      s.time.minute = 0;
      s.activeCharacter = 0;
      s.characters[0]!.currentHp = 10;
    });
    expect(state.characters[0]!.currentHp).toBe(10);
    expect(events.some((e) => e.kind === "party-changed")).toBe(false);
  });

  it("a 1 HP el sol MATA: HP→0, status 'D' y deselecciona al activo", () => {
    const { state } = lookEastState(SKY.loc, SKY.z, SKY.at, look2Real, (s) => {
      s.time.hour = 12;
      s.time.minute = 0;
      s.activeCharacter = 0;
      s.characters[0]!.currentHp = 1;
    });
    expect(state.characters[0]!.currentHp).toBe(0);
    expect(state.characters[0]!.status).toBe("D");
    expect(state.activeCharacter).toBe(0xff); // apply_damage deselecciona al morir el activo
  });

  it("sin activo (0xff) el daño cae en el miembro 0 (fallback g_active_char)", () => {
    const { state } = lookEastState(SKY.loc, SKY.z, SKY.at, look2Real, (s) => {
      s.time.hour = 12;
      s.time.minute = 0;
      s.activeCharacter = 0xff;
      s.characters[0]!.currentHp = 10;
    });
    expect(state.characters[0]!.currentHp).toBe(9);
  });
});
