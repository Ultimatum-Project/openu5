/**
 * Tests de NPCs y puertas con los assets REALES extraídos (game/assets/).
 * Si fallan por ausencia de assets: ejecutar `npm run extract` primero.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { getActiveMap, type WorldData, type SmallMapLocation } from "../src/core/world/map.js";
import { isPassable } from "../src/core/world/movement.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readJson = <T>(p: string): T =>
  JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

const BRITAIN = 2;

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

const newGame = (): GameState => createNewGame(init);

const tileAt = (location: number, floor: number, x: number, y: number): number =>
  getActiveMap(world, location, floor).tileAt(x, y);

describe("NpcManager — spawn de Britain", () => {
  it("enterMap spawnea >5 NPCs, todos dentro de 32×32", () => {
    const mgr = new NpcManager(npcData);
    const state = newGame();
    mgr.enterMap(BRITAIN, state);
    const all = [...mgr.npcsAt(BRITAIN, 0), ...mgr.npcsAt(BRITAIN, 1)];
    expect(all.length).toBeGreaterThan(5);
    for (const n of all) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThan(32);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThan(32);
    }
  });

  it("ningún NPC de Britain cae sobre tile no-walkable (dato real)", () => {
    // El original coloca a los NPCs donde diga el .NPC; si alguno cayera en un
    // tile no transitable sería aceptable (se documentaría), pero con los datos
    // reales de Britain a las 8:35 todos caen en suelo transitable.
    const mgr = new NpcManager(npcData);
    const state = newGame();
    mgr.enterMap(BRITAIN, state);
    for (const floor of [0, 1]) {
      for (const n of mgr.npcsAt(BRITAIN, floor)) {
        expect(isPassable(tileAt(BRITAIN, floor, n.x, n.y), "foot")).toBe(true);
      }
    }
  });

  it("a las 8:35 (INIT.GAM) cada NPC está en su scheduleIndex correcto", () => {
    expect(init.hour).toBe(8);
    const mgr = new NpcManager(npcData);
    const state = newGame();
    mgr.enterMap(BRITAIN, state);
    const bySlot = new Map(
      [...mgr.npcsAt(BRITAIN, 0), ...mgr.npcsAt(BRITAIN, 1)].map((n) => [n.slot, n]),
    );
    // Valores reales observados del dato de Britain a hora 8 (scheduleIndex):
    const s1 = bySlot.get(1)!; // ai [0,4,0], idx 1 → (4,19) planta 0
    expect([s1.x, s1.y, s1.z]).toEqual([4, 19, 0]);
    const s4 = bySlot.get(4)!; // idx 0 → (1,5) planta 1
    expect([s4.x, s4.y, s4.z]).toEqual([1, 5, 1]);
    const s13 = bySlot.get(13)!; // idx 1 → (15,6) planta 1
    expect([s13.x, s13.y, s13.z]).toEqual([15, 6, 1]);
  });
});

describe("NpcManager — tick", () => {
  it("tras 20 ticks nadie pisa tile no-walkable ni al jugador; los Wander respetan su radio", () => {
    const mgr = new NpcManager(npcData);
    const doors = new DoorManager();
    const state = newGame();
    state.position = { location: BRITAIN, floor: 0, x: 15, y: 30 };
    mgr.enterMap(BRITAIN, state);

    // Puesto y radio de cada errante WANDER (aiType 1) según su scheduleIndex a
    // hora 8. El radio es Manhattan 3 (NPC.OVL:0x0D60 → 0x0C50 maxdist=3). Los
    // big-wander (aiType 2) NO tienen límite de radio (maxdist=0), así que no se
    // asertan aquí.
    const wanderers = new Map<number, { postX: number; postY: number; radius: number }>();
    for (const n of [...mgr.npcsAt(BRITAIN, 0), ...mgr.npcsAt(BRITAIN, 1)]) {
      // idx a hora 8 (35 min → sigue en hora 8 durante los 20 ticks)
      const ai = n.aiTypes;
      // recomputar idx de forma laxa: buscamos el idx cuyo x/y == posición actual
      for (let idx = 0; idx < 3; idx++) {
        if (n.schedX[idx] === n.x && n.schedY[idx] === n.y) {
          const a = ai[idx]!;
          if (a === 1) wanderers.set(n.slot, { postX: n.x, postY: n.y, radius: 3 });
          break;
        }
      }
    }

    for (let t = 0; t < 20; t++) {
      state.time.minute += 1;
      state.turnsSinceStart++;
      mgr.tick(state, world, doors);
      for (const floor of [0, 1]) {
        for (const n of mgr.npcsAt(BRITAIN, floor)) {
          expect(isPassable(tileAt(BRITAIN, floor, n.x, n.y), "foot")).toBe(true);
          const onPlayer =
            state.position.floor === floor &&
            state.position.x === n.x &&
            state.position.y === n.y;
          expect(onPlayer).toBe(false);
          const w = wanderers.get(n.slot);
          if (w && n.z === floor) {
            // Radio Manhattan (|dx|+|dy| <= 3), no Chebyshev.
            const md = Math.abs(n.x - w.postX) + Math.abs(n.y - w.postY);
            expect(md).toBeLessThanOrEqual(w.radius);
          }
        }
      }
    }
  });

  it("dos NPCs nunca ocupan la misma casilla en la misma planta", () => {
    const mgr = new NpcManager(npcData);
    const doors = new DoorManager();
    const state = newGame();
    state.position = { location: BRITAIN, floor: 0, x: 15, y: 30 };
    mgr.enterMap(BRITAIN, state);
    for (let t = 0; t < 20; t++) {
      state.turnsSinceStart++;
      mgr.tick(state, world, doors);
    }
    for (const floor of [0, 1]) {
      const seen = new Set<string>();
      for (const n of mgr.npcsAt(BRITAIN, floor)) {
        const k = `${n.x},${n.y}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
  });
});

describe("DoorManager", () => {
  // NOTA (task #15): Open ya NO abre cerrojos ni gasta llaves/skull keys (era una
  // fabricación #F13-5). Los cerrojos de llave (0xB9) → "Locked!" (a Jimmy); los
  // mágicos (0x97) → "Locked!" (se abren con (U)se Skull Key, no con Open). Cobertura de la
  // semántica asm-exacta en tests/doors.test.ts.
  it("abrir una RegularDoor sustituye el tile por 68 durante 4 ticks y luego vuelve a 184", () => {
    const doors = new DoorManager();
    const state = newGame();
    state.position = { location: BRITAIN, floor: 0, x: 5, y: 5 };
    expect(doors.open(state, 5, 5, 184)).toEqual({ message: "Opened!", opened: true });
    for (let i = 0; i < 4; i++) {
      expect(doors.effectiveTile(BRITAIN, 0, 5, 5, 184)).toBe(68);
      doors.tick();
    }
    expect(doors.effectiveTile(BRITAIN, 0, 5, 5, 184)).toBe(184);
  });

  it("LockedDoor 0xB9: siempre 'Locked!' (Open NO abre cerrojos ni gasta llaves)", () => {
    const doors = new DoorManager();
    const state = newGame();
    state.position = { location: BRITAIN, floor: 0, x: 6, y: 6 };
    state.keys = 5;
    expect(doors.open(state, 6, 6, 185)).toEqual({ message: "Locked!", opened: false });
    expect(state.keys).toBe(5); // no gasta llave
    expect(doors.effectiveTile(BRITAIN, 0, 6, 6, 185)).toBe(185); // no se abrió
  });

  it("MagicLock 0x97 → 'Locked!' (no gasta skull key) y no-puerta → 'Nothing to open!'", () => {
    const doors = new DoorManager();
    const state = newGame();
    state.position = { location: BRITAIN, floor: 0, x: 7, y: 7 };
    state.skullKeys = 3;
    expect(doors.open(state, 7, 7, 151)).toEqual({ message: "Locked!", opened: false });
    expect(state.skullKeys).toBe(3);
    expect(doors.open(state, 7, 7, 68)).toEqual({ message: "Nothing to open!", opened: false });
  });
});
