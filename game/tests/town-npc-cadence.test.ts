import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData, SmallMapLocation } from "../src/core/world/map.js";
import { townNpcTailRuns, type TownNpcPhases } from "../src/core/world/loops/turn.js";

/**
 * CADENCIA DE NPC EN PUEBLO — la cadena TOWN 0x161F-0x165D (#54 pieza (f)).
 *
 * Las tres «patas» del hallazgo (turnos alternos montado · 'T' congela · 'Q' mitad) NO son
 * mecanismos separados: son tres puertas consecutivas de la MISMA cadena, y las tres saltan
 * al MISMO destino 0x1686 = «este turno los NPC no actúan». Lo que gatean es el tramo
 * 0x165F-0x1683 entero: `guard_wander` (0xc78) + `npc_tick_all` (0xfffff8e2) + el 2º
 * world_turn del `npc_engine` (0x1352).
 *
 * ★ EL BLOQUEANTE DE LA PIEZA, RESUELTO: `[bp-6]` —la excepción `cmp [bp-6],0x20`— es LA
 * TECLA PULSADA. Se escribe en 0x1495 (`push [bp-2] / call 0xdc4 / mov [bp-6],ax`) y sus
 * otras comparaciones en la misma rutina son 0x30 y 0x39 (0x1580/0x1586), o sea '0' y '9'.
 * 0x20 = ESPACIO = pasar turno ⇒ pasando, el filtro de montado no se aplica.
 *
 * Los toggles son LOCALES del bucle de pueblo (`[bp-4]` y `[bp-0xe]`), puestos a 0 UNA vez
 * en el prólogo 0x1424-0x1429, antes de la cabeza 0x142C: persisten entre turnos dentro de
 * la visita y se reinician al (re)entrar. Arrancando en 0, el PRIMER turno montado YA salta.
 */
function phases(): TownNpcPhases {
  return { mount: 0, quickness: 0 };
}
function st(over: Partial<GameState>): GameState {
  return { transportTile: 0x1c, ...over } as GameState;
}

describe("townNpcTailRuns — la cadena de puertas (TOWN 0x161F-0x165D)", () => {
  it("a pie y sin hechizo de tiempo: corre SIEMPRE (control positivo)", () => {
    const p = phases();
    const s = st({ transportTile: 0x1c });
    for (let i = 0; i < 4; i++) expect(townNpcTailRuns(s, p, false)).toBe(true);
  });

  it("★ MONTADO a caballo: uno de cada dos, y el PRIMERO salta (toggle 0→1 ⇒ jne 0x1686)", () => {
    const p = phases();
    const s = st({ transportTile: 0x12 }); // caballo mirando al E
    expect([0, 1, 2, 3].map(() => townNpcTailRuns(s, p, false))).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });

  it("★ la ALFOMBRA también cuenta como montado — el rango [0x12,0x16) es MÁS ANCHO que el caballo", () => {
    // 0x161f/0x1626 comparan contra 0x12 y 0x16, así que entran caballo 0x12/0x13 Y
    // alfombra 0x14/0x15. Otras piezas usan `&0xFE==0x12` (caballo puro): NO es el mismo
    // predicado, y confundirlos dejaría la alfombra fuera de la cadencia.
    for (const tile of [0x12, 0x13, 0x14, 0x15]) {
      const p = phases();
      const s = st({ transportTile: tile });
      expect(townNpcTailRuns(s, p, false), `tile 0x${tile.toString(16)} es montado`).toBe(false);
    }
    // …y los vecinos del rango NO lo son: 0x11 (por debajo) y 0x16 (por encima).
    for (const tile of [0x11, 0x16]) {
      const p = phases();
      const s = st({ transportTile: tile });
      expect(townNpcTailRuns(s, p, false), `tile 0x${tile.toString(16)} queda fuera`).toBe(true);
    }
  });

  it("★ ESPACIO (pasar) se salta el filtro de montado: corre TODOS los turnos", () => {
    const p = phases();
    const s = st({ transportTile: 0x12 });
    for (let i = 0; i < 4; i++) expect(townNpcTailRuns(s, p, true)).toBe(true);
    // Y no ha tocado el toggle: al volver a un comando normal, sigue en la fase de salida.
    expect(p.mount).toBe(0);
    expect(townNpcTailRuns(s, p, false)).toBe(false);
  });

  it("★ 'T' (Time stop) CONGELA: no corre nunca, ni siquiera a pie", () => {
    const p = phases();
    const s = st({ transportTile: 0x1c, timeSpell: "T" });
    for (let i = 0; i < 4; i++) expect(townNpcTailRuns(s, p, false)).toBe(false);
  });

  it("★ 'Q' (Quickness) MITAD: uno de cada dos, con su PROPIO toggle", () => {
    const p = phases();
    const s = st({ transportTile: 0x1c, timeSpell: "Q" });
    expect([0, 1, 2, 3].map(() => townNpcTailRuns(s, p, false))).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });

  it("★ montado + 'Q' se COMPONEN, y el que salta NO avanza el siguiente", () => {
    // Son variables distintas ([bp-4] y [bp-0xe]) y el `jne 0x1686` del primero se lleva el
    // turno entero, así que el toggle de Quickness sólo avanza en los turnos que pasan el
    // filtro de montado. Con ambos activos eso da uno de cada CUATRO.
    const p = phases();
    const s = st({ transportTile: 0x12, timeSpell: "Q" });
    const corridas = [0, 1, 2, 3, 4, 5, 6, 7].map(() => townNpcTailRuns(s, p, false));
    expect(corridas).toEqual([false, false, false, true, false, false, false, true]);
  });
});

// ------------------------------------------------------------------ cableado vivo ---
// La lógica pura de arriba no vale de nada si el call-site no la usa: es exactamente el
// género que ya mordió con bindTap (función sellada, cableado sin sellar). Este bloque
// entra por `Game` y mide el efecto OBSERVABLE — que el turno de NPC corra o no.

function makeChar(): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}
const PUEBLO = 5;
function townGame(over: Partial<GameState>): { game: Game; ticks: () => number } {
  const tiles = Array.from({ length: 32 }, () => Array<number>(32).fill(5));
  const smallMaps = new Map<number, SmallMapLocation>([
    [PUEBLO, { id: PUEBLO, name: "Villa", floors: [{ z: 0, tiles }] }],
  ]);
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(5));
  const world: WorldData = { overworld, underworld: overworld, smallMaps };
  const state = {
    version: 1,
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, magicCarpets: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0, position: { location: PUEBLO, floor: 0, x: 10, y: 10 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12, wind: 0,
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    ...over,
  } as GameState;
  // Contador del tick de NPC: el hook `afterHousekeeping` del turno de pueblo es justo lo
  // que la cadena gatea (npc_tick_all 0x166E), así que contar sus llamadas mide la puerta.
  let n = 0;
  const npcManager = {
    setRng() {}, enterMap() {}, npcAt: () => null,
    npcsAt: () => [], tickGuards() {}, tick: () => { n++; },
  };
  const doors = {
    tick() {}, isOpen: () => false, enterMap() {}, restore() {}, serialize: () => [],
    effectiveTile: (_l: number, _f: number, _x: number, _y: number, tile: number) => tile,
  };
  const game = new Game(
    {} as ExtractedInitialState, world,
    { locationsX: [], locationsY: [], locationNames: [] } as GameData,
    state, { npcManager, doors } as never,
  );
  return { game, ticks: () => n };
}

describe("cableado vivo: Game aplica la cadencia en el turno de pueblo", () => {
  it("a pie: el tick de NPC corre en los 4 turnos", () => {
    const { game, ticks } = townGame({ transport: "foot", transportTile: 0x1c });
    for (let i = 0; i < 4; i++) game.pass();
    expect(ticks()).toBe(4);
  });

  it("★ MONTADO andando por el pueblo: 4 pasos ⇒ 2 ticks (uno de cada dos)", () => {
    // OJO al detalle de diseño que esto expone: NO se puede probar con `pass()`, porque
    // ESPACIO es justamente la excepción que se salta el filtro (TOWN 0x162D). Hay que
    // entrar por un comando normal — un paso.
    const { game, ticks } = townGame({ transport: "horse", transportTile: 0x12 });
    for (let i = 0; i < 4; i++) game.move(i % 2 === 0 ? "south" : "north");
    expect(ticks()).toBe(2);
  });

  it("★ 'T' (Time stop) en pueblo: CERO ticks — antes el port los corría igual", () => {
    // El defecto que cierra la pieza: el port sólo se saltaba el 2º viento bajo 'T'
    // (`secondWorldTurn && timeSpell !== "T"`) y dejaba correr el wander. La puerta 0x1642
    // salta a 0x1686, que se lleva por delante guard_wander, npc_tick_all Y el npc_engine.
    const { game, ticks } = townGame({ transport: "foot", transportTile: 0x1c, timeSpell: "T" });
    for (let i = 0; i < 4; i++) game.pass();
    expect(ticks()).toBe(0);
  });
});
