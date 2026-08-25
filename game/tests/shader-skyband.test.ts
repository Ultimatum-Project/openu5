/**
 * Banda celeste vectorial de la piel «shader» (#73 EJE 1, punto 3) — invariantes de
 * dibujo con un `ctx` de grabación (puro, sin DOM/canvas real).
 *
 * Sol/lunas/remates se redibujan VECTOR (no NEAREST): el sol como ráfaga rellena, las
 * lunas por fase (nueva = nada; llena = disco completo), los remates como muesca negra
 * + relleno azul + filo blanco. `drawVectorSkyBand` ennegrece la ventana y añade 2
 * remates SIEMPRE, más un glifo por marca.
 */
import { describe, expect, it } from "vitest";
import {
  drawVectorMoon,
  drawVectorNotch,
  drawVectorScrollArrow,
  drawVectorSkyBand,
  drawVectorSun,
} from "../src/skin/shader/skyband.js";
import { SKY_CELLS, SUN_GLYPH } from "../src/skin/fiel/sky.js";

function rec() {
  const c = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "",
    lineCap: "",
    fillRects: 0,
    fills: 0,
    strokes: 0,
    arcs: 0,
    ellipses: 0,
    fillRect() {
      c.fillRects++;
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    closePath() {},
    arc() {
      c.arcs++;
    },
    ellipse() {
      c.ellipses++;
    },
    fill() {
      c.fills++;
    },
    stroke() {
      c.strokes++;
    },
    save() {},
    restore() {},
    translate() {},
    scale() {},
  };
  return c;
}

const ctx = (c: ReturnType<typeof rec>) => c as unknown as CanvasRenderingContext2D;

describe("banda celeste vectorial (#73)", () => {
  it("sol: ráfaga rellena + núcleo (≥2 fills, sin trazo)", () => {
    const c = rec();
    drawVectorSun(ctx(c), 0, 0, 48);
    expect(c.fills).toBeGreaterThanOrEqual(2);
  });

  it("luna nueva (fase 0): no dibuja nada iluminado", () => {
    const c = rec();
    drawVectorMoon(ctx(c), 0, 0, 48, 0);
    expect(c.fills).toBe(0);
    expect(c.arcs).toBe(0);
  });

  it("luna llena (fase 4): disco iluminado (arco + elipse + fill)", () => {
    const c = rec();
    drawVectorMoon(ctx(c), 0, 0, 48, 4);
    expect(c.fills).toBe(1);
    expect(c.arcs).toBe(1);
    expect(c.ellipses).toBe(1);
  });

  it("menguantes (fase 5-7) espejan crecientes (misma cuenta de trazos)", () => {
    const wax = rec();
    drawVectorMoon(ctx(wax), 0, 0, 48, 1);
    const wane = rec();
    drawVectorMoon(ctx(wane), 0, 0, 48, 7);
    expect(wane.fills).toBe(wax.fills);
    expect(wane.arcs).toBe(wax.arcs);
  });

  it("remate: muesca negra + relleno azul + filo blanco", () => {
    const c = rec();
    drawVectorNotch(ctx(c), 0, 0, 48, false);
    expect(c.fillRects).toBe(1); // muesca negra
    expect(c.fills).toBe(1); // relleno azul del chevron
    expect(c.strokes).toBe(1); // filo blanco
  });

  it("banda entera: ventana negra + 2 remates + 1 glifo por marca", () => {
    const c = rec();
    drawVectorSkyBand(ctx(c), 6, [
      { cell: 3, code: SUN_GLYPH, isSun: true },
      { cell: 8, code: 0x34, isSun: false }, // luna fase 4 (llena)
    ]);
    // 1 fillRect ventana + 2 fillRect muescas de los remates = 3.
    expect(c.fillRects).toBe(3);
    // 2 fills de remate (azul) + 1 sol (≥2) + 1 luna (1) → al menos 5.
    expect(c.fills).toBeGreaterThanOrEqual(5);
    expect(c.strokes).toBe(2); // 2 filos de remate
  });

  it("SKY_CELLS sigue siendo 12 (ventana derivada)", () => {
    expect(SKY_CELLS).toBe(12);
  });

  // Testigo del usuario 2026-07-20 (ORIG_3): la flecha de scroll es la FLECHA CON ASTA
  // de IBM.CH (cabeza + asta fina), no un triángulo relleno. Cada glifo se vectoriza como
  // UNA silueta continua (↑/↓ = flecha simple; ↕ = doble punta unida por el asta) → 1 fill
  // + 1 stroke por glifo (antes ↕ eran 2 triángulos sueltos). Ver docs/verdicts/ready-arrows.
  describe("flecha de scroll del picker (chevron-scroll)", () => {
    it("↑ (0x18): una silueta de flecha-con-asta rellena + trazo redondo", () => {
      const c = rec();
      drawVectorScrollArrow(ctx(c), 0, 0, 48, 0x18);
      expect(c.fills).toBe(1);
      expect(c.strokes).toBe(1);
      expect(c.lineJoin).toBe("round");
    });

    it("↓ (0x19): una silueta de flecha-con-asta rellena + trazo", () => {
      const c = rec();
      drawVectorScrollArrow(ctx(c), 0, 0, 48, 0x19);
      expect(c.fills).toBe(1);
      expect(c.strokes).toBe(1);
    });

    it("↕ (0x12): doble punta con asta central = UNA silueta continua → 1 fill + 1 trazo", () => {
      const c = rec();
      drawVectorScrollArrow(ctx(c), 0, 0, 48, 0x12);
      expect(c.fills).toBe(1);
      expect(c.strokes).toBe(1);
    });
  });
});
