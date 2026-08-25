/**
 * PUERTAS FIELES (task #15, spec .superpowers/sdd/scout-doors.md).
 *
 * Verifica la semántica asm-exacta de (O)pen y del autocierre + skull key:
 *  - Open SÓLO abre 0xB8/0xBA ("Opened!"); 0xB9/0xBB/0x97/0x98 → "Locked!" (NO
 *    abre, NO gasta llaves/skull keys, NO cobra turno); 0xAF → "It's open!";
 *    0x99 → "Too heavy!"; resto → "Nothing to open!". (SJOG cmd_open 0x1374.)
 *  - Autocierre: slot ÚNICO (abrir otra puerta restaura la anterior), timer=4,
 *    restaura SIEMPRE el tile guardado (0xB8/0xBA), nunca un cerrojo (§5).
 *  - Skull key: se gasta con (U)se → Skull Key (CAST.OVL 0x18c4, rama del dispatcher
 *    de (U)se item; NO el hechizo In Ex Por), que desmagifica 0x97→0xB8 permanente;
 *    Open ya NO gasta skull key (§6-7). In Ex Por (#26) NO abre puertas — es getdir +
 *    animación (CAST:0x1026). An Ex Por (#25) SELLA (0xB8→0x97, CAST:0x846). Task #22
 *    corrige la atribución errónea de #15.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { DoorManager, DOOR_TILES } from "../src/core/world/doors.js";

const REGULAR = DOOR_TILES.regular; // 0xB8 184
const LOCKED = DOOR_TILES.locked; // 0xB9 185
const MAGIC = DOOR_TILES.magicLock; // 0x97 151
const OPENED = DOOR_TILES.open; // 0xAF 175
const HEAVY = DOOR_TILES.heavy; // 0x99 153
const FLOOR = 68; // 0x44 BrickFloor sustituto

const BRITAIN = 2;

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff,
    ring: 0xff, amulet: 0xff, partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2, activeCharacter: 0, food: 100, keys: 5, skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [],
  attackRangeValues: [], defenseValues: [],
};

/** Overworld de hierba (5) con `tile` en el vecino ESTE de la party (px+1,py). */
function doorWorld(px: number, py: number, tile: number): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  overworld[py]![px + 1] = tile;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

function doorGame(tile: number, over: Partial<GameState> = {}): { g: Game; doors: DoorManager } {
  const doors = new DoorManager();
  const st = makeState({ position: { location: 0, floor: 0, x: 100, y: 100 }, ...over });
  const g = new Game({} as ExtractedInitialState, doorWorld(100, 100, tile), gameData, st, {
    combatResources,
    doors,
  });
  return { g, doors };
}

const msg = (evs: { kind: string; text?: string }[]): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => e.text ?? "");
const clock = (g: Game): number => {
  const t = g.state.time;
  return ((t.day * 24 + t.hour) * 60) + t.minute;
};

describe("DoorManager.open — dispatch asm-exacto (SJOG cmd_open 0x13d1)", () => {
  const st = () => makeState({ position: { location: BRITAIN, floor: 0, x: 5, y: 5 } });

  it("0xB8 (sin cerrojo) → { Opened!, opened } y sustituye por 68 durante 4 ticks, luego 0xB8", () => {
    const d = new DoorManager();
    const s = st();
    expect(d.open(s, 5, 5, REGULAR)).toEqual({ message: "Opened!", opened: true });
    for (let i = 0; i < 4; i++) {
      expect(d.effectiveTile(BRITAIN, 0, 5, 5, REGULAR)).toBe(FLOOR);
      d.tick();
    }
    // El autocierre restaura el tile GUARDADO 0xB8, jamás un cerrojo.
    expect(d.effectiveTile(BRITAIN, 0, 5, 5, REGULAR)).toBe(REGULAR);
  });

  it("0xB9 (cerrojo de llave) → { Locked!, NO opened }, NO gasta llave, NO sustituye", () => {
    const d = new DoorManager();
    const s = st();
    s.keys = 5;
    expect(d.open(s, 5, 5, LOCKED)).toEqual({ message: "Locked!", opened: false });
    expect(s.keys).toBe(5); // Open no gasta llaves — eso es competencia de Jimmy
    expect(d.effectiveTile(BRITAIN, 0, 5, 5, LOCKED)).toBe(LOCKED); // no se abrió
  });

  it("0x97 (cerrojo mágico) → { Locked!, NO opened }, NO gasta skull key", () => {
    const d = new DoorManager();
    const s = st();
    s.skullKeys = 3;
    expect(d.open(s, 5, 5, MAGIC)).toEqual({ message: "Locked!", opened: false });
    expect(s.skullKeys).toBe(3); // la skull key pertenece al hechizo, no a Open
  });

  it("0xAF → It's open! ; 0x99 → Too heavy! ; no-puerta → Nothing to open! (ninguna opened)", () => {
    const d = new DoorManager();
    const s = st();
    expect(d.open(s, 5, 5, OPENED)).toEqual({ message: "It's open!", opened: false });
    expect(d.open(s, 5, 5, HEAVY)).toEqual({ message: "Too heavy!", opened: false });
    expect(d.open(s, 5, 5, FLOOR)).toEqual({ message: "Nothing to open!", opened: false });
  });

  it("slot ÚNICO: abrir una 2ª puerta restaura la 1ª de inmediato", () => {
    const d = new DoorManager();
    const s = st();
    d.open(s, 5, 5, REGULAR); // puerta A
    expect(d.effectiveTile(BRITAIN, 0, 5, 5, REGULAR)).toBe(FLOOR);
    d.open(s, 6, 6, REGULAR); // puerta B → A se restaura ya
    expect(d.effectiveTile(BRITAIN, 0, 5, 5, REGULAR)).toBe(REGULAR); // A cerrada
    expect(d.effectiveTile(BRITAIN, 0, 6, 6, REGULAR)).toBe(FLOOR); // B abierta
  });

  it("reset() limpia el slot sin restaurar (carga de mapa / combate, §5d)", () => {
    const d = new DoorManager();
    const s = st();
    d.open(s, 5, 5, REGULAR);
    d.reset();
    expect(d.effectiveTile(BRITAIN, 0, 5, 5, REGULAR)).toBe(REGULAR);
    expect(d.serialize()).toEqual([]);
  });

  it("serialize/restore: migración desde saves con lista (se queda con la 1ª)", () => {
    const d = new DoorManager();
    d.restore([
      { location: BRITAIN, floor: 0, x: 5, y: 5, turnsLeft: 3 },
      { location: BRITAIN, floor: 0, x: 6, y: 6, turnsLeft: 2 },
    ] as never);
    expect(d.effectiveTile(BRITAIN, 0, 5, 5, REGULAR)).toBe(FLOOR);
    expect(d.effectiveTile(BRITAIN, 0, 6, 6, REGULAR)).toBe(REGULAR); // descartada
    expect(d.serialize().length).toBe(1);
  });
});

describe("Game.open — turno sólo al abrir (SJOG cmd_open, §3)", () => {
  it("0xB8 → Opened! y COBRA turno (el reloj avanza)", () => {
    const { g } = doorGame(REGULAR);
    const before = clock(g);
    const evs = g.open("east");
    expect(msg(evs)).toContain("Opened!");
    expect(clock(g)).toBeGreaterThan(before);
  });

  it("0xB9 → Locked! SIN cobrar turno y SIN gastar llave", () => {
    const { g } = doorGame(LOCKED, { keys: 5 });
    const before = clock(g);
    const evs = g.open("east");
    expect(msg(evs)).toContain("Locked!");
    expect(clock(g)).toBe(before); // sin turno
    expect(g.state.keys).toBe(5); // sin gastar llave
  });

  it("0x97 → Locked! SIN cobrar turno y SIN gastar skull key", () => {
    const { g } = doorGame(MAGIC, { skullKeys: 2 });
    const before = clock(g);
    const evs = g.open("east");
    expect(msg(evs)).toContain("Locked!");
    expect(clock(g)).toBe(before);
    expect(g.state.skullKeys).toBe(2);
  });
});

describe("(U)se Skull Key (CAST.OVL 0x18c4) + In Ex Por/An Ex Por + autocierre no re-echa cerrojo", () => {
  it("(U)se Skull Key sobre 0x97 → 0xB8 permanente, skullKeys−1; luego Open abre y el autocierre NO devuelve el cerrojo (#F13-4/#F13-5)", () => {
    const { g, doors } = doorGame(MAGIC, { skullKeys: 1 });
    // (U)se Skull Key apuntando ESTE a la puerta mágica: "Skull Key" + desmagifica.
    const use = g.useSkullKey("east");
    expect(msg(use)).toContain("Skull Key"); // str DATA.OVL 0x48fe
    expect(g.state.skullKeys).toBe(0); // 0x18c4 dec: consumió la skull key
    // CONTROL POSITIVO del canal VIVO (#151): la desmagificación emite `map-changed`
    // (game.ts:useSkullKey, justo tras `setVolatileTerrain`). Sin este positivo, el
    // `map-changed`-ausente del hermano de MAZMORRA sería un control degenerado.
    expect(use.some((e) => e.kind === "map-changed"), "0x18f4 mutó el mapa vivo").toBe(true);
    // La celda es ahora una puerta cerrada-normal 0xB8 (permanente en el mapa vivo).
    const evs = g.open("east");
    expect(msg(evs)).toContain("Opened!");
    // Autocierre: 4 ticks → vuelve a 0xB8, NUNCA al cerrojo mágico 0x97.
    for (let i = 0; i < 4; i++) doors.tick();
    expect(doors.effectiveTile(0, 0, 101, 100, REGULAR)).toBe(REGULAR);
      // #119 tanda 2: la mutación de puerta es TERRENO (volátil), no la capa persistida
      // `mapOverrides` — el binario escribe por el puntero de tile_addr. Re-sellado sobre
      // el OBSERVABLE; el canal lo cubren los detectores #119 del final del fichero.
    expect(g.activeMap.tileAt(101, 100)).toBe(REGULAR);
    expect(Object.keys(g.state.mapOverrides ?? {})).toEqual([]);
  });

  it("(U)se Skull Key apuntando a NO-puerta: gasta la llave (dec antes del check de tile) SIN cambiar el mapa", () => {
    const { g } = doorGame(FLOOR, { skullKeys: 2 }); // enfrente hay suelo, no puerta
    const use = g.useSkullKey("east");
    expect(msg(use)).toContain("Skull Key");
    expect(g.state.skullKeys).toBe(1); // 0x18c4 dec incondicional (bug-for-bug)
    expect(g.activeMap.tileAt(101, 100)).toBe(FLOOR); // el mapa NO cambió (ningún canal)
  });

  it("(U)se Skull Key con getdir CANCELADO (dir null): la llave YA se gastó (0x18e7)", () => {
    const { g } = doorGame(MAGIC, { skullKeys: 1 });
    const use = g.useSkullKey(null);
    expect(msg(use)).toContain("Skull Key");
    expect(g.state.skullKeys).toBe(0); // consumida aunque no se apuntó dirección
    expect(g.activeMap.tileAt(101, 100)).toBe(MAGIC); // la puerta sigue mágica
  });

  it("(U)se Skull Key en MAZMORRA (loc 0x40) → 'Not here!' y la llave se gasta igual", () => {
    const { g } = doorGame(MAGIC, { skullKeys: 1, position: { location: 0x40, floor: 0, x: 100, y: 100 } });
    const use = g.useSkullKey("east");
    expect(msg(use)).toContain("Skull Key");
    expect(msg(use)).toContain("Not here!"); // str DATA.OVL 0x4909
    expect(g.state.skullKeys).toBe(0); // dec (0x18c4) antes del gate de mazmorra
    // ★ #151 — ASERTO DE AUSENCIA SOBRE LA CAPA EQUIVOCADA (corregido). Este bloque
    // sólo miraba `mapOverrides` y su comentario decía «ni un canal ni el otro»: FALSO.
    // Tras #119 tanda 2 este flujo NO PUEDE escribir en `mapOverrides` — `useSkullKey`
    // muta por `setVolatileTerrain` (CAST2 0x07a0/0x07b2 `mov byte [bx],0xB8/0xBA` sobre
    // el puntero de kernel 0x4402) ⇒ la capa persistida está vacía POR CONSTRUCCIÓN y el
    // expect era verde pasara lo que pasara. Si el gate de mazmorra (#123
    // `effectiveLocation`, el que hizo alcanzable esta rama) volviera a romperse, el port
    // desmagificaría una puerta de SUPERFICIE y esto seguiría verde.
    // El canal VIVO se mide por el evento: la rama de mazmorra retorna en 0x18cf ANTES
    // del `setVolatileTerrain`, así que NO hay `map-changed`. Positivo hermano arriba.
    expect(use.some((e) => e.kind === "map-changed"), "0x18cf cortó antes de mutar").toBe(false);
    expect(Object.keys(g.state.mapOverrides ?? {})).toEqual([]); // y la persistida, intacta
  });

  it("An Ex Por sobre 0xB8 → 0x97 (sella), NO consume skull key", () => {
    const { g } = doorGame(REGULAR, { skullKeys: 2 });
    g.applyDoorSpell({ kind: "sealDoor" }, "east");
      // #119 tanda 2: la mutación de puerta es TERRENO (volátil), no la capa persistida
      // `mapOverrides` — el binario escribe por el puntero de tile_addr. Re-sellado sobre
      // el OBSERVABLE; el canal lo cubren los detectores #119 del final del fichero.
    expect(g.activeMap.tileAt(101, 100)).toBe(MAGIC);
    expect(Object.keys(g.state.mapOverrides ?? {})).toEqual([]);
    expect(g.state.skullKeys).toBe(2); // sellar no gasta skull key
  });

  it("An Ex Por sobre 0xB9 (cerrojo de LLAVE) → 0x97 (sella también los con cerrojo, asm 0x87d/0x88e)", () => {
    const { g } = doorGame(LOCKED, { skullKeys: 0 });
    const evs = g.applyDoorSpell({ kind: "sealDoor" }, "east");
      // #119 tanda 2: la mutación de puerta es TERRENO (volátil), no la capa persistida
      // `mapOverrides` — el binario escribe por el puntero de tile_addr. Re-sellado sobre
      // el OBSERVABLE; el canal lo cubren los detectores #119 del final del fichero.
    expect(g.activeMap.tileAt(101, 100)).toBe(MAGIC); // 0xB9 → 0x97, NO "No effect!"
    expect(msg(evs)).not.toContain("No effect!");
  });
});

/**
 * DETECTORES #119 TANDA 2 — las mutaciones de PUERTA son escrituras de TERRENO, y el
 * terreno es VOLÁTIL: no viaja en el save y muere en la carga de mapa.
 *
 * DERIVACIÓN, call-site a call-site. El discriminador NO es el nombre de la mecánica:
 * es el PUNTERO que se escribe. Las cuatro mutaciones de puerta piden el puntero al
 * helper `tile_addr` (ULTIMA.EXE 0x4402, `call 0x8482` desde los overlays) y escriben
 * a través de él, o sea DENTRO del búfer de terreno vivo (`DS:0x6608` en small map),
 * NO en la tabla de objetos `DS:0x5c5a`:
 *
 *   (S)earch, puerta secreta   SJOG 0x0b4d `call 0x8482` → 0x0b52 `mov byte [bx],0xB9`
 *                              (y con g_floor>=0x80: 0x0b5e/0x0b63 → 0xB8)
 *   (J)immy                    SJOG 0x0e04 `call 0x8482` → 0x0e07 `mov bx,ax`
 *                                        → 0x0e0e `mov byte [bx],al`
 *   (U)se Skull Key            CAST2 0x0768: 0x0782 `call 0x6222` → kernel 0x4402
 *                                        → 0x07a0 `mov byte [bx],0xB8` / 0x07b2 `…,0xBA`
 *   An Ex Por (sella)          CAST 0x0867 `call 0x8482` → 0x0872 `mov bx,ax`
 *                                        → 0x088e `mov byte [bx],0x97` / 0x08a3 `…,0x98`
 *
 * Y ese búfer queda FUERA de la ventana de SAVED.GAM ([0x55A6,0x6606), 0x1060 B, escrita
 * entera por INTRO 0x1dfd) y lo reescribe de disco el cargador TOWN 0x0408 en cada
 * entrada y cada cambio de planta. Ver re/notes/terreno-119-acta.md.
 *
 * ★ MEDIDO EN VIVO (#121, re/notes/terreno-121-acta.md): en el oráculo, (O)pen sobre una
 * RegularDoor 0xB8 cambia la celda DEL BÚFER DE TERRENO a 0x44 BrickFloor, y tras un
 * ciclo de planta la celda vuelve a 0xB8 — la puerta se re-cierra sola. Esto no es una
 * consecuencia deducida del modelo: se observó.
 *
 * Son DETECTORES del canal, no sellos de fidelidad de la mecánica.
 */
describe("#119 tanda 2 · las puertas son TERRENO (volátil), no capa persistida", () => {
  const KEEP_TILE = 0x13; // ENTERABLE_TILES[1], para ejercitar enter()
  const KEEP_LOC = 29;
  const DOOR_X = 16, DOOR_Y = 30; // al ESTE de la entrada del small map (15,30)

  /** Small map 32×32 de BrickFloor con `tile` en (16,30), + keep enterable en el overworld. */
  function keepDoorGame(tile: number, over: Partial<GameState> = {}) {
    const doors = new DoorManager();
    const floors = [{ z: 0, tiles: Array.from({ length: 32 }, () => Array<number>(32).fill(FLOOR)) }];
    floors[0]!.tiles[DOOR_Y]![DOOR_X] = tile;
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    overworld[100]![120] = KEEP_TILE;
    const locationsX: number[] = [], locationsY: number[] = [];
    locationsX[KEEP_LOC - 1] = 120;
    locationsY[KEEP_LOC - 1] = 100;
    const world: WorldData = {
      overworld, underworld: overworld,
      smallMaps: new Map([[KEEP_LOC, { id: KEEP_LOC, name: "Keep", floors }]]),
    };
    const st = makeState({
      position: { location: KEEP_LOC, floor: 0, x: 15, y: 30 },
      characters: [makeChar({ dexterity: 30 })], partySize: 1, // dex 30 > rand(0,29) ⇒ (J)immy determinista
      ...over,
    });
    const g = new Game(
      {} as ExtractedInitialState, world,
      { locationsX, locationsY, locationNames: [] } as GameData,
      st, { combatResources, doors } as never,
    );
    return { g, st };
  }

  /** Saca al party al overworld y vuelve a ENTRAR: carga de mapa por la vía pública. */
  function recargarMapa(g: Game, st: GameState): void {
    st.position = { location: 0, floor: 0, x: 120, y: 100 } as GameState["position"];
    g.enter();
  }

  it("★ (J)immy: la puerta destrabada no entra en mapOverrides y vuelve TRABADA al recargar", () => {
    const { g, st } = keepDoorGame(LOCKED);
    expect(msg(g.jimmy("east"))).toContain("Unlocked!\n");
    // CONTROL POSITIVO: la destrabada SE VE mientras dura la residencia — sin esto,
    // «no persiste» pasaría verde con un port que no destrabara nada.
    expect(g.activeMap.tileAt(DOOR_X, DOOR_Y), "0x0e0e: destrabada YA").toBe(REGULAR);
    // …y NO en la capa que viaja en el save (saveNative serializa mapOverrides).
    expect(Object.keys(st.mapOverrides ?? {})).toEqual([]);
    recargarMapa(g, st);
    expect(st.position.location, "se re-entró de verdad").toBe(KEEP_LOC);
    // El .DAT vuelve entero: cerrojo donde había cerrojo Y suelo donde había suelo.
    expect(g.activeMap.tileAt(DOOR_X, DOOR_Y), "TOWN 0x0408 relee: re-trabada").toBe(LOCKED);
    expect(g.activeMap.tileAt(DOOR_X + 1, DOOR_Y), "…y el suelo sigue siendo suelo").toBe(FLOOR);
  });

  it("★ (U)se Skull Key: la desmagificada 0x97→0xB8 tampoco sobrevive a la recarga", () => {
    const { g, st } = keepDoorGame(MAGIC, { skullKeys: 1 });
    g.useSkullKey("east");
    expect(g.activeMap.tileAt(DOOR_X, DOOR_Y), "CAST2 0x07a0").toBe(REGULAR);
    expect(Object.keys(st.mapOverrides ?? {})).toEqual([]);
    recargarMapa(g, st);
    expect(g.activeMap.tileAt(DOOR_X, DOOR_Y), "vuelve la cerradura mágica").toBe(MAGIC);
  });

  it("★ An Ex Por: el sellado 0xB8→0x97 tampoco sobrevive a la recarga", () => {
    const { g, st } = keepDoorGame(REGULAR);
    g.applyDoorSpell({ kind: "sealDoor" }, "east");
    expect(g.activeMap.tileAt(DOOR_X, DOOR_Y), "CAST 0x088e").toBe(MAGIC);
    expect(Object.keys(st.mapOverrides ?? {})).toEqual([]);
    recargarMapa(g, st);
    expect(g.activeMap.tileAt(DOOR_X, DOOR_Y), "vuelve la puerta normal").toBe(REGULAR);
  });

  it("★ (S)earch: la puerta SECRETA revelada vuelve a estar oculta al recargar", () => {
    const SECRET = 0x4e;
    const { g, st } = keepDoorGame(SECRET);
    g.search("east");
    expect(g.activeMap.tileAt(DOOR_X, DOOR_Y), "SJOG 0x0b52").toBe(LOCKED); // 0x4E → 0xB9
    expect(Object.keys(st.mapOverrides ?? {})).toEqual([]);
    recargarMapa(g, st);
    expect(g.activeMap.tileAt(DOOR_X, DOOR_Y), "el muro vuelve a ocultarla").toBe(SECRET);
  });
});
