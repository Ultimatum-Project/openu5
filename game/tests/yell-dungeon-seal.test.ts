/**
 * (#49 tanda 2) Yell DIRECCIONAL del overworld que ABRE el sello de una mazmorra
 * — CMDS.OVL 0x12c8 `cmd_yell_overworld`. Reemplaza el invento "pedir la palabra
 * al entrar": el flujo REAL es gritar (Y) la Palabra de Poder estando ADYACENTE a
 * la entrada (abre el sello, estado de mundo) y LUEGO pisar la entrada y (E)ntrar.
 * Ver re/notes/death-resurrection-audit.md §1. INVARIANTE clave: nunca queda una
 * mazmorra sellada INENTRABLE (yell abre → enter entra).
 */
import { describe, it, expect } from "vitest";
import { Game, type GameData, type GameSystems } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";
import type { DungeonData } from "../src/core/dungeon/dungeon.js";
import { wordSpokenFlag } from "../src/core/quest/words.js";

const WORDS = ["FALLAX", "VILIS", "INOPIA", "MALUM", "AVIDUS", "INFAMA", "IGNAVUS", "VERAMOCOR"];
const DECEIT = 33; // idx 32 en las tablas de coordenada
const ENTRANCE = { x: 50, y: 50 }; // entrada de Deceit en el overworld
const DUNGEON_ENTRANCE_TILE = 0x18; // ENTERABLE_TILES → "Enter dungeon"

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100,
    karma: 50,
    time: { year: 139, month: 5, day: 10, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: ENTRANCE.x, y: ENTRANCE.y + 1 }, // sur de la entrada
    transport: "foot",
    transportTile: 0x1c,
    questFlags: {},
    prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  overworld[ENTRANCE.y]![ENTRANCE.x] = DUNGEON_ENTRANCE_TILE; // entrada de mazmorra
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

function makeGameData(): GameData {
  // 40 localizaciones; Deceit (33) = idx 32 en (50,50). El resto fuera de alcance.
  const locationsX = Array.from({ length: 40 }, (_, i) => (i === 32 ? ENTRANCE.x : 200));
  const locationsY = Array.from({ length: 40 }, (_, i) => (i === 32 ? ENTRANCE.y : 200));
  return {
    locationsX,
    locationsY,
    locationNames: Array.from({ length: 40 }, (_, i) => `Loc${i + 1}`),
    wordsOfPower: WORDS,
  };
}

function makeDungeons(): DungeonData[] {
  // 8×8 planta 0 con una escalera de subida (type 1) en (1,1) = celda de entrada.
  const floor = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ({ type: 0, sub: 0 })),
  );
  floor[1]![1] = { type: 1, sub: 0 };
  return [{ location: DECEIT, name: "Deceit", floors: [floor] }];
}

function makeGame(s: GameState = makeState()): Game {
  const systems: GameSystems = { dungeons: makeDungeons() };
  return new Game({} as ExtractedInitialState, makeWorld(), makeGameData(), s, systems);
}

const texts = (ev: { kind: string; text?: string }[]): string[] =>
  ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("Yell overworld abre el sello de mazmorra (CMDS 0x12c8)", () => {
  it("gritar FALLAX adyacente a Deceit → 'uttered' + persiste el sello (questFlag)", () => {
    const game = makeGame();
    const ev = game.yellWord("FALLAX");
    expect(texts(ev)).toContain("\nA word of power is uttered\n");
    expect(texts(ev)).not.toContain("\nNo effect!\n");
    expect(game.state.questFlags[wordSpokenFlag(DECEIT)]).toBe(true);
  });

  /**
   * ★ #58 — EL SELLO ES UN XOR, NO UNA APERTURA. `13bd: xor byte ptr [si+0x58d0],0x80`
   * es una INVOLUCIÓN: gritar la Palabra otra vez con la party adyacente RE-SELLA. El
   * clon hacía `= true` (idempotente) y el segundo grito no cerraba nada.
   * El binario usa TRES xor porque guarda el tile aparte (`13da/13de/13e0` conmutan el
   * tile del mapa entre el de la entrada y 0xDF); aquí basta UNO porque el compose
   * DERIVA el tile del flag — por eso el tercer test comprueba el TILE, no sólo el flag.
   */
  it("#58 · gritar la Palabra DOS VECES RE-SELLA (xor 0x80, no `= true`)", () => {
    const game = makeGame();
    game.yellWord("FALLAX");
    expect(game.state.questFlags[wordSpokenFlag(DECEIT)]).toBe(true); // 1º: abre
    game.yellWord("FALLAX");
    expect(game.state.questFlags[wordSpokenFlag(DECEIT)]).toBe(false); // 2º: RE-SELLA
  });

  it("#58 · y la TERCERA vuelve a abrir — la involución no se agota", () => {
    const game = makeGame();
    game.yellWord("FALLAX");
    game.yellWord("FALLAX");
    game.yellWord("FALLAX");
    expect(game.state.questFlags[wordSpokenFlag(DECEIT)]).toBe(true);
  });

  it("#58 · el TILE sigue al flag: re-sellar devuelve el derrumbe 0xDF a la entrada", () => {
    // El flag es la única fuente de verdad del port; el compose re-deriva el tile en
    // cada pasada. Si alguien «arreglara» el toggle sólo en el flag y el tile quedara
    // pegado, este test lo caza — es el equivalente al 2º/3º xor del binario.
    const game = makeGame();
    game.yellWord("FALLAX");
    const abierto = game.activeMap.tileAt(ENTRANCE.x, ENTRANCE.y);
    expect(abierto).not.toBe(0xdf);
    game.yellWord("FALLAX");
    expect(game.activeMap.tileAt(ENTRANCE.x, ENTRANCE.y)).toBe(0xdf);
  });

  it("abrir el sello emite el TERREMOTO (quake + sfx 'quake') — #36 (CONFIRMADO testigo+ASM 0x12f9)", () => {
    const game = makeGame();
    const ev = game.yellWord("FALLAX");
    expect(ev.some((e) => e.kind === "quake")).toBe(true);
    expect(ev.some((e) => e.kind === "sfx" && (e as { sfx?: { id?: string } }).sfx?.id === "quake")).toBe(true);
  });

  it("palabra válida SIN mazmorra adyacente TAMBIÉN emite terremoto (ASM 0x12f9 va antes del sello)", () => {
    const game = makeGame(makeState({ position: { location: 0, floor: 0, x: 10, y: 10 } }));
    const ev = game.yellWord("FALLAX"); // válida pero sin entrada adyacente
    // CMDS 0x12f9 `call 0x70f2` (quake) se dispara al reconocer la palabra (0x12ea),
    // ANTES de comprobar adyacencia → el terremoto NO depende de que abra una mazmorra.
    expect(ev.some((e) => e.kind === "quake")).toBe(true);
    expect(ev.some((e) => e.kind === "sfx" && (e as { sfx?: { id?: string } }).sfx?.id === "quake")).toBe(true);
  });

  it("orden fiel: 'uttered' → quake → 'No effect!' (0x12f2 → 0x12f9 → 0x1408)", () => {
    const game = makeGame(makeState({ position: { location: 0, floor: 0, x: 10, y: 10 } }));
    const ev = game.yellWord("FALLAX");
    const kinds = ev
      .filter((e) => e.kind === "message" || e.kind === "quake")
      .map((e) => (e.kind === "message" ? `msg:${(e as { text?: string }).text}` : "quake"));
    expect(kinds).toEqual([
      "msg:\nA word of power is uttered\n",
      "quake",
      "msg:\nNo effect!\n",
    ]);
  });

  it("palabra inválida NO emite terremoto (no casa ninguna Palabra)", () => {
    const game = makeGame();
    const ev = game.yellWord("BANANA");
    expect(ev.some((e) => e.kind === "quake")).toBe(false);
  });

  it("palabra válida pero SIN entrada adyacente → 'uttered' + 'No effect!', NO abre", () => {
    const game = makeGame(makeState({ position: { location: 0, floor: 0, x: 10, y: 10 } }));
    const ev = game.yellWord("FALLAX");
    expect(texts(ev)).toEqual(["\nA word of power is uttered\n", "\nNo effect!\n"]);
    expect(game.state.questFlags[wordSpokenFlag(DECEIT)]).toBeUndefined();
  });

  it("palabra EQUIVOCADA junto a Deceit (VILIS≠FALLAX) → 'uttered' + 'No effect!', NO abre", () => {
    const game = makeGame();
    const ev = game.yellWord("VILIS"); // Despise, no Deceit
    expect(texts(ev)).toEqual(["\nA word of power is uttered\n", "\nNo effect!\n"]);
    expect(game.state.questFlags[wordSpokenFlag(DECEIT)]).toBeUndefined();
  });

  it("palabra inválida → sólo 'No effect!'", () => {
    const game = makeGame();
    expect(texts(game.yellWord("BANANA"))).toEqual(["\nNo effect!\n"]);
  });
});

describe("Enter gatea por el sello (invariante: yell abre → E entra)", () => {
  it("E sobre una entrada SELLADA → 'Enter What?' (la casilla presenta el derrumbe 0xDF, impasable), no entra", () => {
    // El sello ya NO se comprueba con una cadena inventada en enter(): con la Word sin
    // decir, activeMap.tileAt PRESENTA la entrada como derrumbe 0xDF (compose OUTSUBS
    // 0x0/0x149). 0xDF no está en ENTERABLE_TILES → enter() cae en el default "Enter
    // What?". En juego real la party ni siquiera puede pisar la casilla: 0xDF es impasable.
    const game = makeGame(makeState({ position: { location: 0, floor: 0, ...ENTRANCE } }));
    expect(game.activeMap.tileAt(ENTRANCE.x, ENTRANCE.y)).toBe(0xdf);
    const ev = game.enter();
    expect(texts(ev)).toContain("Enter What?");
    expect(texts(ev)).not.toContain("A Word of Power seals this dungeon...");
    expect(ev.some((e) => e.kind === "dungeon-entered")).toBe(false);
  });

  it("FLUJO REAL: yell adyacente abre → pisar la entrada → E entra en la mazmorra", () => {
    const game = makeGame();
    // 1) Grita FALLAX estando al sur de la entrada → abre el sello.
    game.yellWord("FALLAX");
    expect(game.state.questFlags[wordSpokenFlag(DECEIT)]).toBe(true);
    // 2) Pisa la entrada.
    game.state.position.x = ENTRANCE.x;
    game.state.position.y = ENTRANCE.y;
    // 3) (E)ntra: ya no hay prompt de palabra; entra directo.
    const ev = game.enter();
    const t = texts(ev);
    expect(t).not.toContain("A Word of Power seals this dungeon...");
    expect(ev.some((e) => e.kind === "dungeon-entered")).toBe(true);
    // Banner de entrada (video-N f010): "Enter dungeon" + el NOMBRE del banner C1
    // (tabla DS 0x1e3a EMPAQUETADA: id 33 → idx 33-6=27 → fixture "Loc28"; con data
    // real = "DECEIT" — F2-T1: el print duplicado dungeon.name fue retirado).
    expect(t).toContain("Enter dungeon");
    expect(t).toContain("\n\nLoc28\n");
    expect(t.some((s) => /descend/i.test(s))).toBe(false);
  });
});

// ── DOOM en el UNDERWORLD (testigo del usuario, 2026-07-20) ──────────────────
// La 8ª Palabra de Poder (VERAMOCOR) sella DOOM (loc 40 = idx 39), cuya entrada NO
// está en la superficie sino en el UNDERWORLD, en (128,128) [DATA.OVL 0x1eba/0x1ee2].
// El handler CMDS 0x12c8 NO tiene guarda de g_floor (escanea las 8 entradas siempre
// que g_location==0, y el Underworld ES g_location 0 con g_floor 0xff). El port tenía
// un guard `floor===0` que dejaba a Doom INENTRABLE: gritar VERAMOCOR daba
// "uttered"+"No effect!" para siempre. Regresión de ese bug.
const DOOM = 40; // idx 39 en las tablas de coordenada
const DOOM_ENTRANCE = { x: 128, y: 128 };
const UW_DUNGEON_ENTRANCE_TILE = 0x18;

function makeDoomWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const underworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  underworld[DOOM_ENTRANCE.y]![DOOM_ENTRANCE.x] = UW_DUNGEON_ENTRANCE_TILE;
  return { overworld, underworld, smallMaps: new Map() };
}

function makeDoomData(): GameData {
  // Doom (40) = idx 39 en (128,128); Deceit (33)=idx32 en (50,50); resto fuera.
  const locationsX = Array.from({ length: 40 }, (_, i) =>
    i === 39 ? DOOM_ENTRANCE.x : i === 32 ? 50 : 200,
  );
  const locationsY = Array.from({ length: 40 }, (_, i) =>
    i === 39 ? DOOM_ENTRANCE.y : i === 32 ? 50 : 200,
  );
  return {
    locationsX,
    locationsY,
    locationNames: Array.from({ length: 40 }, (_, i) => `Loc${i + 1}`),
    wordsOfPower: WORDS,
  };
}

function makeDoomDungeons(): DungeonData[] {
  const floor = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ({ type: 0, sub: 0 })),
  );
  floor[1]![1] = { type: 1, sub: 0 };
  return [{ location: DOOM, name: "Doom", floors: [floor] }];
}

function makeDoomGame(pos: { x: number; y: number }): Game {
  const s = makeState({ position: { location: 0, floor: 0xff, x: pos.x, y: pos.y } });
  const systems: GameSystems = { dungeons: makeDoomDungeons() };
  return new Game({} as ExtractedInitialState, makeDoomWorld(), makeDoomData(), s, systems);
}

describe("Doom (VERAMOCOR) en el Underworld — la entrada NO está en la superficie", () => {
  it("gritar VERAMOCOR adyacente a Doom en el UNDERWORLD (floor 0xff) → abre el sello", () => {
    // Party al norte de la entrada de Doom, en el Underworld.
    const game = makeDoomGame({ x: DOOM_ENTRANCE.x, y: DOOM_ENTRANCE.y - 1 });
    const ev = game.yellWord("VERAMOCOR");
    expect(texts(ev)).toContain("\nA word of power is uttered\n");
    expect(texts(ev)).not.toContain("\nNo effect!\n");
    expect(game.state.questFlags[wordSpokenFlag(DOOM)]).toBe(true);
  });

  it("REGRESIÓN: el sello de Doom NO queda inentrable — yell abre → pisar → (E)ntra", () => {
    const game = makeDoomGame({ x: DOOM_ENTRANCE.x, y: DOOM_ENTRANCE.y - 1 });
    game.yellWord("VERAMOCOR");
    expect(game.state.questFlags[wordSpokenFlag(DOOM)]).toBe(true);
    // Pisa la entrada de Doom y entra.
    game.state.position.x = DOOM_ENTRANCE.x;
    game.state.position.y = DOOM_ENTRANCE.y;
    const ev = game.enter();
    const t = texts(ev);
    expect(t).not.toContain("A Word of Power seals this dungeon...");
    expect(ev.some((e) => e.kind === "dungeon-entered")).toBe(true);
  });

  it("VERAMOCOR válida pero NO adyacente en el Underworld → 'uttered' + 'No effect!', no abre", () => {
    const game = makeDoomGame({ x: 10, y: 10 });
    const ev = game.yellWord("VERAMOCOR");
    expect(texts(ev)).toEqual(["\nA word of power is uttered\n", "\nNo effect!\n"]);
    expect(game.state.questFlags[wordSpokenFlag(DOOM)]).toBeUndefined();
  });
});

// ── PRESENTACIÓN del sello: derrumbe 0xDF (compose OUTSUBS 0x98 → func1 0x0) ──────
// En el original las 8 entradas de mazmorra NACEN selladas (byte 0x58d0[i]=0x00) y el
// render compose 16×16 sobreescribe la cueva base con el tile derrumbe 0xDF
// ("BlockEntrance", TileData[223], impasable) — 0149: `mov byte [bx],0xdf`. Al gritar la
// Palabra adyacente se pone el bit 0x80 → vuelve a cueva 0x16-0x18. El estado persiste en
// questFlags["word-spoken:<loc>"]. La pasabilidad e interacciones caen gratis: 0xDF ya es
// impasable en el port (walkable:false).
const BLOCK_ENTRANCE_TILE = 0xdf;

describe("Presentación del sello: activeMap pinta el derrumbe 0xDF (compose OUTSUBS 0x0/0x149)", () => {
  it("Deceit SELLADA (Word no dicha) → tileAt de la entrada = derrumbe 0xDF", () => {
    const game = makeGame(
      makeState({ position: { location: 0, floor: 0, x: ENTRANCE.x, y: ENTRANCE.y + 1 } }),
    );
    expect(game.activeMap.tileAt(ENTRANCE.x, ENTRANCE.y)).toBe(BLOCK_ENTRANCE_TILE);
  });

  it("Deceit ABIERTA (Word dicha) → tileAt vuelve a la cueva base 0x18", () => {
    const game = makeGame(
      makeState({
        position: { location: 0, floor: 0, x: ENTRANCE.x, y: ENTRANCE.y + 1 },
        questFlags: { [wordSpokenFlag(DECEIT)]: true },
      }),
    );
    expect(game.activeMap.tileAt(ENTRANCE.x, ENTRANCE.y)).toBe(DUNGEON_ENTRANCE_TILE);
  });

  it("Doom en el UNDERWORLD: SELLADA → 0xDF; ABIERTA → cueva base", () => {
    const game = makeDoomGame({ x: DOOM_ENTRANCE.x, y: DOOM_ENTRANCE.y - 1 });
    expect(game.activeMap.tileAt(DOOM_ENTRANCE.x, DOOM_ENTRANCE.y)).toBe(BLOCK_ENTRANCE_TILE);
    game.state.questFlags[wordSpokenFlag(DOOM)] = true;
    expect(game.activeMap.tileAt(DOOM_ENTRANCE.x, DOOM_ENTRANCE.y)).toBe(UW_DUNGEON_ENTRANCE_TILE);
  });

  it("SEGURIDAD: la coord de Doom en la SUPERFICIE (hierba, no cueva) NO se sella", () => {
    // makeDoomWorld: el overworld es todo hierba (5) en (128,128); sólo el Underworld tiene
    // la cueva. El sello gatea por el TILE BASE de entrada → nunca pinta 0xDF sobre hierba
    // o agua (la coord real de Doom en la superficie es OCÉANO en el juego).
    const s = makeState({ position: { location: 0, floor: 0, x: DOOM_ENTRANCE.x, y: DOOM_ENTRANCE.y } });
    const game = new Game(
      {} as ExtractedInitialState,
      makeDoomWorld(),
      makeDoomData(),
      s,
      { dungeons: makeDoomDungeons() },
    );
    expect(game.activeMap.tileAt(DOOM_ENTRANCE.x, DOOM_ENTRANCE.y)).toBe(5);
  });

  it("una cueva que NO es coord de mazmorra NO se sella (locationAt = null)", () => {
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    overworld[77]![77] = 0x16; // cueva suelta, no es entrada de ninguna mazmorra
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const s = makeState({ position: { location: 0, floor: 0, x: 77, y: 78 } });
    const game = new Game({} as ExtractedInitialState, world, makeGameData(), s, {
      dungeons: makeDungeons(),
    });
    expect(game.activeMap.tileAt(77, 77)).toBe(0x16);
  });
});
