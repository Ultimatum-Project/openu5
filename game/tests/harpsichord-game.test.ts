/**
 * Clavicémbalo — integración a nivel Game (task #54 G2). Sentarse en la silla del
 * Castillo de Lord British (loc 17) floor 2 y tocar. Ver
 * re/notes/interactions-piano-fire-audit.md §1.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import type { WorldData, SmallMapLocation } from "../src/core/world/map.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { HARPSICHORD_MELODY } from "../src/core/world/harpsichord.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readJson = <T>(p: string): T => JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

const CASTLE_LB = 17;
// Silla (0x92) al norte del clavicémbalo (0x8D) en LB floor 2 (17,18).
const CHAIR = { x: 17, y: 17 };

let world: WorldData;
let init: ExtractedInitialState;
let npcData: Record<number, NpcSlot[]>;

beforeAll(() => {
  const smallMapsRaw = readJson<SmallMapLocation[]>("maps/smallmaps.json");
  world = {
    overworld: readJson("maps/overworld.json"),
    underworld: readJson("maps/underworld.json"),
    smallMaps: new Map(smallMapsRaw.map((l) => [l.id, l])),
  };
  init = readJson("initial-state.json");
  npcData = readJson<Record<number, NpcSlot[]>>("npcs.json");
});

const gameData = (): GameData => ({
  locationsX: Array.from({ length: 33 }, () => 250),
  locationsY: Array.from({ length: 33 }, () => 250),
  locationNames: Array.from({ length: 33 }, (_, i) => `Loc${i}`),
  look2: [],
});

function gameAt(floor: number, x: number, y: number): Game {
  const state: GameState = createNewGame(init);
  state.position = { location: CASTLE_LB, floor, x, y };
  return new Game(init, world, gameData(), state, {
    npcManager: new NpcManager(npcData),
    doors: new DoorManager(),
  });
}

describe("clavicémbalo — Game (LB castle floor 2)", () => {
  it("harpsichordSeated: true en la silla (17,17), false una casilla más al norte", () => {
    expect(gameAt(2, CHAIR.x, CHAIR.y).harpsichordSeated()).toBe(true);
    expect(gameAt(2, CHAIR.x, CHAIR.y - 1).harpsichordSeated()).toBe(false);
  });

  it("harpsichordSeated: false en overworld", () => {
    const g = gameAt(2, CHAIR.x, CHAIR.y);
    g.state.position = { location: 0, floor: 0, x: 80, y: 80 };
    expect(g.harpsichordSeated()).toBe(false);
  });

  it("tocar una nota emite el cue instrument-note y NO consume turno", () => {
    const g = gameAt(2, CHAIR.x, CHAIR.y);
    const minute = g.state.time.minute;
    const ev = g.playHarpsichordNote(7);
    expect(ev.some((e) => e.kind === "sfx" && e.sfx?.id === "instrument-note" && e.sfx?.n === 7)).toBe(true);
    expect(g.state.time.minute).toBe(minute); // sin advance_clock
  });

  it("la melodía completa revela el pasadizo (por-sesión) en LB floor 2", () => {
    const g = gameAt(2, CHAIR.x, CHAIR.y);
    expect(g.harpsichordPassageRevealed).toBe(false);
    for (const d of HARPSICHORD_MELODY) g.playHarpsichordNote(d);
    expect(g.harpsichordPassageRevealed).toBe(true);
  });

  it("el muro secreto (17,13) pasa de StoneBrickWall 0x4F a BrickFloor 0x44 al tocar la melodía", () => {
    const g = gameAt(2, CHAIR.x, CHAIR.y);
    expect(g.activeMap.tileAt(17, 13)).toBe(0x4f); // muro antes
    for (const d of HARPSICHORD_MELODY) g.playHarpsichordNote(d);
    expect(g.activeMap.tileAt(17, 13)).toBe(0x44); // suelo (pasadizo abierto)
  });

  it("completar la melodía emite el TERREMOTO (quake + sfx 'quake') junto al map-changed", () => {
    const g = gameAt(2, CHAIR.x, CHAIR.y);
    let last: ReturnType<Game["playHarpsichordNote"]> = [];
    for (const d of HARPSICHORD_MELODY) last = g.playHarpsichordNote(d);
    // La última nota (que completa) lleva el terremoto.
    expect(last.some((e) => e.kind === "quake")).toBe(true);
    expect(last.some((e) => e.kind === "sfx" && e.sfx?.id === "quake")).toBe(true);
    expect(last.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("una nota que NO completa la melodía no emite terremoto", () => {
    const g = gameAt(2, CHAIR.x, CHAIR.y);
    const ev = g.playHarpsichordNote(HARPSICHORD_MELODY[0]); // solo la 1ª
    expect(ev.some((e) => e.kind === "quake")).toBe(false);
  });

  it("el pasadizo NO se abre en otra planta aunque suene la melodía", () => {
    const g = gameAt(0, CHAIR.x, CHAIR.y); // floor 0, no gate
    for (const d of HARPSICHORD_MELODY) g.playHarpsichordNote(d);
    expect(g.harpsichordPassageRevealed).toBe(false);
    // floor 0 (17,13) intacto (no lo tocamos)
  });

  it("la melodía NO revela nada fuera de LB floor 2 (p.ej. floor 0)", () => {
    // Sembramos una silla+clavicémbalo virtual no hace falta: playHarpsichordNote no
    // exige estar sentado (el gate de asiento es del enrutado en main.ts); aquí sólo
    // comprobamos el gate location/floor del SECRETO.
    const g = gameAt(0, CHAIR.x, CHAIR.y);
    for (const d of HARPSICHORD_MELODY) g.playHarpsichordNote(d);
    expect(g.harpsichordPassageRevealed).toBe(false);
  });
});
