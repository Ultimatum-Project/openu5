/**
 * LAYOUT de The Summoning (item G) — tabla por escena + geometría de exclusión del
 * cartón. Deriva: `re/notes/summoning-scene-layout.md` (brief intro-reviewer),
 * frames `orig_E_*`. Prueba el modelo "texto fluyendo alrededor del cartón" y el
 * bug duro de las escenas 8–12 (texto ARRIBA, no encima de la ilustración).
 */
import { describe, expect, it } from "vitest";
import {
  lineSegments,
  SUMMONING_LAYOUT,
  summoningLayout,
  type Rect,
} from "../src/skin/fiel/summoning-layout.js";

const inBounds = (r: Rect): boolean =>
  r.x0 >= 0 && r.y0 >= 0 && r.x1 <= 320 && r.y1 <= 200 && r.x1 > r.x0 && r.y1 > r.y0;

describe("SUMMONING_LAYOUT (21 escenas)", () => {
  it("tiene exactamente 21 escenas, todas con rects válidos dentro de 320×200", () => {
    expect(SUMMONING_LAYOUT).toHaveLength(21);
    for (const sc of SUMMONING_LAYOUT) {
      expect(inBounds(sc.text)).toBe(true);
      expect(inBounds(sc.carton)).toBe(true);
    }
  });

  // CORRECCIÓN DE FIDELIDAD (carril intro-i18n, 2026-07-18): la región de texto es la
  // PANTALLA COMPLETA; el `carton` (arte) posiciona vía la EXCLUSIÓN por línea. El modelo
  // anterior (cajas pequeñas junto al arte) TRUNCABA el texto ya en inglés (16/21). Derivado
  // que el original NO pagina — pinta el registro entero fluyendo por la pantalla alrededor
  // del arte (clip a penY≥0xc0). Citas: play_introduction (INTRO.OVL 0x0321/0x032b/0x033c,
  // una fb26 + una tecla por escena), render_justified_text (FONT.OVL 0x01c9 clip, sin
  // keypress), frames orig_E_intro_iolo_story.png (esc.16 completa) / _shadowlords.png (esc.10).
  //
  // RECTIFICACIÓN (fix/intro-regions-es, 2026-07-19): la región es pantalla-completa SALVO en
  // las 3 escenas-título TYPE 1 (0/7/14), donde arranca BAJO el cartón gótico (el original no
  // escribe sobre "The Summoning/Arrival/Story"; frame orig_E_summoning_titlecard.png). El
  // ancho X y el pie Y1 siguen full-screen: el texto fluye a columna y full-width al pie.
  const TITLE_TOP: Record<number, number> = { 0: 90, 7: 86, 14: 32 };
  it("región de texto = pantalla completa, salvo escenas-título (arranca bajo el título)", () => {
    for (let i = 0; i < SUMMONING_LAYOUT.length; i++) {
      const sc = SUMMONING_LAYOUT[i]!;
      const y0 = TITLE_TOP[i] ?? 2;
      expect(sc.text).toEqual({ x0: 2, y0, x1: 318, y1: 198 });
    }
  });

  // RECTIFICACIÓN (fix/intro-regions-es, 2026-07-19): los retratos de 2 celdas TYPE 4/5/6
  // (15-20, charla de Iolo) llevan una 2ª celda a +SECOND_CEL_DY=55 px que el `carton` NO
  // cubría → el texto ES la cruzaba. El cartón se EXTIENDE al pie de la 2ª celda (misma x).
  it("15-20 (retrato 2 celdas): el cartón cubre AMBAS celdas (extendido a la 2ª)", () => {
    // pie del cartón = origen 2ª celda (+55) + alto story6:{3,5,7} (39/39/38/39/38/39).
    const bottom: Record<number, number> = { 15: 94, 16: 140, 17: 171, 18: 94, 19: 148, 20: 181 };
    for (const i of [15, 16, 17, 18, 19, 20]) {
      expect(summoningLayout(i)!.carton.y1).toBe(bottom[i]);
    }
  });

  it("8–12: el texto queda ARRIBA del arte por la EXCLUSIÓN (cartón mitad inferior)", () => {
    for (const i of [8, 9, 10, 11, 12]) {
      const sc = summoningLayout(i)!;
      expect(sc.carton).toEqual({ x0: 0, y0: 90, x1: 320, y1: 200 }); // arte abajo (y0 90: 1 línea más que antes, cabe esc.9)
      // Una línea POR DEBAJO del arte no tiene hueco (texto excluido); una por ARRIBA, full-width.
      expect(lineSegments(sc.text, sc.carton, 120, 9, 12)).toHaveLength(0);
      expect(lineSegments(sc.text, sc.carton, 20, 9, 12)).toEqual([{ x0: 2, x1: 318 }]);
    }
  });

  it("la escena 6 (puerta azul) lleva su texto FIJO de DATA.OVL", () => {
    const sc = summoningLayout(6)!;
    expect(sc.fixedText).toContain("shimmering blue door");
  });

  it("las escenas WRAP (4/6/17/19): el cartón queda EN MEDIO → texto a ambos lados", () => {
    for (const i of [4, 6, 17, 19]) {
      const sc = summoningLayout(i)!;
      // A la altura del cartón, la línea se parte en DOS segmentos (izq + der del arte).
      const yMid = Math.floor((sc.carton.y0 + sc.carton.y1) / 2);
      const segs = lineSegments(sc.text, sc.carton, yMid, 9, 12);
      expect(segs.length).toBeGreaterThanOrEqual(1); // al menos un lado libre
      // la región cubre todo el ancho de pantalla (el arte está DENTRO de ella)
      expect(sc.text.x0).toBeLessThanOrEqual(sc.carton.x0);
      expect(sc.text.x1).toBeGreaterThanOrEqual(sc.carton.x1 - 3);
    }
  });
});

describe("lineSegments (fluir alrededor del cartón, núcleo del item G)", () => {
  const region: Rect = { x0: 0, y0: 0, x1: 320, y1: 200 };
  const carton: Rect = { x0: 72, y0: 38, x1: 240, y1: 162 }; // como la escena 6

  it("línea POR ENCIMA del cartón: un único segmento a todo el ancho", () => {
    const segs = lineSegments(region, carton, 10, 9, 12); // y 10..19 < carton.y0=38
    expect(segs).toEqual([{ x0: 0, x1: 320 }]);
  });

  it("línea que CRUZA el cartón: DOS segmentos, izquierda y derecha de él", () => {
    const segs = lineSegments(region, carton, 80, 9, 12); // banda dentro de 38..162
    expect(segs).toEqual([
      { x0: 0, x1: 72 },
      { x0: 240, x1: 320 },
    ]);
  });

  it("línea POR DEBAJO del cartón: de nuevo un segmento a todo el ancho", () => {
    const segs = lineSegments(region, carton, 170, 9, 12); // y 170 > carton.y1=162
    expect(segs).toEqual([{ x0: 0, x1: 320 }]);
  });

  it("cartón full-width que tapa la banda entera: NINGÚN segmento (línea saltada)", () => {
    const full: Rect = { x0: 0, y0: 82, x1: 320, y1: 200 }; // como escenas 8–12
    const bandInside = lineSegments(region, full, 100, 9, 12);
    expect(bandInside).toEqual([]); // por eso el texto debe ir en Y por encima
  });

  it("región a la DERECHA del cartón: el segmento se recorta a la región (un lado)", () => {
    const rightRegion: Rect = { x0: 148, y0: 33, x1: 320, y1: 137 }; // escena 16
    const c16: Rect = { x0: 0, y0: 46, x1: 141, y1: 101 };
    const segs = lineSegments(rightRegion, c16, 60, 9, 12); // banda cruza el cartón
    expect(segs).toEqual([{ x0: 148, x1: 320 }]); // sólo el lado derecho, sin bleed
  });

  it("descarta segmentos más estrechos que minSeg", () => {
    const narrow: Rect = { x0: 60, y0: 0, x1: 320, y1: 200 };
    const segs = lineSegments(narrow, carton, 80, 9, 20); // izq [60,72]=12px < 20 ⇒ fuera
    expect(segs).toEqual([{ x0: 240, x1: 320 }]);
  });
});
