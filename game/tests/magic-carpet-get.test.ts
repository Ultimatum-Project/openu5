/**
 * Alfombra mágica OBTENIBLE por (G)et — cierre del hueco de npc.md §9-G.
 *
 * Derivación (re/notes/lote-D-witnesses-relevo.md, vía estática): el (G)et despacha por
 * OBJECT-TILE en el switch secundario de get_special_item (SJOG 0x1464→0x172e; `cmp
 * ax,0x1b` @0x1756 → rama 0x149e). La rama imprime DS 0x8C5C ("A magic carpet!\n",
 * verbatim DATA.OVL fileoff 0x8C6C), hace `inc g_carpets` con clamp 0x64→0x63
 * (0x14a9-0x14b0) y, SOLO con g_location==0x11 (0x14b5), borra el slot vía kernel
 * 0xBB92(0x16) — 0x16 = 22 = el nº de slot del ÚNICO Carpet2 de los datos
 * (assets/npcs.json: loc 17, slot 22, type 27, (15,18) z2). Sin flag de tomado en el
 * binario: el bloque estático del .NPC re-siembra el slot en cada entrada (misma
 * regeneración por-entrada que los cofres) → re-obtenible por re-entrada = FIEL.
 *
 * DISCRIMINANTE: antes del fix, el type 27 era "prop" INERTE (manager.ts) y el (G)et no
 * concedía nada; state.magicCarpets sólo subía por debug/save. Espeja sandalwood-box.test.ts.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { grantPlotItem } from "../src/core/quest/items.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1, characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, keys: 0, gems: 0, torches: 2, karma: 50,
    magicCarpets: 0,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    // LB castle (loc 17), planta 2, una casilla al NORTE de la alfombra (15,18).
    position: { location: 17, floor: 2, x: 15, y: 17 },
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
  };
  return { ...base, ...over } as GameState;
}

function slot(over: Partial<NpcSlot> & { slot: number }): NpcSlot {
  return {
    aiTypes: [0, 0, 0], x: [0, 0, 0], y: [0, 0, 0], z: [0, 0, 0],
    times: [0, 0, 0, 0], type: 0, dialogNumber: 0, ...over,
  };
}

/** CASTLE.NPC recortado: sólo el slot-objeto de la alfombra (slot 22, real). */
const NPC_DATA: Record<number, NpcSlot[]> = {
  17: [
    slot({ slot: 0 }),
    slot({ slot: 22, type: 27, x: [15, 15, 15], y: [18, 18, 18], z: [2, 2, 2] }), // alfombra mágica
  ],
};

function floorGrid(): number[][] {
  return Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
}

function world(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const underworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const smallMaps = new Map<number, SmallMapLocation>();
  const lbCastle: SmallMapLocation = {
    id: 17, name: "Lord_Britishs_Castle",
    floors: [-1, 0, 1, 2, 3].map((z) => ({ z, tiles: floorGrid() })),
  };
  smallMaps.set(17, lbCastle);
  return { overworld, underworld, smallMaps };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState): Game {
  return new Game({} as ExtractedInitialState, world(), gameData, s, {
    npcManager: new NpcManager(NPC_DATA),
  });
}

const plotOf = (g: Game) => (g.state.worldObjects ?? []).filter((o) => o.kind === "plot");

describe("grantPlotItem alfombra (SJOG 0x149e): contador con clamp + string byte-exacto", () => {
  it("carpet = 'A magic carpet!\\n' verbatim (DS 0x8C5C) + inc magicCarpets", () => {
    const s = makeState();
    expect(grantPlotItem(s, "carpet")).toBe("A magic carpet!\n");
    expect(s.magicCarpets).toBe(1);
  });

  it("clamp del binario (0x14a9-0x14b0: inc a 0x64 → 0x63): en 99 se queda en 99", () => {
    const s = makeState({ magicCarpets: 0x63 });
    grantPlotItem(s, "carpet");
    expect(s.magicCarpets).toBe(0x63);
  });
});

describe("Alfombra en LB castle (loc 17, slot 22, type 27, (15,18) z2)", () => {
  it("hydrateInteriorObjects la siembra como PLOT con su sprite Carpet2 (283)", () => {
    const g = makeGame(makeState());
    g.hydrateInteriorObjects(17);
    const plots = plotOf(g);
    expect(plots).toHaveLength(1);
    const carpet = plots[0]!;
    expect(carpet.plotItem).toBe("carpet");
    expect({ x: carpet.x, y: carpet.y, floor: carpet.floor, loc: carpet.location, tile: carpet.tile }).toEqual({
      x: 15, y: 18, floor: 2, loc: 17, tile: 27 + 0x100,
    });
  });

  it("(G)et sobre la alfombra: +1 magicCarpets + string byte-exacto + retira el objeto", () => {
    const g = makeGame(makeState());
    g.hydrateInteriorObjects(17);
    const events = g.get("south"); // party (15,17) → alfombra (15,18)
    expect(g.state.magicCarpets).toBe(1);
    const msg = events.find((e) => e.kind === "message");
    expect(msg && "text" in msg ? msg.text : "").toBe("A magic carpet!\n");
    expect(plotOf(g)).toHaveLength(0); // borrado del slot (kernel 0xBB92(0x16) [= CS 0x7b12 → TOWN.OVL:0x00b0])
  });

  it("RE-SIEMBRA tras el pickup: sin flag de tomado, re-entrar la hace renacer (fiel)", () => {
    const g = makeGame(makeState());
    g.hydrateInteriorObjects(17);
    g.get("south"); // recoge la alfombra
    expect(plotOf(g)).toHaveLength(0);
    g.hydrateInteriorObjects(17); // re-entrada: el bloque estático del .NPC re-siembra
    expect(plotOf(g)).toHaveLength(1);
    expect(g.state.magicCarpets).toBe(1); // el contador no se toca al re-sembrar
  });
});

// ───────────────────────────────────────────────────────────────────────────────────
// #346 — La alfombra APARCADA por (X)-it, que es el OTRO canal de objeto del port.
//
// Reporte del usuario (16-08, jugando en openu5.org): X-it de la alfombra en el
// sobremundo → la alfombra queda aparcada y VISIBLE, y (G)et hacia ella responde
// «Nothing to get!». Derivación en re/notes/get-alfombra-346.md:
//   · `cmd_xit` clase 0x14 (CMDS.OVL 0x0F20) guarda `[bp-2] = 0x1B` LITERAL (0x0F3F) y la
//     cola 0x0FF4 emite el objeto de mundo con ese byte en su campo +0.
//   · `cmd_get` (SJOG.OVL 0x18CE) barre la tabla DS:0x5C5A ANTES del terreno (0x1926-0x19BD)
//     y acepta `+0 == 0x1B` (0x1974) → `get_item_switch` cadena 0x172E `cmp ax,0x1b` @0x1756
//     → rama 0x149E: DS 0x8C5C + `inc g_carpets` con clamp 99; la cola 0x177A borra la
//     ranura y 0x178E marca turno.
// El port aparca esa alfombra en el override de terreno del banco alto (0x11B), el canal
// que `board()` ya declara equivalente a un registro de objeto (#137) — y `get()` no lo
// miraba. Los describes de arriba cubren el OTRO canal (worldObject "plot" de LB Castle).
// ───────────────────────────────────────────────────────────────────────────────────

const BANK = 0x100;
const TILE_CARPET_RIDING = 0x14; // RidingMagicCarpetRight — g_transport_tile en vuelo
const OBJ_CARPET_PARKED = 0x1b; // Carpet2 — lo que deja el (X)-it (0x0F3F)
const OBJ_HORSE_PARKED = 0x10; // HorseRight — lo que deja el (X)-it del caballo (0x0F6A: tile−2)
const OBJ_SKIFF = 0x28; // SkiffUp
const OBJ_SHIP = 0x24; // ShipNoSailsUp
const TERRAIN_LIGHTHOUSE = 0x1b; // MISMO número, espacio de TERRENO — el discriminante

/** Sobremundo (loc 0, floor 0) todo hierba, con un parche de terreno opcional. */
function overworldGame(s: GameState, patch?: { x: number; y: number; tile: number }): Game {
  const w = world();
  if (patch) w.overworld[patch.y]![patch.x] = patch.tile;
  return new Game({} as ExtractedInitialState, w, gameData, s, { npcManager: new NpcManager(NPC_DATA) });
}

/** Party a pie en (100,101) del sobremundo; la casilla NORTE es (100,100). */
function overworldState(over: Partial<GameState> = {}): GameState {
  return makeState({ position: { location: 0, floor: 0, x: 100, y: 101 }, ...over });
}

const textOf = (evs: ReturnType<Game["get"]>) =>
  evs.filter((e) => e.kind === "message").map((e) => ("text" in e ? e.text : ""));

describe("#346 · (G)et sobre la alfombra APARCADA por (X)-it", () => {
  it("ida y vuelta REAL X-it→Get: el byte que deja cmd_xit es el que acepta cmd_get", () => {
    // El acoplamiento entre los dos ficheros es el sujeto del test: si alguien mueve el
    // `dropTile: 0x1b` de exitTransport o la constante de get(), este caso se rompe.
    const g = overworldGame(overworldState({ transportTile: TILE_CARPET_RIDING, magicCarpets: 0 }));
    g.state.position = { location: 0, floor: 0, x: 100, y: 100 };
    g.exitVehicle(); // aparca la alfombra en (100,100) y deja a la party a pie encima
    expect(g.activeMap.tileAt(100, 100)).toBe(OBJ_CARPET_PARKED + BANK); // 0x11B Carpet2

    g.state.position = { location: 0, floor: 0, x: 100, y: 101 }; // la party se aparta al sur
    const events = g.get("north");

    expect(textOf(events)).toEqual(["A magic carpet!\n"]); // DS 0x8C5C verbatim
    expect(g.state.magicCarpets).toBe(1); // inc g_carpets @0x14A5
    expect(g.activeMap.tileAt(100, 100)).toBe(5); // cola 0x177A: la ranura queda vacía
  });

  it("el ÉXITO consume turno (0x178E `or [g_unk_24e6],2`)", () => {
    const g = overworldGame(overworldState({ magicCarpets: 0 }));
    g.setMapOverride(100, 100, OBJ_CARPET_PARKED + BANK);
    const t0 = { ...g.state.time };
    g.get("north");
    expect(g.state.time).not.toEqual(t0);
  });

  it("clamp del binario también por este canal: en 99 se queda en 99 (0x14A9-0x14B0)", () => {
    const g = overworldGame(overworldState({ magicCarpets: 0x63 }));
    g.setMapOverride(100, 100, OBJ_CARPET_PARKED + BANK);
    g.get("north");
    expect(g.state.magicCarpets).toBe(0x63);
  });

  it("MUTANTE: recogerla NO deja recogerla otra vez (sin el borrado, se duplicaría)", () => {
    const g = overworldGame(overworldState({ magicCarpets: 0 }));
    g.setMapOverride(100, 100, OBJ_CARPET_PARKED + BANK);
    g.get("north");
    const second = g.get("north");
    expect(g.state.magicCarpets).toBe(1);
    expect(textOf(second)).toEqual(["Nothing to get!"]); // fall-through 0x1B28
  });

  it("MUTANTE del ESPACIO: el 0x1B de TERRENO es el Faro, y NO es una alfombra", () => {
    // Si la rama comparase el tile crudo en vez del byte del banco alto (`tile - 0x100`),
    // este caso concedería una alfombra al hacer (G)et sobre un faro. Es el mismo error de
    // espacio que #137 midió en `board()` (137 celdas de falso positivo).
    const g = overworldGame(overworldState({ magicCarpets: 0 }), { x: 100, y: 100, tile: TERRAIN_LIGHTHOUSE });
    expect(g.activeMap.tileAt(100, 100)).toBe(TERRAIN_LIGHTHOUSE); // sin banco alto
    const events = g.get("north");
    expect(textOf(events)).toEqual(["Nothing to get!"]);
    expect(g.state.magicCarpets).toBe(0);
  });
});

describe("#346 · control SIMÉTRICO: los otros tres vehículos aparcados NO se cogen", () => {
  // DERIVADO, no supuesto: el barrido de objetos de `cmd_get` (SJOG 0x1926-0x19BD) acepta el
  // registro sólo si su +0 cumple `< 0x10` (0x196A), `== 0x19` (0x196F), `== 0x1B` (0x1974) o
  // `(&0xFC) == 0xB4` (0x1979). Caballo aparcado 0x10/0x11, fragata 0x24-0x27 y esquife
  // 0x28-0x2B FALLAN las cuatro ⇒ caen al switch de terreno (0x19C0) y de ahí al
  // fall-through 0x1B28 «Nothing to get!». En 1988 esos tres se ABORDAN, no se cogen; sólo
  // la alfombra es un contador de inventario (g_carpets 0x57B0) y por eso sólo ella se coge.
  const casos: [string, number][] = [
    ["caballo (0x10 HorseRight)", OBJ_HORSE_PARKED],
    ["esquife (0x28 SkiffUp)", OBJ_SKIFF],
    ["fragata (0x24 ShipNoSailsUp)", OBJ_SHIP],
  ];
  for (const [nombre, objByte] of casos) {
    it(`${nombre}: «Nothing to get!», sin conceder alfombra y SIN borrar el objeto`, () => {
      const g = overworldGame(overworldState({ magicCarpets: 0 }));
      g.setMapOverride(100, 100, objByte + BANK);
      const t0 = { ...g.state.time };
      const events = g.get("north");
      expect(textOf(events)).toEqual(["Nothing to get!"]);
      expect(g.state.magicCarpets).toBe(0);
      expect(g.activeMap.tileAt(100, 100)).toBe(objByte + BANK); // sigue ahí, abordable
      expect(g.state.time).toEqual(t0); // el rechazo tampoco consume turno
    });
  }
});
