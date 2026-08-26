/**
 * F8 — UN OBJETO NO TAPA LA VISTA NI ALUMBRA (guarda de población + haz del faro).
 *
 * ═══ EL BINARIO TIENE SEPARADOS DOS PREDICADOS QUE EL PORT FUNDE EN UNO ═══
 *
 * · VISIÓN. `viewport_build` lee SÓLO el plano de tiles: `ULTIMA.EXE:9795` `5bc3: call
 *   0x4402` → `5bc8: mov al, byte ptr [bx]`; ese byte (`[bp-0x214]`) es el único tile que
 *   `0x5DFE` (¿corta la LOS?) ve (`:9808`, `:9867`). En mapa pequeño `0x4402` resuelve al
 *   plano `0x6608` (`:7519` `44a8: add ax, 0x6608`).
 * · LUZ. El barrido de emisores `0x5E4A` usa el MISMO fetch (`:10061`) y **nunca**
 *   referencia la tabla de objetos `0x5C5A` ⇒ un objeto no puede emitir luz jamás.
 * · Los objetos se componen AL PINTAR, y encima *consultan* el resultado de la visión en
 *   vez de alimentarlo: `0x5394` salta la celda oculta en `:9145`
 *   `54d4: cmp byte ptr [bx-0x54fe], 0xff`.
 * · El PASO sí mira objetos, pero como SEGUNDO predicado aparte y antes del terreno:
 *   `TOWN.OVL.asm:672` `069c: call 0xffffb4be` → `0x368E find_object_at_xy`.
 *
 * El port superpone el objeto sobre el tile base en `Game.activeMap.tileAt` (game.ts:1095
 * `if (obj) return …obj.tile`) y `coreview.visField` muestrea EXACTAMENTE eso ⇒ por
 * construcción un objeto PUEDE tapar la vista y PUEDE alumbrar. Para el PASO la
 * superposición da la respuesta correcta — por eso se escribió así.
 *
 * ═══ QUÉ MIDE ESTE FICHERO ═══
 *
 * §1 CENSO (¿es observable?). La divergencia es estructural; la pregunta es si algún
 *    objeto REAL lleva un tile que el muestreo interprete como opaco o emisor. El censo
 *    NO es una lista escrita a mano: recorre `assets/npcs.json` (los datos de personajes
 *    del juego) con el `Game.hydrateInteriorObjects` REAL, las 32 locations × las 24 horas
 *    (las horas mueven la PLANTA por horario), y cruza los bytes bajos resultantes contra
 *    `ALWAYS_OPAQUE ∪ EMITTER_TILES`. Medido: VACÍA ⇒ hoy NO es observable jugando. La
 *    guarda existe para que no se vuelva observable EN SILENCIO el día que entre un dato
 *    nuevo (un aplique en la capa de objetos, un cofre con otro tile).
 *
 * §2 CENSO DE APLIQUES (la cautela que la ficha exigía ANTES de tocar nada). El riesgo
 *    declarado era: «si los apliques del port viven en la capa de OBJETOS, sacarlos del
 *    muestreo apaga los interiores». MEDIDO Y REFUTADO: las 441 celdas emisoras de los 32
 *    mapas pequeños están en el PLANO DE TERRENO y CERO en la capa de objetos del .NPC —
 *    igual que en el binario. Esta guarda fija esa geometría: si alguien migra un aplique
 *    a la capa de objetos, se pone roja y el arreglo de §3 deja de ser seguro.
 *
 * §3 EL CANAL QUE SÍ ERA OBSERVABLE — EL HAZ DEL FARO. El censo de §1 sale vacío contra
 *    los dos conjuntos que la ficha nombraba, pero la luz tiene un TERCER canal que
 *    muestrea el mismo `terrainAt`: el emisor del haz (`coreview.beamEmitters`, #326).
 *    Y ahí `& 0xff` ALIASABA el banco alto de objetos con el bajo de terreno:
 *      · sobremundo, `src = 0x1B Lighthouse` — la ALFOMBRA aparcada por (X)-it vale
 *        `0x11B Carpet2` ⇒ `0x11B & 0xff == 0x1B` ⇒ la alfombra proyectaba haz de faro.
 *      · mapa pequeño, `src = 0x2A LighthouseLight` — el ESQUIFE aparcado mirando al sur
 *        vale `0x12A SkiffDown` ⇒ mismo alias ⇒ el esquife proyectaba haz de faro.
 *    En el binario es imposible: el barrido del emisor del sobremundo es un `memchr` sobre
 *    el BÚFER DE TERRENO — `OUTSUBS.OVL.asm` `026f: mov ax, 0x6608` / `026b: mov ax, 0x1b`
 *    / `0267: mov ax, 0x400` / `0273: call 0x6172` — y la tabla de objetos `0x5C5A` no
 *    participa. El arreglo compara el tile COMPLETO (los dos espacios del port se
 *    distinguen por el banco 0x100, board-137-acta.md): medido en este árbol, el plano
 *    estático del sobremundo tiene 0 celdas ≥ 0x100 y sus 4 faros valen 0x1B pelado.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { ALWAYS_OPAQUE, EMITTER_TILES } from "../src/core/world/visibility.js";
import { LIGHTHOUSE_LIGHT_TILE, LIGHTHOUSE_TILE } from "../src/core/world/lighthouse.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { TILE_HIDDEN, VIEW_WINDOW } from "../src/skin/api.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (rel: string) => JSON.parse(readFileSync(join(HERE, "..", rel), "utf8").replace(/^﻿/, ""));

const npcData = readJson("assets/npcs.json") as Record<number, NpcSlot[]>;
const smallmaps = readJson("assets/maps/smallmaps.json") as { id: number; floors: { z: number; tiles: number[][] }[] }[];
const overworldPlane = readJson("assets/maps/overworld.json") as number[][];

// ── andamio mínimo ────────────────────────────────────────────────────────────
const CHAR: CharacterState = {
  name: "Avatar", gender: 0x0b, class: "A", status: "G",
  strength: 20, dexterity: 20, intelligence: 20,
  currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
  helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
  partyStatus: 0,
};

const GAME_DATA: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    version: 1, characters: [CHAR], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, keys: 0, gems: 0, torches: 2, karma: 50, magicCarpets: 1,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 1, floor: 0, x: 15, y: 15 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    npcDead: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
    ...over,
  } as unknown as GameState;
}

/** 32 mapas pequeños de suelo liso (el censo mira los OBJETOS, no el terreno). */
function llanoWorld(): WorldData {
  const plano = () => Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const smallMaps = new Map<number, SmallMapLocation>();
  for (let id = 1; id <= 32; id++) {
    smallMaps.set(id, { id, name: `Loc${id}`, floors: [-1, 0, 1, 2, 3].map((z) => ({ z, tiles: plano() })) });
  }
  const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld: ow, underworld: ow, smallMaps };
}

// ═══ §1 · CENSO DE LOS OBJETOS HIDRATADOS DEL .NPC ════════════════════════════

interface CensoFila { loc: number; floor: number; kind: string; tile: number; low: number }

/** Recorre TODAS las locations × TODAS las horas con el hidratador REAL. */
function censoObjetos(): CensoFila[] {
  const filas: CensoFila[] = [];
  const world = llanoWorld();
  for (const loc of Object.keys(npcData).map(Number).sort((a, b) => a - b)) {
    for (let hour = 0; hour < 24; hour++) {
      const g = new Game({} as ExtractedInitialState, world, GAME_DATA, baseState({
        time: { year: 139, month: 4, day: 7, hour, minute: 0 },
      } as Partial<GameState>), { npcManager: new NpcManager(npcData) });
      g.hydrateInteriorObjects(loc);
      for (const o of g.state.worldObjects ?? []) {
        filas.push({ loc: o.location, floor: o.floor, kind: o.kind, tile: o.tile, low: o.tile & 0xff });
      }
    }
  }
  return filas;
}

/**
 * EL PREDICADO DEL MUESTREO, tal cual lo aplica `coreview.visField`: el byte bajo del tile
 * que devuelve `activeMap.tileAt` decide si la celda corta la LOS (`isSightBlocking`) o
 * emite luz (`EMITTER_TILES.has(t & 0xff)`). En un INTERIOR el tercer canal (haz) usa
 * `LIGHTHOUSE_LIGHT_TILE`; el `LIGHTHOUSE_TILE` del sobremundo no aplica a estos objetos,
 * que son todos de mapa pequeño (lo aserta el propio censo).
 */
const PROHIBIDOS_INTERIOR = new Set<number>([...ALWAYS_OPAQUE, ...EMITTER_TILES, LIGHTHOUSE_LIGHT_TILE]);

describe("F8 §1 · censo de objetos del .NPC contra el muestreo de visión y luz", () => {
  const filas = censoObjetos();

  it("CARDINAL: el censo no está vacío (8 objetos por hora, 32 locations × 24 h)", () => {
    // Guarda anti-verde-vacuo: si el cargador se rompe, el cruce de abajo saldría vacío
    // «por no haber censado nada». Esperados EN CRUDO.
    expect(filas.length).toBe(192);
    expect(filas.length / 24).toBe(8);
    expect(Object.keys(npcData).length).toBe(32);
  });

  it("los bytes bajos del censo son EXACTAMENTE {01,0e,1b,1e,b5,b6}", () => {
    const lows = [...new Set(filas.map((f) => f.low))].sort((a, b) => a - b);
    expect(lows).toEqual([0x01, 0x0e, 0x1b, 0x1e, 0xb5, 0xb6]);
    // Y su procedencia, para que el veredicto se pueda auditar sin re-correr el censo:
    // cofre 0x101 (loc 17, sótano) · caja de sándalo 0x0E y alfombra 0x11B (loc 17, planta 2)
    // · cadáver 0x11E (loc 17, sótano) · corona 0xB5 (loc 18) · cetro 0xB6 (loc 29).
    expect([...new Set(filas.map((f) => f.tile))].sort((a, b) => a - b)).toEqual([14, 181, 182, 257, 283, 286]);
    expect([...new Set(filas.map((f) => f.loc))].sort((a, b) => a - b)).toEqual([17, 18, 29]);
  });

  it("VEREDICTO: intersección VACÍA con ALWAYS_OPAQUE ∪ EMITTER_TILES ∪ {0x2A}", () => {
    const choques = [...new Set(filas.map((f) => f.low))].filter((t) => PROHIBIDOS_INTERIOR.has(t));
    expect(choques).toEqual([]);
  });

  it("CONTROL POSITIVO: el mismo predicado SÍ marca un objeto con tile opaco/emisor", () => {
    // Sin este control, el aserto de arriba pasaría igual con el predicado roto.
    const brasero = 0xbd; // ∈ EMITTER_TILES
    const muro = 0x4f; // ∈ ALWAYS_OPAQUE
    const farolillo = LIGHTHOUSE_LIGHT_TILE;
    for (const t of [brasero, muro, farolillo]) {
      expect(PROHIBIDOS_INTERIOR.has((0x100 + t) & 0xff)).toBe(true);
    }
  });
});

// ═══ §2 · CENSO DE APLIQUES: viven en el PLANO, no en la capa de objetos ══════

describe("F8 §2 · los apliques viven en el plano de terreno (cautela de la ficha, MEDIDA)", () => {
  it("441 celdas emisoras en el terreno de los 32 mapas pequeños, en 30 locations", () => {
    let celdas = 0;
    const locs = new Set<number>();
    for (const m of smallmaps) {
      for (const f of m.floors) {
        for (const row of f.tiles) {
          for (const t of row) if (EMITTER_TILES.has(t)) { celdas++; locs.add(m.id); }
        }
      }
    }
    expect(smallmaps.length).toBe(32);
    expect(celdas).toBe(441);
    expect(locs.size).toBe(30);
  });

  it("CERO apliques en la capa de OBJETOS del .NPC (si entra uno, §3 deja de ser seguro)", () => {
    let emisores = 0;
    for (const slots of Object.values(npcData)) {
      for (const s of slots) {
        if (s.slot === 0) continue;
        const vacio = s.type === 0 && s.x.every((v) => v === 0) && s.y.every((v) => v === 0);
        if (vacio) continue;
        if (EMITTER_TILES.has(s.type & 0xff)) emisores++;
      }
    }
    expect(emisores).toBe(0);
  });

  it("el plano ESTÁTICO no lleva banco alto: 0 celdas ≥ 0x100, y los 4 faros valen 0x1B", () => {
    let altos = 0;
    let faros = 0;
    for (const row of overworldPlane) {
      for (const t of row) {
        if (t >= 0x100) altos++;
        if (t === LIGHTHOUSE_TILE) faros++;
      }
    }
    expect(altos).toBe(0);
    expect(faros).toBe(4);
  });
});

// ═══ §3 · EL HAZ DEL FARO NO LO ENCIENDE UN OBJETO ════════════════════════════

const idx = (col: number, row: number): number => row * VIEW_WINDOW + col;

/** Sobremundo llano, party en (100,101); el emisor va en (100,100) = ventana (5,4). */
function sobremundo(hour: number): { game: Game; world: WorldData } {
  const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const world: WorldData = { overworld: ow, underworld: ow, smallMaps: new Map() };
  const game = new Game({} as ExtractedInitialState, world, GAME_DATA, baseState({
    position: { location: 0, floor: 0, x: 100, y: 101 },
    time: { year: 139, month: 4, day: 7, hour, minute: 0 },
  } as Partial<GameState>));
  return { game, world };
}

/** Celda del RAYO NORTE del haz, lejos del radio de luz nocturno: sólo la enciende el haz. */
const RAYO_NORTE_SOBREMUNDO = idx(5, 0); // emisor (100,100) + (0,-4)

describe("F8 §3 · sobremundo: la ALFOMBRA aparcada no es un faro (OUTSUBS 0x026b sobre 0x6608)", () => {
  it("CONTROL NEGATIVO: sin nada, de noche esa celda del rayo está oculta", () => {
    const { game } = sobremundo(23);
    expect(new CoreViewImpl(game).snapshot().window[RAYO_NORTE_SOBREMUNDO]).toBe(TILE_HIDDEN);
  });

  it("CONTROL POSITIVO: un faro REAL de terreno (0x1B) sí enciende el rayo", () => {
    const { game, world } = sobremundo(23);
    world.overworld[100]![100] = LIGHTHOUSE_TILE;
    expect(new CoreViewImpl(game).snapshot().window[RAYO_NORTE_SOBREMUNDO]).not.toBe(TILE_HIDDEN);
  });

  it("la alfombra aparcada por (X)-it (0x11B Carpet2) NO enciende el haz", () => {
    const { game } = sobremundo(23);
    game.state.transportTile = 0x14; // RidingMagicCarpetRight
    game.state.position = { location: 0, floor: 0, x: 100, y: 100 };
    game.exitVehicle(); // deja 0x11B en (100,100) — setMapOverride, game.ts:4960
    game.state.position = { location: 0, floor: 0, x: 100, y: 101 };
    expect(game.activeMap.tileAt(100, 100)).toBe(0x11b); // el sujeto está donde creemos
    expect(new CoreViewImpl(game).snapshot().window[RAYO_NORTE_SOBREMUNDO]).toBe(TILE_HIDDEN);
  });
});

const PUEBLO = 0x16;
const SUELO = 68; // BrickFloor (transparente)
/** Pueblo llano, party en (10,10); el emisor va en (10,9) = ventana (5,4). */
function pueblo(hour: number, patch?: readonly [number, number, number]): Game {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => SUELO));
  if (patch) tiles[patch[1]]![patch[0]] = patch[2];
  const town: SmallMapLocation = { id: PUEBLO, name: "Paws", floors: [{ z: 0, tiles }] };
  const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const world: WorldData = { overworld: ow, underworld: ow, smallMaps: new Map([[PUEBLO, town]]) };
  return new Game({} as ExtractedInitialState, world, GAME_DATA, baseState({
    position: { location: PUEBLO, floor: 0, x: 10, y: 10 },
    time: { year: 139, month: 4, day: 7, hour, minute: 0 },
  } as Partial<GameState>));
}

const RAYO_NORTE_PUEBLO = idx(5, 1); // emisor (10,9) + (0,-3)

describe("F8 §3 · pueblo: el ESQUIFE atracado no es un farolillo (TOWN 0x04ca)", () => {
  it("CONTROL NEGATIVO: sin nada, de noche esa celda del rayo está oculta", () => {
    expect(new CoreViewImpl(pueblo(23)).snapshot().window[RAYO_NORTE_PUEBLO]).toBe(TILE_HIDDEN);
  });

  it("CONTROL POSITIVO: un LighthouseLight REAL de terreno (0x2A) sí enciende el rayo", () => {
    const g = pueblo(23, [10, 9, LIGHTHOUSE_LIGHT_TILE]);
    expect(new CoreViewImpl(g).snapshot().window[RAYO_NORTE_PUEBLO]).not.toBe(TILE_HIDDEN);
  });

  it("el esquife atracado mirando al sur (0x12A SkiffDown) NO enciende el haz", () => {
    const g = pueblo(23);
    g.state.worldObjects!.push({
      location: PUEBLO, floor: 0, x: 10, y: 9, tile: 0x12a, kind: "ship", hull: 99, skiffs: 0,
    } as never);
    expect(g.activeMap.tileAt(10, 9)).toBe(0x12a); // el sujeto está donde creemos
    expect(new CoreViewImpl(g).snapshot().window[RAYO_NORTE_PUEBLO]).toBe(TILE_HIDDEN);
  });
});
