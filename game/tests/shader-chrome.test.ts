/**
 * Piel «shader» (task #73, EJE 1) — redibujo VECTORIAL del chrome.
 *
 * `drawVectorChrome` reusa la geometría LITERAL de `fiel/frame.ts` y la pinta a
 * escala entera S: barras azules nítidas, 3 esquinas exteriores redondeadas, la «L»
 * del panel recta, y la caja blanca del VIEWPORT (esquinas redondeadas). Se fija con un
 * `ctx` de grabación (sin DOM).
 *
 * NO dibuja el contenido INTERIOR del panel estándar (las 2 barras azules separadoras
 * `x0=0xc0` ni las 2 sub-cajas roster/F-G): el chrome es estático y redibujarlo cada
 * frame lo pintaba ENCIMA de los overlays de pergamino del panel (picker de Ready, Ztats),
 * partiéndolos. La capa nearest de la piel ya lo pinta en su contexto correcto. Fix
 * ready-shader 2026-07-18.
 */
import { describe, expect, it } from "vitest";
import { drawVectorChrome, OUTER_CORNER_R } from "../src/skin/shader/chrome.js";
import { DEFAULT_FRAME_COLORS, FRAME_FILLS, SCREEN_H, SCREEN_W } from "../src/skin/fiel/frame.js";

interface RectCall {
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
}

/** Doble de grabación del subconjunto de CanvasRenderingContext2D que usa el chrome. */
function recordingCtx() {
  const fillRects: RectCall[] = [];
  const clearRects: RectCall[] = [];
  let arcs = 0;
  let fills = 0;
  let strokes = 0;
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    imageSmoothingEnabled: true,
    clearRect(x: number, y: number, w: number, h: number) {
      clearRects.push({ x, y, w, h, style: this.fillStyle });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      fillRects.push({ x, y, w, h, style: this.fillStyle });
    },
    beginPath() {},
    moveTo() {},
    rect() {},
    arc() {
      arcs++;
    },
    arcTo() {},
    closePath() {},
    fill() {
      fills++;
    },
    stroke() {
      strokes++;
    },
  };
  return {
    ctx,
    fillRects,
    clearRects,
    get arcs() {
      return arcs;
    },
    get fills() {
      return fills;
    },
    get strokes() {
      return strokes;
    },
  };
}

describe("piel shader — chrome vectorial (#73 EJE 1)", () => {
  it("limpia el backbuffer completo (320×200 ×S) antes de pintar", () => {
    const rec = recordingCtx();
    drawVectorChrome(rec.ctx as unknown as CanvasRenderingContext2D, 6);
    expect(rec.clearRects[0]).toMatchObject({ x: 0, y: 0, w: SCREEN_W * 6, h: SCREEN_H * 6 });
  });

  it("pinta las barras azules ESTRUCTURALES de FRAME_FILLS a ×S (rect inclusivo → +1), pero OMITE las 2 barras interiores del panel (x0=0xc0)", () => {
    const s = 6;
    const rec = recordingCtx();
    drawVectorChrome(rec.ctx as unknown as CanvasRenderingContext2D, s);
    for (const r of FRAME_FILLS) {
      const call = {
        x: r.x0 * s,
        y: r.y0 * s,
        w: (r.x1 - r.x0 + 1) * s,
        h: (r.y1 - r.y0 + 1) * s,
        style: DEFAULT_FRAME_COLORS.frame,
      };
      if (r.x0 === 0xc0) {
        // Barras separadoras INTERIORES del panel (`barra panel superior`/`inferior`):
        // NO se redibujan (partirían los overlays de pergamino). Guard de regresión.
        expect(rec.fillRects).not.toContainEqual(call);
      } else {
        expect(rec.fillRects).toContainEqual(call);
      }
    }
    // Sanidad: FRAME_FILLS trae exactamente 2 barras interiores del panel.
    expect(FRAME_FILLS.filter((r) => r.x0 === 0xc0)).toHaveLength(2);
  });

  it("dibuja la «L» del panel como 2 líneas blancas de 1 px ×S", () => {
    const s = 6;
    const rec = recordingCtx();
    drawVectorChrome(rec.ctx as unknown as CanvasRenderingContext2D, s);
    const b = DEFAULT_FRAME_COLORS.border;
    // vertical (191,87)-(191,191) grosor 1 + horizontal (191,87)-(319,87) grosor 1.
    expect(rec.fillRects).toContainEqual({ x: 0xbf * s, y: 0x57 * s, w: s, h: (0xbf - 0x57 + 1) * s, style: b });
    expect(rec.fillRects).toContainEqual({ x: 0xbf * s, y: 0x57 * s, w: (0x13f - 0xbf + 1) * s, h: s, style: b });
  });

  it("redondea 3 esquinas exteriores del marco (arco+clear c/u) + traza SOLO la caja blanca del viewport", () => {
    const s = 6;
    const rec = recordingCtx();
    drawVectorChrome(rec.ctx as unknown as CanvasRenderingContext2D, s);
    expect(rec.arcs).toBe(3); // 3 cuartos de disco azul (esquinas exteriores)
    // 3 esquinas exteriores (fill disco) + 1 caja blanca del viewport (fill evenodd de la
    // cuña) = 4. Las 2 sub-cajas del panel YA NO se dibujan (partirían los overlays).
    expect(rec.fills).toBe(4);
    // 1 caja blanca (viewport) → 1 trazo redondeado.
    expect(rec.strokes).toBe(1);
    // 3 clears de esquina (cuadrado R×R) + el clear inicial del backbuffer = 4.
    expect(rec.clearRects).toHaveLength(4);
    for (const c of rec.clearRects.slice(1)) {
      expect(c.w).toBe(OUTER_CORNER_R * s);
      expect(c.h).toBe(OUTER_CORNER_R * s);
    }
  });

  it("las esquinas exteriores caben dentro de la barra superior (R < grosor 7)", () => {
    expect(OUTER_CORNER_R).toBeLessThan(7);
  });
});
