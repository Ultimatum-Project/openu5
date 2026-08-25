/**
 * (L)ook fiel a cmd_look (LOOKOBJ 0x099c) con los assets REALES: describe el tile
 * COMPOSITADO de la casilla (el actor tapa al terreno) vía LOOK2.DAT, SIN el atajo
 * inventado "citizen of Britannia". Un cofre-NPC → "a chest", un guardia → "a guard",
 * un cadáver → "a corpse". Bug original: docs/superpowers/specs/2026-07-11-soak-findings
 * (#F13-2). Cita del compositado: re/notes/lookobj.md:8-18.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import { NpcManager, type NpcSlot, type NpcRuntime } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import type { WorldData, SmallMapLocation } from "../src/core/world/map.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import type { Direction } from "../src/core/world/movement.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readJson = <T>(p: string): T =>
  JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

const CASTLE_LB = 17; // Castillo de Lord British (location 1-based)

let world: WorldData;
let init: ExtractedInitialState;
let npcData: Record<number, NpcSlot[]>;
let look2: string[];

beforeAll(() => {
  const smallMapsRaw = readJson<SmallMapLocation[]>("maps/smallmaps.json");
  world = {
    overworld: readJson("maps/overworld.json"),
    underworld: readJson("maps/underworld.json"),
    smallMaps: new Map(smallMapsRaw.map((l) => [l.id, l])),
  };
  init = readJson("initial-state.json");
  npcData = readJson<Record<number, NpcSlot[]>>("npcs.json");
  look2 = readJson<string[]>("look2.json");
});

const gameData = (): GameData => ({
  locationsX: Array.from({ length: 33 }, () => 250),
  locationsY: Array.from({ length: 33 }, () => 250),
  locationNames: Array.from({ length: 33 }, (_, i) => `Loc${i}`),
  look2,
});

/** Construye un Game en el castillo LB, floor -1 (sótano), y devuelve el manager. */
function castleGame(floor: number, at: { x: number; y: number }): Game {
  const state: GameState = createNewGame(init);
  state.position = { location: CASTLE_LB, floor, x: at.x, y: at.y };
  return new Game(init, world, gameData(), state, {
    npcManager: new NpcManager(npcData),
    doors: new DoorManager(),
  });
}

/** Construye un Game en cualquier small-map (para casos no-castillo). */
function townGame(location: number, floor: number, at: { x: number; y: number }): Game {
  const state: GameState = createNewGame(init);
  state.position = { location, floor, x: at.x, y: at.y };
  return new Game(init, world, gameData(), state, {
    npcManager: new NpcManager(npcData),
    doors: new DoorManager(),
  });
}

/** Dirección desde la party hacia una casilla adyacente. */
function dirTo(from: { x: number; y: number }, to: { x: number; y: number }): Direction {
  if (to.x > from.x) return "east";
  if (to.x < from.x) return "west";
  if (to.y > from.y) return "south";
  return "north";
}

/** Mira a un NPC desde una casilla adyacente y devuelve el texto del mensaje. */
function lookAtNpc(floor: number, pick: (n: NpcRuntime) => boolean): string {
  // Colocamos la party 1 al oeste del NPC (o al este si está pegado al borde W).
  const probe = castleGame(floor, { x: 0, y: 0 });
  const npcs = probe.npcManager!.npcsAt(CASTLE_LB, floor);
  const npc = npcs.find(pick);
  if (!npc) throw new Error(`Sin NPC que cumpla el criterio en floor ${floor}`);
  const from = npc.x > 0 ? { x: npc.x - 1, y: npc.y } : { x: npc.x + 1, y: npc.y };
  const game = castleGame(floor, from);
  const events = game.look(dirTo(from, { x: npc.x, y: npc.y }));
  const msg = events.find((e) => e.kind === "message") as { text: string } | undefined;
  return msg?.text ?? "";
}

/**
 * Mira un OBJETO-tile del castillo (cofre/cadáver) desde una casilla adyacente. Tras
 * task #3 los slots-objeto del .NPC ya NO son NPCs: se hidratan en worldObjects, y
 * (L)ook los describe por su tile compositado (la rama `mapTile` de look(), no `npcAt`).
 */
function lookAtObject(floor: number, at: { x: number; y: number }): string {
  const from = at.x > 0 ? { x: at.x - 1, y: at.y } : { x: at.x + 1, y: at.y };
  const game = castleGame(floor, from);
  game.hydrateInteriorObjects(CASTLE_LB); // espejo de la entrada al mapa
  const events = game.look(dirTo(from, at));
  const msg = events.find((e) => e.kind === "message") as { text: string } | undefined;
  return msg?.text ?? "";
}

describe("(L)ook describe el tile compositado del NPC vía LOOK2.DAT", () => {
  it("un cofre-objeto (type 1 → tile 257) → 'a chest', NUNCA 'citizen'", () => {
    // Slot 23 del castillo (task #3): hidratado en worldObjects, no NPC. Coord real (16,21).
    const text = lookAtObject(-1, { x: 16, y: 21 });
    expect(text).toBe("Thou dost see a chest");
    expect(text).not.toContain("citizen");
  });

  it("un cadáver-objeto (type 30 → tile 286) → 'a corpse'", () => {
    // Slot 28 del castillo (task #3): hidratado como prop en (9,9).
    const text = lookAtObject(-1, { x: 9, y: 9 });
    expect(text).toBe("Thou dost see a corpse");
  });

  it("un NPC humano se describe por SU tile, no con un genérico", () => {
    // Guardia (type 112 → tile 368) en el castillo LB.
    const text = lookAtNpc(0, (n) => n.type === 112);
    expect(text).toBe("Thou dost see a guard");
    expect(text).not.toContain("citizen");
  });

  it("el atajo 'citizen of Britannia' ya no aparece para NINGÚN NPC", () => {
    for (const floor of [-1, 0, 1, 2]) {
      const probe = castleGame(floor, { x: 0, y: 0 });
      const npcs = probe.npcManager!.npcsAt(CASTLE_LB, floor);
      for (const npc of npcs) {
        const from =
          npc.x > 0 ? { x: npc.x - 1, y: npc.y } : { x: npc.x + 1, y: npc.y };
        const game = castleGame(floor, from);
        const events = game.look(dirTo(from, { x: npc.x, y: npc.y }));
        const msg = events.find((e) => e.kind === "message") as { text: string };
        expect(msg.text).not.toContain("citizen");
      }
    }
  });
});

describe("(L)ook describe el terreno vía LOOK2.DAT (sin NPC)", () => {
  it("terreno normal usa la frase del fichero original", () => {
    // Buscamos una casilla de suelo sin NPC en el sótano y comprobamos que la
    // frase sale de LOOK2 (índice = tile del mapa).
    const game = castleGame(-1, { x: 0, y: 0 });
    const map = game.activeMap;
    outer: for (let y = 1; y < 31; y++) {
      for (let x = 1; x < 31; x++) {
        const tile = map.tileAt(x, y);
        if (tile < 0 || tile >= 256) continue;
        if (game.npcManager!.npcAt(CASTLE_LB, -1, x, y)) continue;
        const phrase = look2[tile];
        if (!phrase || phrase === "x") continue;
        // Party a la izquierda mirando al este a (x,y).
        const g = castleGame(-1, { x: x - 1, y });
        if (g.npcManager!.npcAt(CASTLE_LB, -1, x - 1, y)) continue;
        const events = g.look("east");
        const msg = events.find((e) => e.kind === "message") as { text: string };
        // Debe describir por LOOK2, no un genérico inventado.
        expect(msg.text).toBe(`Thou dost see ${phrase}`);
        break outer;
      }
    }
  });
});

describe("(L)ook a una fuente overworld/pueblo (0xD8-0xDB) → prompt 'Who will drink?'", () => {
  const BRITAIN = 2; // Britain floor 0 tiene una fuente en (15,15) (tile 0xD8)

  it("intercepta la fuente y emite fountain-drink-prompt en vez de describir el tile", () => {
    // Miramos al ESTE desde (14,15) → la fuente (15,15). LOOKOBJ 0x0162: NO cae en el
    // "Thou dost see" genérico; abre la interacción "a gurgling fountain!"/"Who will drink?".
    const game = townGame(BRITAIN, 0, { x: 14, y: 15 });
    expect(game.activeMap.tileAt(15, 15) & 0xfc).toBe(0xd8); // es una fuente
    const events = game.look("east");
    expect(events.some((e) => e.kind === "fountain-drink-prompt")).toBe(true);
    // La interacción (texto + picker) la conduce main.ts; look() NO imprime aquí.
    expect(events.some((e) => e.kind === "message")).toBe(false);
  });
});
