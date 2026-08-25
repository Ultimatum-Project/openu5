/**
 * Vista de mazmorra fiel (E1-S9 bloque 2): el compositor first-person del snapshot.
 * Verifica el GATE de luz (oscuridad → negro) y que con luz compone la geometría
 * (techo/suelo + muros). El píxel exacto es Clase C (pack de perspectiva, spec §9);
 * aquí se fija el comportamiento del gate y la presencia de geometría.
 */
import { describe, expect, it } from "vitest";
import {
  featureBlits,
  paintDungeon,
  planDungeonView,
  type DungeonWallPack,
  type DungeonFeatPack,
  type SideBlit,
  type FrontBlit,
} from "../src/skin/fiel/dungeon.js";
import type { DungeonCellView, DungeonViewInfo } from "../src/skin/api.js";

function spyCtx() {
  let fillRects = 0;
  let strokeRects = 0;
  let fills = 0;
  let strokes = 0;
  let drawImages = 0;
  const fillStyles: string[] = [];
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    clip() {},
    rect() {},
    moveTo() {},
    lineTo() {},
    ellipse() {},
    translate() {},
    scale() {},
    drawImage() {
      drawImages++;
    },
    stroke() {
      strokes++;
    },
    fill() {
      fills++;
    },
    fillRect() {
      fillRects++;
      fillStyles.push((ctx as unknown as { fillStyle: string }).fillStyle);
    },
    strokeRect() {
      strokeRects++;
    },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    counts: () => ({ fillRects, strokeRects, fills, strokes, drawImages, fillStyles }),
  };
}

/** Pack de prueba: 3 variantes × 28 rects no nulos (basta para que blitStrip encuentre ranura). */
function fakePack(): DungeonWallPack {
  const rects = Array.from({ length: 28 }, (_v, i) => ({ x: i, y: 0, w: 8, h: 164 }));
  return { image: {} as unknown as CanvasImageSource, rectsByVariant: [rects, rects, rects] };
}

/** Dimensiones REALES de las 20 imágenes de ITEMS.16 (extractor parseItemsView). */
const FEAT_DIMS: [number, number][] = [
  [40, 80], [24, 56], [16, 24], [8, 8], // escalera 0-3
  [40, 80], [24, 56], [16, 24], [8, 8], // fuente 4-7
  [40, 24], [24, 32], [16, 16], [8, 8], // trampa 8-11
  [40, 24], [24, 32], [16, 16], [8, 8], // cofre cerrado 12-15
  [40, 24], [24, 32], [16, 16], [16, 16], // cofre abierto 16-19
];

/** Pack de features de prueba: los 20 rects (ITEMS.16) con sus dims reales. */
function featPack(): DungeonFeatPack {
  const rects = FEAT_DIMS.map(([w, h], i) => ({ x: i * 40, y: 0, w, h }));
  return { image: {} as unknown as CanvasImageSource, rects };
}

function cell(x: number, y: number, type: number, sub = 0, secretRevealed = false): DungeonCellView {
  return { x, y, type, sub, secretRevealed };
}
const open = (x: number, y: number): DungeonCellView => cell(x, y, 0x0);
const wall = (x: number, y: number): DungeonCellView => cell(x, y, 0xb);

/**
 * Escena realista mirando al norte desde (3,3): el adaptador incluye la celda de la
 * party + la de delante y sus vecinas por profundidad (coreview.dungeonView). Aquí
 * se listan a mano para fijar el plan del compositor.
 */
function view(over: Partial<DungeonViewInfo> = {}): DungeonViewInfo {
  return {
    floor: 0,
    facing: "north",
    pos: { x: 3, y: 3 },
    lightDepth: 4, // conteo de celdas (0 a oscuras, 4 con luz), coreview 0x1B0C
    lit: true,
    wallVariant: 3,
    cells: [],
    ...over,
  };
}

describe("planDungeonView (compositor de rodajas, DUNGEON:0x1a90)", () => {
  it("celda con muros a ambos lados: laterales lisos (base 0) por profundidad, izq normal / der espejo", () => {
    // Party (3,3) N, muros en las vecinas (2,3) y (4,3); delante (3,2) abierto.
    const ops = planDungeonView(view({ cells: [open(3, 3), wall(2, 3), wall(4, 3), open(3, 2)] }));
    const d0 = ops.filter((o): o is SideBlit => o.op === "side" && o.depth === 0);
    const left = d0.find((o) => o.side === "left")!;
    const right = d0.find((o) => o.side === "right")!;
    expect(left).toMatchObject({ slice: 0, x: 16, mirror: false }); // 0x2e62[0], base 0
    expect(right).toMatchObject({ slice: 0, x: 152, mirror: true }); // espejo, X der
  });

  it("vecino ABIERTO → rodaja de pasaje lateral (base 0x10); PUERTA/sala → base 4; especial → alcoba 0x14", () => {
    const doorOps = planDungeonView(
      view({ cells: [open(3, 3), cell(2, 3, 0xe), cell(4, 3, 0xc), open(3, 2)] }),
    );
    const l0 = doorOps.find((o): o is SideBlit => o.op === "side" && o.depth === 0 && o.side === "left")!;
    const r0 = doorOps.find((o): o is SideBlit => o.op === "side" && o.depth === 0 && o.side === "right")!;
    expect(l0.slice).toBe(4); // puerta lateral (rodajas 4-7)
    expect(r0.slice).toBe(0x14); // muro especial → alcoba (20-23)

    const openOps = planDungeonView(view({ cells: [open(3, 3), open(2, 3), open(4, 3), open(3, 2)] }));
    const lo = openOps.find((o): o is SideBlit => o.op === "side" && o.depth === 0 && o.side === "left")!;
    expect(lo.slice).toBe(0x10); // pasaje lateral (16-19)
  });

  it("muro de fondo: base por tipo (muro=8, puerta/sala=12) + profundidad; el par lo dibuja paintDungeon", () => {
    // Muro a 2 de distancia: (3,3) y (3,2) abiertos, (3,1) muro.
    const ops = planDungeonView(
      view({ cells: [open(3, 3), open(3, 2), wall(3, 1), open(2, 2), open(4, 2), open(2, 3), open(4, 3)] }),
    );
    const front = ops.find((o): o is FrontBlit => o.op === "front")!;
    expect(front).toMatchObject({ op: "front", depth: 2, slice: 10 }); // 8 + 2
    // Marcha PARA en el muro: no hay laterales a profundidad ≥ 2.
    expect(ops.some((o) => o.op === "side" && o.depth >= 2)).toBe(false);
  });

  it("puerta de frente: rodaja de puerta 13-15 (base 12) y para la marcha", () => {
    const ops = planDungeonView(view({ cells: [open(3, 3), cell(3, 2, 0xe)] }));
    const front = ops.find((o): o is FrontBlit => o.op === "front")!;
    expect(front).toMatchObject({ depth: 1, slice: 13 }); // 12 + 1
  });

  it("los 4 anillos laterales abutan de borde a borde (IZQ 16→96, DER 96→176)", () => {
    // Pasillo recto abierto: vecinas de cada profundidad son muros (SIDE_X por prof.).
    const cells: DungeonCellView[] = [];
    for (let d = 0; d < 4; d++) {
      cells.push(open(3, 3 - d), wall(2, 3 - d), wall(4, 3 - d));
    }
    const ops = planDungeonView(view({ cells }));
    const leftXs = ops.filter((o): o is SideBlit => o.op === "side" && o.side === "left").map((o) => o.x);
    const rightXs = ops.filter((o): o is SideBlit => o.op === "side" && o.side === "right").map((o) => o.x);
    expect(leftXs).toEqual([16, 40, 72, 88]); // 0x2e62 fila 0
    expect(rightXs).toEqual([152, 120, 104, 96]); // 0x2e62 fila 1
  });

  it("a oscuras (lit=false) el plan está vacío", () => {
    expect(planDungeonView(view({ lit: false, lightDepth: 0 }))).toEqual([]);
  });
});

describe("paintDungeon (render del plan)", () => {
  it("a oscuras pinta el viewport en NEGRO y no dibuja geometría", () => {
    const { ctx, counts } = spyCtx();
    paintDungeon(ctx, view({ lit: false, lightDepth: 0 }), 0);
    const c = counts();
    expect(c.fillRects).toBe(1); // solo el rectángulo negro del viewport
    expect(c.fillStyles[0]).toBe("#000000");
    expect(c.drawImages).toBe(0);
  });

  it("con pack: compone las rodajas reales (drawImage) en vez de rellenos", () => {
    const { ctx, counts } = spyCtx();
    paintDungeon(ctx, view({ cells: [open(3, 3), wall(2, 3), wall(4, 3), open(3, 2)] }), 0, fakePack());
    // 2 laterales de profundidad 0 (al menos) → ≥2 blits.
    expect(counts().drawImages).toBeGreaterThanOrEqual(2);
  });

  it("sin pack no llama drawImage (placeholder geométrico)", () => {
    const { ctx, counts } = spyCtx();
    paintDungeon(ctx, view({ cells: [open(3, 3), wall(2, 3), wall(4, 3), open(3, 2)] }), 0);
    const c = counts();
    expect(c.drawImages).toBe(0);
    expect(c.fills).toBeGreaterThanOrEqual(1); // cuñas laterales rellenas
  });

  it("con featPack: una escalera de frente = par ABUTTED (2 blits, no duplicada)", () => {
    const { ctx, counts } = spyCtx();
    // Escalera (tipo 1) 1 celda al norte de la party; celda propia y frente abiertas.
    const dv = view({ cells: [open(3, 3), cell(3, 2, 0x1), open(2, 2), open(4, 2)] });
    // Sin featPack: la escalera cae a la primitiva (líneas), sin drawImage.
    paintDungeon(ctx, dv, 0);
    expect(counts().drawImages).toBe(0);
    // Con featPack: mitad normal + espejo-H = EXACTAMENTE 2 blits.
    const { ctx: ctx2, counts: counts2 } = spyCtx();
    paintDungeon(ctx2, dv, 0, null, featPack());
    expect(counts2().drawImages).toBe(2);
  });

  it("escalera up-down de frente = AMBOS bloques (4 blits: up volteado + down)", () => {
    const dv = view({ cells: [open(3, 3), cell(3, 2, 0x3), open(2, 2), open(4, 2)] });
    const { ctx, counts } = spyCtx();
    paintDungeon(ctx, dv, 0, null, featPack());
    expect(counts().drawImages).toBe(4);
  });

  it("feature a si=0 (celda pisada): de pie sobre la escalera se dibuja la img 40×80", () => {
    // Party ENCIMA de la escalera-up (f001/f010: al entrar en la mazmorra caes sobre ella).
    const dv = view({ cells: [cell(3, 3, 0x1), open(2, 3), open(4, 3), open(3, 2)] });
    const feats = planDungeonView(dv).filter((o) => o.op === "feature");
    expect(feats).toEqual([{ op: "feature", cellType: 0x1, sub: 0, depth: 0 }]);
    const { ctx, counts } = spyCtx();
    paintDungeon(ctx, dv, 0, null, featPack());
    expect(counts().drawImages).toBe(2); // el par de la img 0 (40×80)
  });
});

describe("featureBlits (fn_1952 @0x1952 + dng_blit_piece @0x134A, rama feature)", () => {
  const rects = featPack().rects;

  it("imagen = imgBase + si (SIN off-by-one): escalera si=0→img0, si=3→img3", () => {
    for (let si = 0; si < 4; si++) {
      const b = featureBlits(0x2, 0, si, rects); // LadderDown
      expect(b.map((x) => x.img)).toEqual([si, si]);
    }
  });

  it("par ABUTTED: mitad normal en X=96−w, espejo-H en X=96 (0x2e72 / override 0x60)", () => {
    // si=0 (w=40): [56, 96]; si=1 (w=24): [72, 96]; si=2 (w=16): [80,96]; si=3 (w=8): [88,96].
    for (const [si, xn] of [[0, 56], [1, 72], [2, 80], [3, 88]] as const) {
      const [l, r] = featureBlits(0x2, 0, si, rects);
      expect([l!.x, l!.mirror]).toEqual([xn, false]);
      expect([r!.x, r!.mirror]).toEqual([96, true]);
    }
  });

  it("escalera-ARRIBA: VOLTEADA-V con tope 0x2e82[si]=[15,39,71,87] → base fija y=95", () => {
    for (let si = 0; si < 4; si++) {
      const blits = featureBlits(0x1, 0, si, rects); // LadderUp
      expect(blits).toHaveLength(2);
      for (const b of blits) {
        expect(b.vflip).toBe(true);
        expect(b.yTop).toBe([15, 39, 71, 87][si]);
        expect(b.yTop + b.h).toBe(95); // careo p19-0720: placa arriba, base y≈95
      }
    }
  });

  it("up-down (kind 3): up volteado en 0x2e82[si] + down sin voltear en y=96, EN ESE ORDEN", () => {
    const blits = featureBlits(0x3, 0, 1, rects);
    expect(blits.map((b) => [b.img, b.vflip, b.yTop])).toEqual([
      [1, true, 39],
      [1, true, 39],
      [1, false, 96],
      [1, false, 96],
    ]);
  });

  it("mapeos nuevos: fuente 4-7 (y=96), trampa 8-11, cofre 12-15, cofre abierto 16-19 (0x2e7a)", () => {
    expect(featureBlits(0x5, 0, 2, rects)[0]).toMatchObject({ img: 6, yTop: 96, vflip: false });
    // Objetos BAJOS (img≥8): Y=0x2e7a[si]=[152,120,104,96].
    expect(featureBlits(0x6, 0, 0, rects)[0]).toMatchObject({ img: 8, yTop: 152 });
    expect(featureBlits(0x4, 0, 1, rects)[0]).toMatchObject({ img: 13, yTop: 120 });
    expect(featureBlits(0x7, 0, 3, rects)[0]).toMatchObject({ img: 19, yTop: 96 });
  });

  it("trampa gateada: (sub&7)!=0 → NO se dibuja (fn_1952 @0x197b)", () => {
    expect(featureBlits(0x6, 0, 1, rects)).toHaveLength(2);
    expect(featureBlits(0x6, 3, 1, rects)).toEqual([]);
    expect(featureBlits(0x6, 8, 1, rects)).toHaveLength(2); // sólo los 3 bits bajos
  });

  it("MagicField (kind 8) no tiene bloques en ITEMS.16 → []", () => {
    expect(featureBlits(0x8, 0, 1, rects)).toEqual([]);
  });
});

import {
  DUNGEON_DIR_NAMES,
  dungeonLevelLabel,
  dungeonDirLabel,
} from "../src/skin/fiel/dungeon.js";

describe("bandas de estado de mazmorra (dng_draw_panel 0x01D2)", () => {
  it("banda superior: nivel = floor+1, L1..L8", () => {
    expect(dungeonLevelLabel(0)).toBe("L1"); // floor 0 = nivel 1 (cima)
    expect(dungeonLevelLabel(7)).toBe("L8"); // floor 7 = nivel 8 (fondo)
  });

  it("nombres de dirección = literal EN de g_dng_facing 0..3", () => {
    expect(DUNGEON_DIR_NAMES).toEqual({
      north: "North",
      east: "East",
      south: "South",
      west: "West",
    });
  });

  it("banda inferior: 'Dir:' + dir justificada a la derecha en 7 (11 celdas)", () => {
    // Medido de video-N: North→2 espacios, East→3 (el remate ◄ pega con la letra).
    expect(dungeonDirLabel("North")).toBe("Dir:  North");
    expect(dungeonDirLabel("East")).toBe("Dir:   East");
    expect(dungeonDirLabel("South")).toBe("Dir:  South");
    expect(dungeonDirLabel("West")).toBe("Dir:   West");
    // Ancho invariante = 11 celdas (como la banda de vientos).
    for (const n of ["North", "East", "South", "West"]) {
      expect(dungeonDirLabel(n)).toHaveLength(11);
    }
  });

  it("i18n: la dir traducida (Norte/Sur/Este/Oeste) mantiene el ancho de 11", () => {
    expect(dungeonDirLabel("Norte")).toBe("Dir:  Norte");
    expect(dungeonDirLabel("Este")).toBe("Dir:   Este");
    expect(dungeonDirLabel("Norte")).toHaveLength(11);
  });
});
