/**
 * Decoración procedural del pasillo 3D (careo decor-mazmorra + re-disasm):
 * goteo de estalactita (máquina 0x145c, disparos fn_150a/fn_1682) y destello
 * del esqueleto DNG3 (0x15fa-0x165c). Fija el PLAN (qué celdas gatillan y a qué
 * profundidad), la máquina de estados (avance rand sólo en estado 0; reset
 * incondicional en 5) y las tablas de posición byte-exactas de DATA.OVL.
 */
import { describe, expect, it } from "vitest";
import { paintDungeon, planDungeonView, type DecorOp } from "../src/skin/fiel/dungeon.js";
import {
  DungeonDecorState,
  dripFrontPos,
  dripRects,
  dripSidePos,
  glintRects,
} from "../src/skin/fiel/dungeon-decor.js";
import type { DungeonCellView, DungeonViewInfo } from "../src/skin/api.js";

function cell(x: number, y: number, type: number, sub = 0): DungeonCellView {
  return { x, y, type, sub, secretRevealed: false };
}
const open = (x: number, y: number): DungeonCellView => cell(x, y, 0x0);
const wall = (x: number, y: number): DungeonCellView => cell(x, y, 0xb);
const special = (x: number, y: number): DungeonCellView => cell(x, y, 0xc);

function view(over: Partial<DungeonViewInfo> = {}): DungeonViewInfo {
  return {
    floor: 0,
    facing: "north",
    pos: { x: 3, y: 3 },
    lightDepth: 4,
    lit: true,
    wallVariant: 1,
    cells: [],
    ...over,
  };
}

const decorOps = (dv: DungeonViewInfo): DecorOp[] =>
  planDungeonView(dv).filter((o): o is DecorOp => o.op === "decor");

describe("plan de decoración (disparos fn_150a / fn_1682)", () => {
  it("muro especial FRONTAL a prof 1-2 en DNG1 → dripFront; a prof 3 NO", () => {
    // 0xC de frente a 2 celdas: (3,3),(3,2) abiertas, (3,1) especial.
    const dv = view({
      cells: [open(3, 3), open(3, 2), special(3, 1), open(2, 3), open(4, 3), open(2, 2), open(4, 2)],
    });
    expect(decorOps(dv)).toEqual([
      { op: "decor", kind: "dripFront", depth: 2, cellX: 3, cellY: 1 },
    ]);
    // A prof 3 (0x155f: sólo prof 1 ó 2) no hay disparo.
    const dv3 = view({
      cells: [
        open(3, 3), open(3, 2), open(3, 1), special(3, 0),
        open(2, 3), open(4, 3), open(2, 2), open(4, 2), open(2, 1), open(4, 1),
      ],
    });
    expect(decorOps(dv3)).toEqual([]);
  });

  it("muro especial LATERAL a prof 0-1 → dripSide con el lado y la celda DUEÑA; prof 2 NO", () => {
    // Especial a la izquierda de la party (prof 0) y a la derecha de la celda prof 1.
    const dv = view({
      cells: [
        open(3, 3), special(2, 3), wall(4, 3),
        open(3, 2), wall(2, 2), special(4, 2),
        open(3, 1), special(2, 1), wall(4, 1), // prof 2: fn_1682 corta en prof≥2
        wall(3, 0),
      ],
    });
    expect(decorOps(dv)).toEqual([
      { op: "decor", kind: "dripSide", depth: 0, side: "left", cellX: 2, cellY: 3 },
      { op: "decor", kind: "dripSide", depth: 1, side: "right", cellX: 4, cellY: 2 },
    ]);
  });

  it("variante ≠1: sin goteo (gate [0x6604]==1); variante 3 con 0xC frontal a prof 1 → glint", () => {
    const cells = [open(3, 3), special(3, 2), special(2, 3), wall(4, 3)];
    expect(decorOps(view({ cells, wallVariant: 2 }))).toEqual([]);
    expect(decorOps(view({ cells, wallVariant: 3 }))).toEqual([
      { op: "decor", kind: "glint", depth: 1, cellX: 3, cellY: 2 },
    ]);
    // En DNG1 el mismo 0xC frontal a prof 1 es goteo (más el lateral prof 0).
    expect(decorOps(view({ cells, wallVariant: 1 }))).toEqual([
      { op: "decor", kind: "dripSide", depth: 0, side: "left", cellX: 2, cellY: 3 },
      { op: "decor", kind: "dripFront", depth: 1, cellX: 3, cellY: 2 },
    ]);
  });
});

describe("máquina de la gota 0x145c", () => {
  it("estado 0 sólo avanza con rand(0,64)<4; estados 1-4 avanzan CADA redibujo; 5 = reset sin dibujo", () => {
    // rng=0 → rand(0,64)=0 <4: siempre acierta.
    const hit = new DungeonDecorState(() => 0);
    const seq = Array.from({ length: 7 }, () => hit.stepDrip("k"));
    // Dibuja 0,1,2,3,4; frame 6 = estado 5 (null, reset); frame 7 vuelve a 0.
    expect(seq).toEqual([0, 1, 2, 3, 4, null, 0]);

    // rng alto → rand≥4: la gota se queda COLGANDO en 0 (pero 1-4 avanzan igual).
    const miss = new DungeonDecorState(() => 0.99);
    expect([miss.stepDrip("k"), miss.stepDrip("k"), miss.stepDrip("k")]).toEqual([0, 0, 0]);
  });

  it("estado por CELDA independiente (Map floor:x:y)", () => {
    const s = new DungeonDecorState(() => 0);
    expect(s.stepDrip("0:2:3")).toBe(0);
    expect(s.stepDrip("0:2:3")).toBe(1);
    expect(s.stepDrip("0:4:2")).toBe(0); // otra celda arranca de 0
  });
});

describe("tablas de posición (DATA.OVL DS+0x10, +14 aplicado)", () => {
  it("frontal: X=95; prof1=[54,61,80,114,160], prof2=[60,64,76,96,123] (0x2e8b)", () => {
    for (let st = 0; st < 5; st++) {
      expect(dripFrontPos(1, st)).toEqual({ x: 95, y: [54, 61, 80, 114, 160][st] });
      expect(dripFrontPos(2, st)).toEqual({ x: 95, y: [60, 64, 76, 96, 123][st] });
    }
  });

  it("lateral: X izq 33/67, der espejo 0xBE−X = 157/123; Y por 0x2e9a", () => {
    expect(dripSidePos(0, "left", 0)).toEqual({ x: 33, y: 28 });
    expect(dripSidePos(0, "right", 4)).toEqual({ x: 157, y: 173 });
    expect(dripSidePos(1, "left", 2)).toEqual({ x: 67, y: 74 });
    expect(dripSidePos(1, "right", 3)).toEqual({ x: 123, y: 98 });
  });

  it("cruz 3×3: hline+vline azul EGA-1 con centro EGA-9 (0-3); splash 4 = cian 0xB SIN centro", () => {
    expect(dripRects(95, 54, 0)).toEqual([
      { x: 94, y: 54, w: 3, h: 1, color: 1 },
      { x: 95, y: 53, w: 1, h: 3, color: 1 },
      { x: 95, y: 54, w: 1, h: 1, color: 9 },
    ]);
    expect(dripRects(95, 160, 4)).toEqual([
      { x: 94, y: 160, w: 3, h: 1, color: 0xb },
      { x: 95, y: 159, w: 1, h: 3, color: 0xb },
    ]);
  });

  it("destello del esqueleto: 4 hlines verde-brillante 10 en coords literales 0x1623-0x165c", () => {
    expect(glintRects()).toEqual([
      { x: 92, y: 87, w: 2, h: 1, color: 10 },
      { x: 91, y: 88, w: 3, h: 1, color: 10 },
      { x: 97, y: 87, w: 2, h: 1, color: 10 },
      { x: 97, y: 88, w: 3, h: 1, color: 10 },
    ]);
  });
});

describe("paintDungeon + decor (integración)", () => {
  function spyCtx() {
    const fillRects: { x: number; y: number; w: number; h: number; style: string }[] = [];
    const ctx = {
      save() {}, restore() {}, beginPath() {}, closePath() {}, clip() {}, rect() {},
      moveTo() {}, lineTo() {}, ellipse() {}, translate() {}, scale() {},
      drawImage() {}, stroke() {}, fill() {}, strokeRect() {},
      fillRect(x: number, y: number, w: number, h: number) {
        fillRects.push({ x, y, w, h, style: String((ctx as { fillStyle: unknown }).fillStyle) });
      },
      fillStyle: "", strokeStyle: "", lineWidth: 1,
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, fillRects };
  }

  it("con decor: la gota frontal se pinta en (95, 54) al primer redibujo (estado 0)", () => {
    const dv = view({ cells: [open(3, 3), special(3, 2), open(2, 3), open(4, 3)] });
    const { ctx, fillRects } = spyCtx();
    paintDungeon(ctx, dv, 0, null, null, null, new DungeonDecorState(() => 0.99));
    // El fondo negro + las 3 piezas de la cruz (hline, vline, centro).
    const cross = fillRects.slice(-3);
    expect(cross.map((r) => [r.x, r.y, r.w, r.h])).toEqual([
      [94, 54, 3, 1],
      [95, 53, 1, 3],
      [95, 54, 1, 1],
    ]);
  });

  it("sin decor (param ausente): ninguna cruz — sólo el placeholder", () => {
    const dv = view({ cells: [open(3, 3), special(3, 2), open(2, 3), open(4, 3)] });
    const { ctx, fillRects } = spyCtx();
    paintDungeon(ctx, dv, 0);
    // Nada de 3×1/1×3 en las coords de la gota.
    expect(fillRects.some((r) => r.x === 94 && r.y === 54)).toBe(false);
  });

  it("glint: transitorio — sólo pinta cuando la tirada acierta", () => {
    const dv = view({
      wallVariant: 3,
      cells: [open(3, 3), special(3, 2), open(2, 3), open(4, 3)],
    });
    const { ctx, fillRects } = spyCtx();
    paintDungeon(ctx, dv, 0, null, null, null, new DungeonDecorState(() => 0.99));
    expect(fillRects.some((r) => r.y === 87 || r.y === 88)).toBe(false);
    const { ctx: c2, fillRects: f2 } = spyCtx();
    paintDungeon(c2, dv, 0, null, null, null, new DungeonDecorState(() => 0));
    const glint = f2.filter((r) => r.y === 87 || r.y === 88);
    expect(glint.map((r) => [r.x, r.w])).toEqual([[92, 2], [91, 3], [97, 2], [97, 3]]);
  });
});
