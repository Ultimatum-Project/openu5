/**
 * Vista de gema de mazmorra fiel (E1-S9 bloque 2b): el mapa icónico del flood-fill.
 * Verifica que dibuja un glifo por celda CON icono (nibble alto ∈ tabla `draw_gem_map_tile`
 * 0x0670), blitado del charset **RUNES.CH** (carril gem-glyphs) y TEÑIDO con el color EGA
 * del binario; la SALA como glifo 0x73 (caja hueca RUNES) amarilla; y la party como glifo
 * 0x60 (rombo RUNES) VERDE centrado. El píxel de cada icono es fiel al font RUNES.CH.
 */
import { describe, expect, it } from "vitest";
import { paintGemMap } from "../src/skin/fiel/gemmap.js";
import type { FaithfulFont } from "../src/skin/fiel/font.js";
import type { GemView } from "../src/skin/api.js";

const GRAY = "#aaaaaa"; // EGA 7 (escaleras)
const WHITE = "#ffffff"; // EGA 15 (muro)
const YELLOW = "#ffff55"; // EGA 14 (cofre / puerta / sala)
const BLUE = "#0000aa"; // EGA 1 (muro especial / secreta)
const RED = "#ff5555"; // EGA 12 (trampa, 13ae+8)
const GREEN = "#55ff55"; // EGA 10 (party, 13b4+8)

/** Glifo de la party (RUNES 0x60): siempre presente, centrado. */
const PARTY = { code: 0x60, color: GREEN };

function spy() {
  const glyphs: Array<{ code: number; color?: string }> = [];
  let fillStyle = "";
  let strokeStyle = "";
  const fillRects: string[] = []; // color de cada fillRect (fondo negro + franjas de campo)
  const strokeRects: string[] = []; // color de cada strokeRect (no usado hoy)
  const strokes: string[] = []; // color de cada stroke() (rombo de fuente, vector)
  const runes = {
    drawGlyph(_ctx: unknown, code: number, _x: number, _y: number, _s: number, color?: string) {
      glyphs.push({ code, color });
    },
  } as unknown as FaithfulFont;
  const ctx = {
    fillRect() {
      fillRects.push(fillStyle);
    },
    strokeRect() {
      strokeRects.push(strokeStyle);
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {
      strokes.push(strokeStyle);
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    get fillStyle() {
      return fillStyle;
    },
    set strokeStyle(v: string) {
      strokeStyle = v;
    },
    get strokeStyle() {
      return strokeStyle;
    },
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
  return {
    runes,
    ctx,
    counts: () => ({
      glyphs,
      codes: glyphs.map((g) => g.code),
      fillRects: fillRects.length,
      whiteFills: fillRects.filter((c) => c === WHITE).length, // muros sólidos (IBM 0x7f)
      strokes,
    }),
  };
}

function grid(cells: Array<[number, number, number]>): number[][] {
  // Fondo = pasillo alcanzado (0x0, sin glifo). Las celdas dadas fijan su tipo.
  const g = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
  for (const [x, y, type] of cells) g[y]![x] = type;
  return g;
}

/** Rejilla de subtipos (nibble bajo) para el muro sólido (0) vs denso (!=0). */
function subGrid(cells: Array<[number, number, number]>): number[][] {
  const g = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
  for (const [x, y, s] of cells) g[y]![x] = s;
  return g;
}

function gem(over: Partial<GemView> = {}): GemView {
  return {
    environment: "dungeon",
    width: 8,
    height: 8,
    tiles: grid([]),
    marker: { x: 2, y: 2 },
    ...over,
  };
}

describe("paintGemMap (piel fiel, RUNES.CH)", () => {
  it("escalera gris (0x2e glifo RUNES); muro común (0xb0) = bloque blanco LLENO (IBM 0x7f)", () => {
    const { runes, ctx, counts } = spy();
    // Escalera↑ (0x1) en (0,0), muro sólido (0xb, sub 0) en (1,1); pasillo (0x0) no dibuja.
    paintGemMap(ctx, runes, gem({ tiles: grid([[0, 0, 0x1], [1, 1, 0xb]]) }));
    const c = counts();
    expect(c.glyphs.length).toBe(2); // escalera + party (el muro NO es glifo, es fillRect)
    expect(c.glyphs).toContainEqual({ code: 0x2e, color: GRAY }); // escalera ↑ gris
    expect(c.glyphs).toContainEqual(PARTY); // party = glifo 0x60 verde
    expect(c.whiteFills).toBe(1); // muro 0xb0 = bloque blanco lleno (fondo negro no cuenta)
  });

  it("muro decorado (0xbX, sub!=0) = glifo denso 0x74 RUNES blanco", () => {
    const { runes, ctx, counts } = spy();
    paintGemMap(ctx, runes, gem({
      tiles: grid([[1, 1, 0xb]]),
      sub: subGrid([[1, 1, 0x1]]), // sub 1 → caso raro (18/1944 celdas)
    }));
    const c = counts();
    expect(c.glyphs).toContainEqual({ code: 0x74, color: WHITE }); // caja densa RUNES
    expect(c.whiteFills).toBe(0); // no hay bloque lleno: es glifo
  });

  it("planta vacía (todo pasillo) no dibuja iconos, solo fondo + party", () => {
    const { runes, ctx, counts } = spy();
    paintGemMap(ctx, runes, gem());
    const c = counts();
    expect(c.glyphs).toEqual([PARTY]); // sólo el marcador de la party
    expect(c.fillRects).toBe(1); // sólo el fondo negro
  });

  it("celdas NO alcanzadas (-1) quedan negras (sin glifo)", () => {
    const { runes, ctx, counts } = spy();
    const tiles = grid([[0, 0, 0x1]]);
    // Marca el resto como no-alcanzado; solo la escalera de (0,0) + la party deben pintarse.
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (!(x === 0 && y === 0)) tiles[y]![x] = -1;
    paintGemMap(ctx, runes, gem({ tiles }));
    const c = counts();
    expect(c.glyphs.length).toBe(2); // escalera + party
    expect(c.glyphs).toContainEqual({ code: 0x2e, color: GRAY });
    expect(c.glyphs).toContainEqual(PARTY);
  });

  it("SALA (0xA/0xF) = glifo 0x73 (caja hueca RUNES) amarillo", () => {
    const { runes, ctx, counts } = spy();
    paintGemMap(ctx, runes, gem({ tiles: grid([[0, 0, 0xf], [1, 0, 0xa]]) }));
    const c = counts();
    const rooms = c.glyphs.filter((g) => g.code === 0x73);
    expect(rooms.length).toBe(2); // dos salas → dos glifos 0x73
    expect(rooms.every((g) => g.color === YELLOW)).toBe(true); // amarillas
  });

  it("cofre/puerta en amarillo; muro especial azul; trampa roja (0x72)", () => {
    const { runes, ctx, counts } = spy();
    paintGemMap(ctx, runes, gem({ tiles: grid([[0, 0, 0x4], [2, 0, 0xe], [3, 0, 0xc], [4, 0, 0x6]]) }));
    const c = counts();
    expect(c.glyphs).toContainEqual({ code: 0x70, color: YELLOW }); // cofre
    expect(c.glyphs).toContainEqual({ code: 0x77, color: YELLOW }); // puerta
    expect(c.glyphs).toContainEqual({ code: 0x75, color: BLUE }); // muro especial azul
    expect(c.glyphs).toContainEqual({ code: 0x72, color: RED }); // trampa roja (default de la rama)
  });

  it("secreta (0xd) = glifo distinto 0x76 azul (el binario la revela, no la oculta)", () => {
    const { runes, ctx, counts } = spy();
    paintGemMap(ctx, runes, gem({ tiles: grid([[0, 0, 0xd], [1, 1, 0xb]]) }));
    const c = counts();
    expect(c.glyphs).toContainEqual({ code: 0x76, color: BLUE }); // secreta distinta (0x062e mov ax,0x76)
    expect(c.whiteFills).toBe(1); // muro común (0xb0) = bloque blanco lleno
  });

  it("fuente (0x5) = rombo vector azul brillante; campo (0x8) = franjas multicolor", () => {
    const { runes, ctx, counts } = spy();
    paintGemMap(ctx, runes, gem({ tiles: grid([[0, 0, 0x5], [1, 0, 0x8]]) }));
    const c = counts();
    expect(c.strokes).toContain("#5555ff"); // fuente = rombo azul brillante (EGA 9)
    expect(c.fillRects).toBeGreaterThan(1); // fondo + 4 franjas del campo mágico
    // fuente/campo son vector: no producen glifo del font (salvo la party)
    expect(c.glyphs).toEqual([PARTY]);
  });
});
