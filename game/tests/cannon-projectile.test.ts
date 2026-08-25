/**
 * VUELO DEL CAÑONAZO (#313, resto de #298) — EL ESLABÓN ENTERO: emitir → consumir → PINTAR.
 *
 * Deriva de `CMDS.OVL` (ver `re/notes/cannon-fire.md` §4). Lo DERIVADO y lo que aquí se sella:
 *  · UN vuelo por disparo, no por celda: los tres call-sites del stub relocado 0xffffbc6a son
 *    0x0A45 (andanada con impacto), 0x0AD2 (andanada sin impacto) y 0x0CFE (cañón a pie), y
 *    los tres están FUERA del bucle del rayo.
 *  · Las DOS superficies lo piden — si el port sólo cablea una, está mal.
 *  · Los alcances NO son el mismo número: andanada 3 (`cmp 3`, 0x0AA5) y a pie 4 (contador 5
 *    con pre-decremento, 0x0C15/0x0C2C). La ficha #311 dio 3 para las dos al generalizar el de
 *    la andanada; el disasm y el port ya decían 4 desde #32.
 *  · El ORIGEN tampoco: la andanada empuja `5,5` (el centro = el barco) y el cañón a pie empuja
 *    la celda del CAÑÓN (0x0BAD/0x0BB9, sin re-escribir en el bucle).
 * La CADENCIA con que la piel recorre ese trayecto NO está aquí y no puede estarlo: vive tras
 * el far-call relocado y es Clase C prestada (ficha #311; ver `skin/world-fx.ts`).
 *
 * 🔴 POR QUÉ EL FICHERO LLEGA HASTA EL PINTOR. La clase #278 («emitir sin consumidor es no
 * hacer nada, en silencio») y la #253 (lo que la fiel hornea y la SHADER —la piel de FÁBRICA—
 * tapa al recomponer el viewport) hacen que un test que sólo mire el EVENTO dé verde con el
 * jugador sin ver nada. Por eso hay tres bloques, uno por eslabón, y el último ejecuta el
 * método REAL de la shader contra un mini-rasterizador.
 * LO QUE NO CUBRE, declarado: que `paintCannonball` se LLAME desde el compose lo vigila una
 * guarda de FUENTE (último bloque) porque `ShaderSkin` no monta en jsdom, que no trae canvas
 * — la misma frontera declarada en `render-fx-junta.test.ts`.
 *
 * MUTANTES SEMBRADOS SOBRE LA BASE YA COMMITEADA (9304530e) — los SEIS enrojecieron, con el
 * árbol restaurado byte a byte después de cada uno. Un fichero que nace verde no acredita
 * nada hasta que se le enseña un defecto que sí distingue:
 *   M1 emitir POR CELDA en el cañón a pie (no una vez por disparo) ......... 2 rojos
 *   M2 alcance del cañón a pie = 3, copiado de la andanada ................. 1 rojo
 *   M3 origen del cañón a pie = el GRUPO en vez de la celda del cañón ...... 2 rojos
 *   M4 emitir SÓLO en una superficie (se cae la andanada) ................. 2 rojos
 *   M5 la shader usa `VIEWPORT.tile` (lógico) en vez de la celda de disp. .. 1 rojo
 *   M6 el compose NO llama al pintor (fx correcto al que nadie llama) ...... 1 rojo
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData, type GameEvent } from "../src/core/game.js";
import type { WorldData, SmallMapLocation } from "../src/core/world/map.js";
import { BROADSIDE_RANGE, CANNON_FOOT_RANGE } from "../src/core/world/cannon.js";
import {
  WorldFxLayer,
  PROJECTILE_MS_PER_CELL_BORROWED,
  type WorldFxProjectile,
} from "../src/skin/world-fx.js";
import { ShaderSkin } from "../src/skin/shader/skin.js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ_GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FLOOR = 0x44;
const WALL = 0xb8; // RegularDoor: sólido para el cañón (0xB8-0xBB)
const CANNON_E = 0xb5; // dispara al ESTE (tile&3 = 1)
const WEST_WINDS = 5;

function makeChar(): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff,
    ring: 0xff, amulet: 0xff, partyStatus: 0,
  } as CharacterState;
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, keys: 5, skullKeys: 0, karma: 50, npcDead: [],
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: WEST_WINDS, floor: 0, x: 10, y: 10 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [],
  attackRangeValues: [], defenseValues: [],
};

function makeGame(st: GameState, setup?: (tiles: number[][]) => void): Game {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => FLOOR));
  setup?.(tiles);
  const smallMaps = new Map<number, SmallMapLocation>();
  smallMaps.set(WEST_WINDS, { id: WEST_WINDS, name: "West Winds", floors: [{ z: 0, tiles }] });
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 1));
  const world: WorldData = { overworld, underworld: overworld, smallMaps };
  const systems = { combatResources } as unknown as ConstructorParameters<typeof Game>[4];
  return new Game({} as ExtractedInitialState, world, gameData, st, systems);
}

/** Los `cell-projectile` del batch, con su payload. UNO por disparo es el invariante. */
const vuelos = (evs: GameEvent[]): NonNullable<GameEvent["projectileFx"]>[] =>
  evs.filter((e) => e.kind === "cell-projectile").map((e) => e.projectileFx!);

// ── ESLABÓN 1: el CORE emite ────────────────────────────────────────────────────────
describe("#313 §1 — el core emite el vuelo en las DOS superficies (CMDS 0x0A45/0x0AD2/0x0CFE)", () => {
  it("ANDANADA sin objetivo: UN vuelo del barco al final del rayo (0x0AD2, alcance 3)", () => {
    const st = makeState({
      transport: "ship", transportTile: 0x20, // fragata proa N/S ⇒ E/O es perpendicular
      position: { location: 0, floor: 0, x: 100, y: 100 },
    });
    const v = vuelos(makeGame(st).fire("east"));
    expect(v).toHaveLength(1); // 🔴 MUTANTE (b): emitir POR CELDA daría 3
    expect(v[0]).toEqual({ fromDx: 0, fromDy: 0, toDx: BROADSIDE_RANGE, toDy: 0 });
    expect(BROADSIDE_RANGE).toBe(3); // el esperado EN CRUDO, no derivado del sujeto
  });

  it("ANDANADA con impacto: el destino es la celda del OBJETO, no el final del rayo (0x0A45)", () => {
    const st = makeState({
      transport: "ship", transportTile: 0x20,
      position: { location: 0, floor: 0, x: 100, y: 100 },
    });
    const g = makeGame(st);
    g.reseed(1234);
    g.overworldEnemies.enemies.push({ defIndex: 0, tile: 0x2c, water: true, x: 102, y: 100, hull: 99 });
    const v = vuelos(g.fire("east"));
    expect(v).toHaveLength(1);
    expect(v[0]).toEqual({ fromDx: 0, fromDy: 0, toDx: 2, toDy: 0 }); // el pirata está a 2
  });

  it("ANDANADA rechazada (paralela a la quilla) NO emite vuelo — el gate va antes del stub", () => {
    const st = makeState({
      transport: "ship", transportTile: 0x20,
      position: { location: 0, floor: 0, x: 100, y: 100 },
    });
    expect(vuelos(makeGame(st).fire("north"))).toHaveLength(0);
  });

  it("CAÑÓN A PIE: UN vuelo que sale de la celda del CAÑÓN y llega a 4 (0x0CFE)", () => {
    // Cañón al ESTE del grupo (10,10) → celda (11,10); dispara al este; nada que golpear.
    const st = makeState();
    const v = vuelos(makeGame(st, (t) => { t[10]![11] = CANNON_E; }).fireCannon());
    expect(v).toHaveLength(1); // 🔴 MUTANTE (b) otra vez, en la otra superficie
    // 🔴 MUTANTE: origen (0,0) —el grupo— en vez de (1,0) —el cañón— pasa el resto y falla aquí.
    expect(v[0]).toEqual({ fromDx: 1, fromDy: 0, toDx: 1 + CANNON_FOOT_RANGE, toDy: 0 });
    expect(CANNON_FOOT_RANGE).toBe(4); // 🔴 MUTANTE (c): un 3 copiado de la andanada muere aquí
  });

  it("CAÑÓN A PIE con muro: el vuelo PARA en la celda reventada, no sigue hasta el alcance", () => {
    const st = makeState();
    const evs = makeGame(st, (t) => {
      t[10]![11] = CANNON_E; // cañón a la derecha del grupo
      t[10]![13] = WALL; // 2 celdas al este de la del cañón
    }).fireCannon();
    const v = vuelos(evs);
    expect(v).toHaveLength(1);
    expect(v[0]).toEqual({ fromDx: 1, fromDy: 0, toDx: 3, toDy: 0 }); // (13,10) − (10,10)
    expect(evs.some((e) => e.text === "Door destroyed!")).toBe(true); // llegó y reventó
  });

  it("SIN cañón adyacente no hay vuelo (el «What?» de 0x0BDE sale antes del stub)", () => {
    expect(vuelos(makeGame(makeState()).fireCannon())).toHaveLength(0);
  });

  it("el vuelo NO añade tiradas: la única del comando sigue siendo el rand(1,20) del daño", () => {
    // CONTROL de paridad: dos disparos idénticos desde la MISMA semilla dan el mismo casco.
    // Si el cableado hubiera metido una tirada, el segundo estado divergiría.
    const casco = (): number => {
      const st = makeState({
        transport: "ship", transportTile: 0x20,
        position: { location: 0, floor: 0, x: 100, y: 100 },
      });
      const g = makeGame(st);
      g.reseed(4242);
      g.overworldEnemies.enemies.push({ defIndex: 0, tile: 0x2c, water: true, x: 101, y: 100, hull: 99 });
      g.fire("east");
      return g.overworldEnemies.enemies.find((e) => e.x === 101)!.hull!;
    };
    expect(casco()).toBe(casco());
    expect(casco()).toBeLessThan(99); // control positivo: el daño SÍ ocurre (no es un empate vacuo)
  });
});

// ── ESLABÓN 2: la CAPA lo consume y lo anima ────────────────────────────────────────
describe("#313 §2 — la capa de fx del mundo interpola el vuelo y se purga sola", () => {
  const FX: WorldFxProjectile = { kind: "cellProjectile", fromDx: 1, fromDy: 0, toDx: 5, toDy: 0 };
  const DUR = 4 * PROJECTILE_MS_PER_CELL_BORROWED; // 4 celdas de recorrido

  it("dura una cadencia POR CELDA recorrida (Chebyshev), no un tiempo fijo", () => {
    expect(WorldFxLayer.durationMs(FX)).toBe(DUR);
    const corto: WorldFxProjectile = { kind: "cellProjectile", fromDx: 0, fromDy: 0, toDx: 1, toDy: 0 };
    expect(WorldFxLayer.durationMs(corto)).toBe(PROJECTILE_MS_PER_CELL_BORROWED);
  });

  it("pinta un PUNTO (no un tile) que avanza del origen al destino", () => {
    const layer = new WorldFxLayer();
    layer.push(FX, 0);
    const dots: number[][] = [];
    const tiles: number[][] = [];
    const painter = {
      blit: (t: number, dx: number, dy: number) => void tiles.push([t, dx, dy]),
      dot: (dx: number, dy: number) => void dots.push([dx, dy]),
    };
    layer.paint(0, painter);
    layer.paint(DUR / 2, painter);
    layer.paint(DUR - 1, painter);
    expect(tiles).toEqual([]); // el proyectil NO va por la vía del blit de tile
    expect(dots).toHaveLength(3);
    expect(dots[0]).toEqual([1, 0]); // arranca EN el origen
    expect(dots[1]).toEqual([3, 0]); // mitad del trayecto
    expect(dots[2]![0]).toBeGreaterThan(4.9); // casi en el destino, sin pasarse
    expect(dots[2]![0]).toBeLessThan(5);
  });

  it("se purga solo al agotarse (nadie tiene que acordarse de limpiarlo)", () => {
    const layer = new WorldFxLayer();
    layer.push(FX, 0);
    expect(layer.active).toBe(true);
    layer.paint(DUR, { blit: () => {}, dot: () => {} });
    expect(layer.active).toBe(false);
  });

  it("`projectileAt` es PURA: leerla no purga ni avanza la capa", () => {
    const layer = new WorldFxLayer();
    layer.push(FX, 0);
    for (let i = 0; i < 50; i++) layer.projectileAt(DUR + 1000); // muy pasada de rosca
    expect(layer.active).toBe(true); // sigue viva: sólo `paint` purga
    expect(layer.projectileAt(DUR / 2)).toEqual({ dx: 3, dy: 0 });
    expect(layer.projectileAt(DUR + 1)).toBeNull(); // fuera de ventana, sin pintar
  });
});

// ── ESLABÓN 3: la piel de FÁBRICA lo PINTA ──────────────────────────────────────────
/** Rasterizador mínimo: sólo `fillRect` + `fillStyle`, que es todo lo que usa el pintor. */
class MiniRaster {
  readonly rects: { x: number; y: number; w: number; h: number; style: string }[] = [];
  fillStyle = "";
  fillRect(x: number, y: number, w: number, h: number): void {
    this.rects.push({ x, y, w, h, style: String(this.fillStyle) });
  }
}

describe("#313 §3 — la piel SHADER (la de FÁBRICA) pinta el vuelo sobre su viewport", () => {
  const WR = { x: 40, y: 24 };
  const SIZE = 11 * 16; // 11 celdas de 16 px de dispositivo

  /** Empuja un vuelo en la capa de la fiel INTERNA de la shader y pinta con el método real. */
  function pintar(fx: WorldFxProjectile, now: number): MiniRaster {
    const skin = new ShaderSkin() as unknown as Record<string, unknown>;
    const fiel = skin.faithful as unknown as Record<string, unknown>;
    (fiel.worldFx as WorldFxLayer).push(fx, 0);
    const raster = new MiniRaster();
    const paint = skin.paintCannonball as (...a: unknown[]) => void;
    paint.call(skin, raster, WR, SIZE, now);
    return raster;
  }

  it("pinta el punto en la celda interpolada, en píxeles de DISPOSITIVO", () => {
    // Del centro (0,0) a 3 al este; a mitad de vuelo va por la celda 5+1.5 = 6.5 de la ventana.
    const fx: WorldFxProjectile = { kind: "cellProjectile", fromDx: 0, fromDy: 0, toDx: 3, toDy: 0 };
    const r = pintar(fx, (3 * PROJECTILE_MS_PER_CELL_BORROWED) / 2);
    expect(r.rects).toHaveLength(1);
    const cell = SIZE / 11;
    // 🔴 El mutante de la trampa medida: usar `VIEWPORT.tile` (16 lógicos) en vez de `cell`
    // pinta el punto en otro sitio en cuanto el zoom no es 1 — aquí cell = 16 y coinciden, así
    // que el aserto se hace SOBRE LA ARITMÉTICA del centro de celda, que sí discrimina.
    expect(r.rects[0]!.x).toBeCloseTo(WR.x + 6.5 * cell + (cell - r.rects[0]!.w) / 2, 6);
    expect(r.rects[0]!.y).toBeCloseTo(WR.y + 5 * cell + (cell - r.rects[0]!.h) / 2, 6);
    expect(r.rects[0]!.style.toLowerCase()).toBe("#ffffff");
  });

  it("el punto ESCALA con el zoom: a doble tamaño de viewport, doble lado y doble offset", () => {
    const fx: WorldFxProjectile = { kind: "cellProjectile", fromDx: 0, fromDy: 0, toDx: 2, toDy: 0 };
    const chico = pintar(fx, 0);
    const skin = new ShaderSkin() as unknown as Record<string, unknown>;
    const fiel = skin.faithful as unknown as Record<string, unknown>;
    (fiel.worldFx as WorldFxLayer).push(fx, 0);
    const grande = new MiniRaster();
    (skin.paintCannonball as (...a: unknown[]) => void).call(skin, grande, WR, SIZE * 2, 0);
    expect(grande.rects[0]!.w).toBe(chico.rects[0]!.w * 2);
    // 🔴 Éste es el mutante que mata el `VIEWPORT.tile` cableado: con la constante lógica el
    // lado NO cambiaría y la posición se quedaría pegada arriba a la izquierda.
    expect(grande.rects[0]!.x - WR.x).toBeCloseTo((chico.rects[0]!.x - WR.x) * 2, 6);
  });

  it("sin vuelo vivo no pinta nada (no ensucia el viewport entre disparos)", () => {
    const skin = new ShaderSkin() as unknown as Record<string, unknown>;
    const raster = new MiniRaster();
    (skin.paintCannonball as (...a: unknown[]) => void).call(skin, raster, WR, SIZE, 1000);
    expect(raster.rects).toEqual([]);
  });

  it("un vuelo que se sale de la ventana 11×11 se recorta en vez de pintar fuera", () => {
    const fx: WorldFxProjectile = { kind: "cellProjectile", fromDx: 0, fromDy: 0, toDx: 40, toDy: 0 };
    const r = pintar(fx, WorldFxLayer.durationMs(fx) * 0.9); // muy pasado el borde
    expect(r.rects).toEqual([]);
  });

  /**
   * GUARDA DE FUENTE, declarada como tal: comprueba que el compose LLAMA al pintor y que lo
   * hace en su sitio (tras el terremoto, antes de las inversiones XOR). No sustituye a un
   * navegador —`ShaderSkin` no monta en jsdom— pero cierra el hueco que deja un pintor
   * correcto al que nadie llama, que es exactamente la avería de la clase #278.
   */
  it("el compose de la shader LLAMA a paintCannonball, entre el terremoto y las inversiones", () => {
    const src = readFileSync(resolve(RAIZ_GAME, "src/skin/shader/skin.ts"), "utf8");
    const iQuake = src.indexOf("this.paintQuakeShift(ctx, wr, qoff * s)");
    const iBala = src.indexOf("this.paintCannonball(ctx, wr, size, now)");
    // Ancla por PREFIJO (sin paréntesis de cierre): #295 le añadió `terrainOnly` a la llamada
    // en la confluencia y el literal cerrado dio -1 — el ORDEN que se afirma no depende de la
    // aridad del callee, así que el ancla tampoco debe.
    const iXor = src.indexOf("this.paintViewportInversions(ctx, wr, size, snap, now");
    expect(iQuake).toBeGreaterThan(0); // control positivo: los tres anclajes existen HOY
    expect(iBala).toBeGreaterThan(0);
    expect(iXor).toBeGreaterThan(0);
    expect(iQuake).toBeLessThan(iBala);
    expect(iBala).toBeLessThan(iXor);
  });
});
