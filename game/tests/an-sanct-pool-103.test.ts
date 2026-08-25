/**
 * #103 — An Sanct sobre la TABLA DE OBJETOS (la rama bloqueada de #286 §4, ahora
 * portada sobre el pool unificado): CAST.OVL:0x03de-0x0432.
 *
 * El binario, en el camino 0x398 (pueblo/exterior), si el tile apuntado no es puerta
 * CAE al barrido de las 32 ranuras del pool DS:0x5C5A buscando `+0 == 1` (cofre) en
 * la celda apuntada (`0x3f2`/`0x3fb` vs g_cmb_scratch_x/y) con `+4 == g_floor`
 * (`0x40b`, fuera de combate); el acierto hace `and [si+5],0x7f` (`0x410`) — desarma
 * la trampa INCONDICIONALMENTE, haya bit o no — y devuelve 1 ⇒ "Success!" (cola
 * 0x11a6, DS 0x4656). Sin acierto: 0 ⇒ "Failed!" (DS 0x4660). CERO RNG en la rama.
 *
 * En el port el cofre-objeto vive en `state.worldObjects` (kind "chest",
 * `contents` bit 0x80 = trampa, espejo `trapped`) y el barrido corre sobre la vista
 * compuesta del pool (`actorPool.composeWorldPool` + `anSanctObjectSweep`).
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState, WorldObject } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";

function makeChar(): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}
function makeState(over: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, magicCarpets: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0, position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12, wind: 0,
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    worldObjects: [],
    ...over,
  } as GameState;
}
function grassWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(5));
  return { overworld, underworld: overworld, smallMaps: new Map() };
}
const gameData: GameData = { locationsX: [], locationNames: [], locationsY: [] };
function makeGame(s: GameState): Game {
  return new Game({} as ExtractedInitialState, grassWorld(), gameData, s, {});
}
/** Cofre-objeto del mundo en (x,y) del sobremundo con `contents` dado. */
function chestAt(x: number, y: number, contents: number, floor = 0): WorldObject {
  return {
    location: 0, floor, x, y,
    tile: 0x101, // banco alto; byte +0 de la tabla = 1 (el kind que 0x3e8 acepta)
    kind: "chest",
    contents,
    trapped: (contents & 0x80) !== 0,
  };
}
function mensajes(events: { kind: string; text?: string }[]): string[] {
  return events.flatMap((e) => (e.kind === "message" && e.text ? [e.text] : []));
}

describe("#103 An Sanct — barrido de la tabla de objetos (CAST 0x03de-0x0432)", () => {
  it("cofre TRAMPEADO apuntado: 'Success!' y el bit 0x80 de contents se limpia (0x410)", () => {
    const st = makeState();
    const chest = chestAt(100, 99, 0x88); // norte del party; trampa + contenido 8
    st.worldObjects!.push(chest);
    const g = makeGame(st);
    const ev = g.applyUnlockSpell("north");
    expect(mensajes(ev)).toContain("Success!"); // res 1 → cola 0x11a6, DS 0x4656
    expect(chest.contents).toBe(0x08); // and [si+5],0x7f — el contenido sobrevive
    expect(chest.trapped).toBe(false);
  });

  it("cofre SIN trampa apuntado: también 'Success!' (0x410 es incondicional) y contents intacto", () => {
    const st = makeState();
    const chest = chestAt(100, 99, 0x08);
    st.worldObjects!.push(chest);
    const g = makeGame(st);
    const ev = g.applyUnlockSpell("north");
    expect(mensajes(ev)).toContain("Success!");
    expect(chest.contents).toBe(0x08);
  });

  it("cofre en OTRA celda: 'Failed!' y la trampa queda armada (0x3f2/0x3fb)", () => {
    const st = makeState();
    const chest = chestAt(103, 99, 0x88); // no es la celda apuntada
    st.worldObjects!.push(chest);
    const g = makeGame(st);
    const ev = g.applyUnlockSpell("north");
    expect(mensajes(ev)).toContain("Failed!"); // res 0 → DS 0x4660
    expect(chest.contents).toBe(0x88);
  });

  it("cofre en OTRA planta: 'Failed!' — el check +4 == g_floor corre fuera de combate (0x40b)", () => {
    const st = makeState();
    const chest = chestAt(100, 99, 0x88, 1); // misma celda, planta 1 (party en 0)
    st.worldObjects!.push(chest);
    const g = makeGame(st);
    const ev = g.applyUnlockSpell("north");
    expect(mensajes(ev)).toContain("Failed!");
    expect(chest.contents).toBe(0x88);
  });

  it("objeto que NO es cofre en la celda (caballo, +0=0x10): 'Failed!' (0x3e8 sólo acepta 1)", () => {
    const st = makeState();
    st.worldObjects!.push({
      location: 0, floor: 0, x: 100, y: 99, tile: 0x110, kind: "horse",
    });
    const g = makeGame(st);
    const ev = g.applyUnlockSpell("north");
    expect(mensajes(ev)).toContain("Failed!");
  });

  it("sin objeto ninguno: 'Failed!' (el barrido agota las 32 ranuras, 0x42c)", () => {
    const st = makeState();
    const g = makeGame(st);
    expect(mensajes(g.applyUnlockSpell("north"))).toContain("Failed!");
  });
});
