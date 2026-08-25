/**
 * ★ #88 (T12) — SANGRADO LATERAL del campo mágico en el gem de mazmorra.
 *
 * `DNGLOOK 0x0284` pinta el campo con ocho `line` horizontales SIN bucle, y las dos
 * coordenadas en x salen de un par de registros cargados a la cabeza (`re/disasm/
 * DNGLOOK.OVL.asm`, verbatim):
 *
 *     0296: 8b7606      mov si, word ptr [bp + 6]
 *     0299: 83c606      add si, 6                    ; si = X + 6
 *     029c: 8b7e06      mov di, word ptr [bp + 6]
 *     029f: 47          inc di                       ; di = X + 1
 *     02a0: 57          push di
 *     02a1: ff7604      push word ptr [bp + 4]
 *     02a4: 56          push si
 *     02a5: ff7604      push word ptr [bp + 4]
 *     02a8: e8d565      call 0x6880                  ; line(X+1, Y, X+6, Y)
 *
 * ⇒ cada línea va de `X+1` a `X+6`: **6 px de los 8 de la celda**, con 1 px sin pintar a
 * cada lado. (Extremos INCLUSIVOS ⇒ 6 y no 5; la convención está derivada en
 * `re/notes/caja-espejo-93.md`.) El gem del port se dibuja a `cell = scale·8`, así que
 * ese 1 px escala a `cell/8`.
 *
 * El test fija el sangrado, que es lo que faltaba: los colores, su orden y las bandas de
 * 2 filas ya estaban bien y ahora están declarados como DERIVADOS en `gemmap.ts`.
 */
import { describe, expect, it } from "vitest";
import { paintGemMap } from "../src/skin/fiel/gemmap";
import type { GemView } from "../src/core/world/gem-view";
import type { FaithfulFont } from "../src/skin/fiel/font";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
}

function recordingCtx(): { ctx: CanvasRenderingContext2D; rects: Rect[] } {
  const rects: Rect[] = [];
  // El color vive fuera del literal: dentro, `this` se infiere como `{}` y tsc lo rechaza
  // (vitest no lo habría visto — no comprueba tipos).
  const state = { fillStyle: "" };
  const ctx = {
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, style: state.fillStyle });
    },
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    strokeRect() {},
    rect() {},
    clip() {},
    translate() {},
    scale() {},
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

/** Fuente de mentira: el campo mágico no pasa por glifos, así que basta con no explotar. */
const noRunes = { drawGlyph() {} } as unknown as FaithfulFont;

describe("#88 — campo mágico del gem: sangrado lateral de 0x0284", () => {
  it("deja 1 px por cada 8 de celda sin pintar a CADA lado", () => {
    // Rejilla 1×1 con una sola celda de campo (nibble 0x8) ⇒ ocupa el viewport entero:
    // scale = floor(176 / 8) = 22, cell = 176, y el origen cae en VIEWPORT.x/y = 8.
    const gv = {
      environment: "dungeon",
      width: 1,
      height: 1,
      tiles: [[0x8]],
      // El marcador de party se pinta con un glifo (fuente de mentira ⇒ no añade rects).
      marker: { x: 0, y: 0 },
    } as unknown as GemView;

    const { ctx, rects } = recordingCtx();
    paintGemMap(ctx, noRunes, gv);

    // El primer fillRect es el fondo negro del viewport; las 4 franjas van después.
    const stripes = rects.slice(1);
    expect(stripes).toHaveLength(4);

    const CELL = 176;
    const INSET = CELL / 8; // = 22
    for (const s of stripes) {
      expect(s.x).toBe(8 + INSET); // borde izquierdo sangrado
      expect(s.w).toBe(CELL - 2 * INSET); // y el derecho también
      expect(s.h).toBe(CELL / 4); // pares de 2 filas de las 8 del binario
    }

    // Las cuatro bandas se apilan de arriba abajo sin hueco ni solape.
    expect(stripes.map((s) => s.y)).toEqual([8, 8 + 44, 8 + 88, 8 + 132]);
  });
});
