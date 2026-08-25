/**
 * (U)se Cetro de Lord British — MECANISMO fiel (CAST.OVL 0x1966).
 *
 * Antes el port hardcodeaba "No effect!" (verbo inerte). Este test cubre el barrido
 * fiel derivado instrucción a instrucción (ver re/notes/overworld-b34-sceptre-correction.md
 * y el comentario de Game.useSceptre):
 *   • overworld/pueblo: barrido 3×3 de tiles 0x70-0x7F (ShadowlordBoundary) → Grass(5),
 *     SILENCIOSO; "No effect!" sólo si 0 disueltos.
 *   • mazmorra (loc 0x21-0x28): barrido saltado → rama residente 0x1a04 sobre el campo
 *     ENCARADO. Disuelve → "Field dissolved!" (0x496f); no → "No effect!" (0x4981).
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import {
  DungeonState,
  CellType,
  MagicFieldType,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/index.js";

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
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: true },
    npcDead: [],
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
    mapOverrides: {},
  };
  return { ...base, ...over } as GameState;
}

/** Overworld 256×256 de hierba; los tiles 0x70-0x7F se inyectan por el test. */
function world(overworld?: number[][]): WorldData {
  const ow = overworld ?? Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const underworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const smallMaps = new Map<number, SmallMapLocation>();
  return { overworld: ow, underworld, smallMaps };
}

/** Tile de entrada de KEEP en el overworld (`ENTERABLE_TILES[1]`), para ejercitar `enter()`. */
const KEEP_TILE = 0x13;
/** Location del keep sintético que sirve de CARGA DE MAPA en los detectores #119. */
const KEEP_LOC = 29;

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState, w: WorldData = world(), d: GameData = gameData): Game {
  return new Game({} as ExtractedInitialState, w, d, s);
}

/**
 * Fixture de los detectores #119: overworld con una barrera 0x71 al este del party
 * (101,100) y un tile de KEEP en (120,100) registrado en las tablas de location, para
 * poder disparar una CARGA DE MAPA por la vía pública `enter()` → `loadSmallMap`.
 */
function keepFixture(): { world: WorldData; data: GameData } {
  const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  ow[100]![101] = 0x71; // barrera adyacente al party (100,100)
  ow[100]![120] = KEEP_TILE; // entrada del keep
  const floors = [{ z: 0, tiles: Array.from({ length: 32 }, () => Array<number>(32).fill(5)) }];
  const smallMaps = new Map<number, SmallMapLocation>([
    [KEEP_LOC, { id: KEEP_LOC, name: "Keep", floors }],
  ]);
  const underworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const locationsX = Array.from({ length: 32 }, () => 250);
  const locationsY = Array.from({ length: 32 }, () => 250);
  locationsX[KEEP_LOC - 1] = 120;
  locationsY[KEEP_LOC - 1] = 100;
  return {
    world: { overworld: ow, underworld, smallMaps },
    data: { ...gameData, locationsX, locationsY },
  };
}

const messages = (evs: ReturnType<Game["useSceptre"]>) =>
  evs.filter((e) => e.kind === "message").map((e) => ("text" in e ? e.text : ""));

/** Mazmorra sintética (loc 33) con un campo mágico en (floor,x,y). */
function fieldDungeon(x: number, y: number, sub: number): DungeonData {
  const floors: DungeonCell[][][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ type: CellType.Nothing, sub: 0 })),
    ),
  );
  floors[0]![y]![x] = { type: CellType.MagicField, sub };
  return { location: 33, name: "TestField", floors };
}

describe("(U)se Cetro · cabecera fiel (siempre)", () => {
  it("emite Sceptre + Wielding + SFX de blandido", () => {
    const g = makeGame(makeState());
    const evs = g.useSceptre();
    expect(messages(evs).slice(0, 2)).toEqual([
      "Sceptre",
      "Wielding the Sceptre of Lord British...",
    ]);
    expect(evs.some((e) => e.kind === "sfx" && "sfx" in e && e.sfx?.id === "sceptre")).toBe(true);
  });
});

describe("(U)se Cetro · overworld/pueblo (barrido 3×3 de 0x70-0x7F)", () => {
  it("sin barreras adyacentes → 'No effect!'", () => {
    const g = makeGame(makeState());
    expect(messages(g.useSceptre())).toContain("No effect!");
  });

  it("barrera 0x71 adyacente → disuelve a Grass(5) en SILENCIO (sin 'No effect!')", () => {
    const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    ow[100]![101] = 0x71; // (x=101,y=100), justo al este del party en (100,100)
    const s = makeState();
    const g = makeGame(s, world(ow));
    const msgs = messages(g.useSceptre());
    expect(msgs).not.toContain("No effect!"); // dissolvió ≥1 → mudo
    // La celda se lee como Grass por la vía PÚBLICA. Este aserto miraba antes
    // `s.mapOverrides["0:0:101:100"]`, es decir la capa PERSISTIDA — un sitio donde el
    // original nunca escribe esto (0x19ce escribe por el puntero de `tile_addr`, búfer de
    // terreno). Re-sellado sobre el observable, y el canal lo cubren los detectores #119.
    expect(g.activeMap.tileAt(101, 100)).toBe(5); // restaurada a Grass
  });

  it("disuelve TODO el 3×3 de barreras (incluida la celda central) y nada más", () => {
    const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    // Marca las 9 celdas del 3×3 como ShadowlordBoundary (0x70..0x7F) + una fuera de rango.
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) ow[100 + dy]![100 + dx] = 0x70;
    ow[100]![103] = 0x7f; // fuera del 3×3 (x=103): NO debe tocarse
    const s = makeState();
    const g = makeGame(s, world(ow));
    g.useSceptre();
    // 9 celdas disueltas. Contado por la vía PÚBLICA (antes se contaban las claves de
    // `s.mapOverrides`, la capa persistida — canal equivocado, ver #119): el 3×3 entero
    // se lee como hierba y la barrera de fuera del alcance sigue en pie.
    let dissolved = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (g.activeMap.tileAt(100 + dx, 100 + dy) === 5) dissolved++;
    expect(dissolved).toBe(9);
    expect(g.activeMap.tileAt(103, 100), "fuera del 3×3: intacta").toBe(0x7f);
    // Y nada de esto tocó la capa que viaja en el save.
    expect(Object.keys(s.mapOverrides ?? {})).toEqual([]);
  });
});

/**
 * DETECTORES #119 — el barrido del Cetro escribe TERRENO, y el terreno es VOLÁTIL.
 *
 * DERIVACIÓN (no es prosa: es la cadena de la escritura, instrucción a instrucción):
 *  · CAST.OVL 0x19c1 `call 0x8482` → resuelto con `routine_census.resolve_near_call`
 *    (base de near-call de CAST.OVL = 0xbf80) a **ULTIMA.EXE 0x4402** = `tile_addr(y,x)`,
 *    que devuelve en DI un PUNTERO dentro del búfer de terreno vivo: small map
 *    `DS:0x6608 + (y<<5) + x`; overworld, la caché de 4 chunks de 16×16.
 *  · CAST.OVL 0x19c6 `mov al,[di]` lee y 0x19ce `mov byte [di],5` ESCRIBE **a través de
 *    ese mismo puntero** ⇒ la hierba cae en el búfer de TERRENO, no en la tabla de
 *    objetos DS:0x5c5a. Ésta es la razón por la que el call-site es terreno y no objeto:
 *    el destino no se lee del nombre de la mecánica, se lee del puntero que se escribe.
 *  · Ese búfer queda FUERA de la ventana de SAVED.GAM — la ventana es [0x55A6, 0x6606),
 *    0x1060 B, escrita entera por INTRO 0x1dfd y leída entera por INTRO 0x0eb4 ⇒ el
 *    terreno NO viaja en el save — y el cargador TOWN 0x0408 lo REESCRIBE de disco en
 *    cada entrada y cada cambio de planta. Ver re/notes/tpk-113-acta.md §1 y #119.
 *
 * Son DETECTORES del canal, no sellos de fidelidad de la mecánica: rojo = «el port
 * cambió de canal». La fidelidad la sostiene la cadena de arriba, no el expect.
 */
describe("(U)se Cetro · #119 el barrido escribe en el canal VOLÁTIL de terreno", () => {
  it("★ la hierba NO entra en mapOverrides (la capa que VIAJA EN EL SAVE)", () => {
    const { world: w, data } = keepFixture();
    const s = makeState();
    const g = makeGame(s, w, data);
    g.useSceptre();
    // mapOverrides es la capa persistida (saveNative.ts la serializa). El original
    // escribe en DS:0x6608, que cae fuera de [0x55A6,0x6606) ⇒ aquí no debe caer nada.
    expect(Object.keys(s.mapOverrides ?? {})).toEqual([]);
    // CONTROL POSITIVO: y aun así la disolución SE VE mientras dura la residencia —
    // sin esto, «no persiste» pasaría igual de verde con un port que no disolviera nada.
    expect(g.activeMap.tileAt(101, 100), "0x19ce: la barrera es hierba YA").toBe(5);
  });

  it("★ la barrera VUELVE tras una carga de mapa: el búfer se relee de disco", () => {
    const { world: w, data } = keepFixture();
    const s = makeState();
    const g = makeGame(s, w, data);
    g.useSceptre();
    expect(g.activeMap.tileAt(101, 100), "disuelta durante la residencia").toBe(5);
    // Vía PÚBLICA: pisar la entrada del keep y (E)ntrar → loadSmallMap → el cargador
    // TOWN 0x0408 machaca el búfer entero.
    s.position = { ...s.position, x: 120, y: 100 };
    g.enter();
    expect(s.position.location, "se entró de verdad al keep").toBe(KEEP_LOC);
    // De vuelta al overworld: el .DAT/chunk vuelve ENTERO — barrera donde había barrera
    // Y hierba donde había hierba. Con un clear a medias (o demasiado ancho) cae una.
    s.position = { location: 0, floor: 0, x: 100, y: 100 } as GameState["position"];
    expect(g.activeMap.tileAt(101, 100), "la barrera 0x71 está de vuelta").toBe(0x71);
    expect(g.activeMap.tileAt(102, 100), "…y la hierba de al lado sigue siendo hierba").toBe(5);
  });
});

describe("(U)se Cetro · mazmorra (rama residente sobre el campo encarado)", () => {
  function dungeonGame(field: DungeonData, dpos: DungeonPos): Game {
    const g = makeGame(makeState({ position: { location: 33, floor: 0, x: 3, y: 3 } }));
    g.dungeonState = new DungeonState([field], dpos);
    return g;
  }

  it("campo de energía ENCARADO → 'Field dissolved!' y la celda pasa a suelo", () => {
    // Party en (3,3) mirando al este; campo de energía en (4,3).
    const g = dungeonGame(fieldDungeon(4, 3, MagicFieldType.Energy), {
      dungeon: 33, floor: 0, x: 3, y: 3, facing: "east",
    });
    expect(messages(g.useSceptre())).toContain("Field dissolved!");
    expect(g.dungeonState!.cellAt(0, 4, 3).type).toBe(CellType.Nothing);
  });

  it("sin campo delante → 'No effect!' (Doom y demás mazmorras sin campos)", () => {
    const g = dungeonGame(fieldDungeon(4, 3, MagicFieldType.Energy), {
      dungeon: 33, floor: 0, x: 3, y: 3, facing: "west", // mira a (2,3) = vacío
    });
    expect(messages(g.useSceptre())).toContain("No effect!");
    expect(g.dungeonState!.cellAt(0, 4, 3).type).toBe(CellType.MagicField); // intacto
  });

  it("campo de sueño encarado también se disuelve (cualquier MagicField)", () => {
    const g = dungeonGame(fieldDungeon(4, 3, MagicFieldType.Sleep), {
      dungeon: 33, floor: 0, x: 3, y: 3, facing: "east",
    });
    expect(messages(g.useSceptre())).toContain("Field dissolved!");
    expect(g.dungeonState!.cellAt(0, 4, 3).type).toBe(CellType.Nothing);
  });
});
