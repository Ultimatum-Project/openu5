/**
 * Gema de MAZMORRA: NO embaldosa la planta 8×8 por todo el display 22×22 — pinta UN
 * SOLO blob = la región CONECTADA con la party. Es un flood-fill 8-conexo sembrado en
 * el centro (11,11) que corre en coordenadas de DISPLAY (DNGLOOK 0x06a8 driver +
 * 0x0340 `draw_gem_map_tile`).
 *
 * Fórmula del wrap por cada celda de display (dispCol, dispRow) — la MISMA de antes:
 *   worldX = (dispCol + party_x − 11) & 7   (0x0388: `add party_x` / `sub 0xb` / `and 7`)
 *   worldY = (dispRow + party_y − 11) & 7   (0x039c análogo con party_y)
 * Pero sólo se PINTAN las celdas que el flood alcanza: los muros/secretas (nibble
 * 0xB/0xC/0xD) se pintan como FRONTERA del blob pero NO propagan (ponen a 0 el
 * resultado en 0x0608 → el driver no las encola en 0x0785). Las celdas nunca
 * alcanzadas quedan NEGRAS (sentinela −1; buffer de visitados a 0xFF en el binario).
 * El centro se pre-marca visitado (0x0705) y NO dibuja su icono (sólo el marcador).
 */
import { describe, expect, it } from "vitest";
import {
  buildGemView,
  DUNGEON_GEM_DISPLAY,
  DUNGEON_GEM_CENTER,
  DUNGEON_GEM_UNREACHED,
  DUNGEON_GEM_BLOCKERS,
} from "../src/core/world/gem-view.js";
import { DungeonState, type DungeonData, type DungeonCell } from "../src/core/dungeon/dungeon.js";
import type { GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";

const C = DUNGEON_GEM_CENTER;
const N = DUNGEON_GEM_DISPLAY;

/** Planta 8×8 cuyo `type` en (x,y) lo fija `cell(x,y)`. `sub` = 0. */
function dungeonWith(cell: (x: number, y: number) => number): DungeonData {
  const floors: DungeonData["floors"] = [
    Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x): DungeonCell => ({ type: cell(x, y), sub: 0 })),
    ),
  ];
  return { location: 33, name: "TEST", floors };
}

/**
 * Paleta de tipos SIN bloqueadores (evita 0xB/0xC/0xD): así el flood alcanza toda la
 * ventana y podemos comprobar la geometría del wrap sobre celdas distintivas.
 */
const NONBLOCK = [0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xe, 0xf] as const;
const openType = (x: number, y: number) => NONBLOCK[((x & 7) + 2 * (y & 7)) % NONBLOCK.length]!;
const openDungeon = dungeonWith(openType);

function stateAt(): GameState {
  // Con dungeon != null buildGemView ignora state.position (manda el dungeon).
  return { position: { location: 0x21, floor: 0, x: 0, y: 0 } } as unknown as GameState;
}

const world = {} as unknown as WorldData;

function gemAt(data: DungeonData, px: number, py: number) {
  const dungeon = new DungeonState([data], { dungeon: 33, floor: 0, x: px, y: py, facing: "north" });
  return buildGemView(stateAt(), world, dungeon);
}

describe("buildGemView — gema de mazmorra (flood-fill conectado)", () => {
  it("ventana 22×22 con el marcador FIJO en el centro (11,11)", () => {
    const gv = gemAt(openDungeon, 5, 3);
    expect(gv.environment).toBe("dungeon");
    expect(gv.width).toBe(N);
    expect(gv.height).toBe(N);
    expect(gv.tiles.length).toBe(N);
    expect(gv.tiles.every((row) => row.length === N)).toBe(true);
    expect(gv.marker).toEqual({ x: C, y: C });
  });

  it("planta SIN muros: el flood alcanza TODA la ventana salvo el centro (sentinela)", () => {
    const gv = gemAt(openDungeon, 5, 3);
    // El centro se pre-marca visitado y NO pinta su icono (sólo el marcador): sentinela.
    expect(gv.tiles[C]![C]).toBe(DUNGEON_GEM_UNREACHED);
    // El resto de la ventana está alcanzado y sigue la fórmula del wrap.
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        if (row === C && col === C) continue;
        const wx = (col + 5 - C) & 7;
        const wy = (row + 3 - C) & 7;
        expect(gv.tiles[row]![col]).toBe(openType(wx, wy));
      }
    }
  });

  it("un muro (0xB/0xC/0xD) CORTA el flood: se pinta como frontera pero no propaga", () => {
    // Planta abierta salvo la fila-mundo y=0, que es MURO. Party en (4,4): la fila-mundo 0
    // cae en las filas de display 7 y 15 ((7+4−11)&7=0). El flood queda ENCAJONADO entre
    // esos muros → alcanza filas 8..14 (abiertas) + 7 y 15 (muros dibujados); el resto NEGRO.
    const walled = dungeonWith((_x, y) => (y === 0 ? 0xb : 0x0));
    const gv = gemAt(walled, 4, 4);

    // Filas de muro: alcanzadas (frontera del blob) y con el tipo muro.
    for (const wallRow of [7, 15]) {
      for (let col = 0; col < N; col++) expect(gv.tiles[wallRow]![col]).toBe(0xb);
    }
    // Filas interiores (abiertas) alcanzadas, salvo el centro.
    for (let row = 8; row <= 14; row++) {
      for (let col = 0; col < N; col++) {
        if (row === C && col === C) continue;
        expect(gv.tiles[row]![col]).toBe(0x0);
      }
    }
    // Filas fuera del cajón: NEGRAS (el flood no cruza los muros).
    for (const outRow of [0, 6, 16, 21]) {
      for (let col = 0; col < N; col++) expect(gv.tiles[outRow]![col]).toBe(DUNGEON_GEM_UNREACHED);
    }
  });

  it("cofres, puertas y salas NO cortan el flood (0x4/0xE/0xF fuera de la lista)", () => {
    for (const t of [0x4, 0xe, 0xf]) {
      expect(DUNGEON_GEM_BLOCKERS.has(t)).toBe(false);
      const withFeature = dungeonWith((x, y) => (x === 0 && y === 0 ? t : 0x0));
      const gv = gemAt(withFeature, 4, 4);
      // Toda la ventana (salvo centro) sigue alcanzada: la feature no encajona nada.
      const unreached = gv.tiles.flat().filter((v) => v === DUNGEON_GEM_UNREACHED).length;
      expect(unreached).toBe(1); // sólo el centro
    }
  });

  it("una celda-mundo aparece en VARIAS celdas de display (flood en espacio de display)", () => {
    // Sin muros el flood alcanza toda la ventana; el patrón 8×8 se repite toroidalmente,
    // así que una misma celda-mundo cae en display (r,c) y (r,c+8), ambas alcanzadas e
    // iguales (el corazón del encargo: el flood corre en coords de DISPLAY, no de mundo).
    const gv = gemAt(openDungeon, 5, 3);
    let pairs = 0;
    for (let row = 0; row < N; row++) {
      for (let col = 0; col + 8 < N; col++) {
        if ((row === C && col === C) || (row === C && col + 8 === C)) continue;
        expect(gv.tiles[row]![col]).not.toBe(DUNGEON_GEM_UNREACHED);
        expect(gv.tiles[row]![col + 8]).toBe(gv.tiles[row]![col]);
        pairs++;
      }
    }
    expect(pairs).toBeGreaterThan(0);
  });

  it("blob pequeño: 3×3 abierto rodeado de muro → sólo ese bloque y su borde", () => {
    // Mundo: todo MURO salvo un 3×3 abierto en (3..5, 3..5). Party en (4,4) (centro del
    // hueco). El flood llena las 9 celdas abiertas + su anillo de muro (frontera), y NO
    // salta a las COPIAS del hueco (separadas por muro; 8-conexo no cruza 2 celdas).
    const open3 = dungeonWith((x, y) => (x >= 3 && x <= 5 && y >= 3 && y <= 5 ? 0x0 : 0xb));
    const gv = gemAt(open3, 4, 4);

    // Party en (4,4): world (4,4) → display (11,11). El hueco abierto (3..5,3..5) cae en
    // display (10..12, 10..12). Centro sentinela; las otras 8 abiertas alcanzadas.
    for (let row = 10; row <= 12; row++) {
      for (let col = 10; col <= 12; col++) {
        if (row === C && col === C) continue;
        expect(gv.tiles[row]![col]).toBe(0x0);
      }
    }
    // Anillo de muro inmediato (display 9 y 13) alcanzado como frontera.
    for (let d = 9; d <= 13; d++) {
      expect(gv.tiles[9]![d]).toBe(0xb);
      expect(gv.tiles[13]![d]).toBe(0xb);
      expect(gv.tiles[d]![9]).toBe(0xb);
      expect(gv.tiles[d]![13]).toBe(0xb);
    }
    // Más allá del anillo: NEGRO (las copias del hueco NO se alcanzan).
    for (const p of [0, 8, 14, 21]) {
      expect(gv.tiles[p]!.every((v) => v === DUNGEON_GEM_UNREACHED)).toBe(true);
    }
  });

  it("wrap en el borde de la planta: party en (0,0), vecinas alcanzadas con wrap 0..7", () => {
    const gv = gemAt(openDungeon, 0, 0);
    // Izquierda del centro: world x wrap a 7. Arriba: world y wrap a 7. Ambas alcanzadas.
    expect(gv.tiles[C]![C - 1]).toBe(openType(7, 0));
    expect(gv.tiles[C - 1]![C]).toBe(openType(0, 7));
    // Toda celda es un tipo válido (0..0xf) o el sentinela (−1) del centro/no-alcanzado.
    expect(gv.tiles.flat().every((t) => t === DUNGEON_GEM_UNREACHED || (t >= 0 && t <= 0xf))).toBe(true);
  });
});
