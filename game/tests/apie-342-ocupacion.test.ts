/**
 * #342 — LA PARTY A PIE NO ATRAVIESA LA CASILLA DE UN ACTOR DEL EXTERIOR.
 *
 * Es la OTRA MITAD del bloque que #282 calcó para la vía naval, y la derivación se
 * re-leyó del disasm para esta ficha (no heredada del acta):
 *
 *  - `ship_try_move` (MAINOUT 0x01FE) resuelve el destino de TODO paso al aire libre,
 *    no sólo de los navales: censo de `call 0x1fe` = UNO, en `outdoor_move` 0x0514, y
 *    las cuatro ramas de dirección convergen en 0x050e antes de llamar. Ninguna puerta
 *    previa de `outdoor_move` excluye el ir a pie.
 *  - Que la vía A PIE comparte el bloque lo prueban sus DOS ramas propias: el régimen de
 *    abordaje `t < 0x20` (0x0245-0x0251 → 0x0253) y el discriminante de la cola de
 *    bloqueo 0x0312 `cmp [g_transport_tile],0x20 / jb 0x322`.
 *  - Dentro, el ACTOR se lee ANTES que el terreno (0x0236 `find_object_at_xy` → kernel
 *    0x368E) y su veredicto MANDA: con actor no abordable 0x0240 pone `[bp-2]=0` y
 *    0x029f salta por delante del test de passability de 0x02a8.
 *  - A PIE **no hay salida muda**: el gate del remolino (0x0319-0x0320) vive detrás del
 *    umbral de vehículo de 0x0312, así que el remolino da «Blocked!» como una pared.
 *
 * Los testigos de §1/§2 miden el JUEGO VIVO y no sólo la función pura por la misma razón
 * que en #282: el defecto vivía en el LLAMADOR (nadie consultaba la ocupación al andar),
 * así que un test de `isBoardableActorTile` a solas habría pasado con el bug intacto.
 */
import { describe, expect, it } from "vitest";
import { resolveStep } from "../src/core/world/movement.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { ActiveMap, WorldData } from "../src/core/world/map.js";
import type { OverworldEnemy } from "../src/core/world/enemies.js";

// --- fixture mínimo (mismo idioma que remolino-282-ocupacion.test.ts) ----------
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
    ...over,
  } as GameState;
}
/**
 * Sobremundo 256×256 de HIERBA (tile 5): pisable a pie en toda la rejilla. Con
 * `impasableEn` se pone AGUA PROFUNDA (tile 1, no pisable a pie) en una casilla.
 */
function grassWorld(impasableEn?: { x: number; y: number }): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(5));
  if (impasableEn) overworld[impasableEn.y]![impasableEn.x] = 1;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}
const gameData: GameData = { locationsX: [], locationNames: [], locationsY: [] };
function makeGame(s: GameState, impasableEn?: { x: number; y: number }): Game {
  return new Game({} as ExtractedInitialState, grassWorld(impasableEn), gameData, s, {});
}
/** Actor del exterior con el TILE dado, plantado en (x,y). */
function actorAt(tile: number, x: number, y: number): OverworldEnemy {
  return { defIndex: 1, tile, water: false, x, y, slot: 1 } as OverworldEnemy;
}

/** Un paso al NORTE desde (100,100), con el actor `tile` en la casilla destino. */
function pasoAlNorteCon(tile: number | null) {
  const st = makeState();
  const g = makeGame(st);
  if (tile !== null) g.overworldEnemies.enemies.push(actorAt(tile, 100, 99));
  const events = g.move("north");
  return {
    avanzo: events.some((e) => e.kind === "moved"),
    pos: { x: st.position.x, y: st.position.y },
    mensajes: events.flatMap((e) => (e.kind === "message" ? [e.text] : [])),
  };
}

describe("#342 §1 — a pie, el ACTOR bloquea el paso (MAINOUT 0x0236-0x0283)", () => {
  it("CONTROL POSITIVO: sin actor delante, el paso avanza a (100,99)", () => {
    const r = pasoAlNorteCon(null);
    expect(r.avanzo).toBe(true);
    expect(r.pos).toEqual({ x: 100, y: 99 });
  });

  it("un monstruo NO abordable bloquea aunque la hierba sea pisable", () => {
    // El observable de la ficha: antes del fix la party ATRAVESABA la casilla del actor,
    // porque `resolveStep` sólo miraba el terreno y la hierba es pisable.
    const r = pasoAlNorteCon(0x140); // 0x40: fuera de toda ventana de abordaje
    expect(r.avanzo).toBe(false);
    expect(r.pos).toEqual({ x: 100, y: 100 });
  });

  it("el REMOLINO a pie NO calla: «Blocked!» como una pared (0x0312 `jb 0x322`)", () => {
    // La salida muda de 0x0319-0x0320 está guardada por el umbral de VEHÍCULO: a pie
    // (g_transport_tile < 0x20) el flujo entra por 0x0322, que imprime.
    const r = pasoAlNorteCon(0x1ec);
    expect(r.avanzo).toBe(false);
    expect(r.pos).toEqual({ x: 100, y: 100 });
    expect(r.mensajes).toContain("Blocked!");
  });

  it("la NAVE PIRATA (0x2c) bloquea: la ventana de abordaje acaba en 0x2b", () => {
    // 0x0259 `cmp [bp-4],0x2c / jl 0x283` — 0x2c queda FUERA por un byte. Su tile en el
    // port es 300 = 0x12C, así que este caso es real y no sintético.
    const r = pasoAlNorteCon(0x12c);
    expect(r.avanzo).toBe(false);
    expect(r.pos).toEqual({ x: 100, y: 100 });
  });
});

describe("#342 §2 — los CUATRO transportes abordables siguen sin bloquear", () => {
  // Esperados EN CRUDO: los valores son los del binario (0x0253-0x026e), no derivados
  // del sujeto. A pie, `[bp-2]` vuelve a 1 y el destino lo decide el TERRENO — que aquí
  // es hierba pisable, así que el paso DEBE completarse.
  const abordables: ReadonlyArray<readonly [string, number]> = [
    ["fragata 0x24", 0x124],
    ["fragata, último de la ventana 0x2b", 0x12b],
    ["esquife 0x28", 0x128],
    ["caballo 0x1b", 0x11b],
    ["alfombra 0x10", 0x110],
    ["alfombra 0x11", 0x111],
  ];

  for (const [nombre, tile] of abordables) {
    it(`${nombre} no bloquea: la party entra en la casilla`, () => {
      const r = pasoAlNorteCon(tile);
      expect(r.avanzo).toBe(true);
      expect(r.pos).toEqual({ x: 100, y: 99 });
    });
  }

  it("un actor ABORDABLE sobre terreno IMPASABLE sigue bloqueando: las dos COMPONEN", () => {
    // 0x0283 sólo restaura `[bp-2]=1`; NO salta el test de terreno — el flujo cae igual
    // en 0x02a1-0x02a8. Avanzar exige actor-abordable-o-ausente **Y** terreno pisable.
    // Sin este aserto, un fix que tratase «abordable» como «pasa» quedaría sin testigo.
    const st = makeState();
    const g = makeGame(st, { x: 100, y: 99 }); // agua profunda al norte
    g.overworldEnemies.enemies.push(actorAt(0x124, 100, 99)); // fragata: abordable a pie

    const events = g.move("north");

    expect(events.some((e) => e.kind === "moved")).toBe(false);
    expect({ x: st.position.x, y: st.position.y }).toEqual({ x: 100, y: 100 });
  });
});

describe("#342 §3 — el gate de CAPA vive en el productor", () => {
  /** ActiveMap de PUEBLO (no envuelve): la cola gemela es `town_move` TOWN.OVL 0x0600. */
  const pueblo: ActiveMap = {
    kind: "small", location: 1, floor: 0,
    width: 32, height: 32, wraps: false, edgeFillTile: 5, tileAt: () => 5,
  };
  /** ActiveMap de EXTERIOR (envuelve): aquí sí manda MAINOUT 0x01FE. */
  const exterior: ActiveMap = {
    kind: "overworld", location: 0, floor: 0,
    width: 256, height: 256, wraps: true, edgeFillTile: -1, tileAt: () => 5,
  };

  it("en PUEBLO el actorTile NO bloquea: otra rutina del binario (TOWN 0x083a)", () => {
    const st = makeState({ position: { location: 1, floor: 0, x: 10, y: 10 } });
    const paso = resolveStep(st, pueblo, "north", 0x140);
    expect(paso.blocked).toBe(false);
    expect(paso.moved).toBe(true);
  });

  it("en EXTERIOR el MISMO actorTile sí bloquea — el discriminante es la capa", () => {
    const st = makeState();
    const paso = resolveStep(st, exterior, "north", 0x140);
    expect(paso.blocked).toBe(true);
    expect(paso.moved).toBe(false);
    expect(paso.message).toBe("Blocked!");
  });

  it("el centinela 0 deja la conducta previa INTACTA (0x023c `or ax,ax / je 0x288`)", () => {
    const st = makeState();
    const paso = resolveStep(st, exterior, "north", 0);
    expect(paso.blocked).toBe(false);
    expect(paso.moved).toBe(true);
  });
});
