/**
 * LA COSTURA NO ES UN OBJETO: SON DOS FILOS DE DOS CAJAS DISTINTAS.
 *
 * `SRC_SEAM` (fuente y80..87) parece una tira y no lo es: y80 es el filo INFERIOR de la
 * caja de KPIs —que pertenece a la columna del PANEL— e y87 es el filo SUPERIOR de la
 * consola —que pertenece a la del LOG—, con el margen azul entre medias. En el original
 * las dos cajas van APILADAS en la misma columna y la ambigüedad no existe. El portrait
 * cuadrado las pone EN PARALELO, y ahí la tira tiene que repartirse. De ese reparto mal
 * hecho salen las dos fichas del 13-08: #224 (este fichero) y #225 (su hermano,
 * `portrait-filo-cierre.test.ts`).
 */

/**
 * #225 — EL FILO DE CIERRE de la columna del panel arranca en `bandX` mientras la tira
 * azul perimetral sí llega a x=0: «la línea blanca bajo el panel de comida/oro no llega
 * al límite izquierdo» (captura …9E3A9B52). Mismo defecto que el usuario reportó el
 * 02-08 para el separador del techo de la banda; aquél era una línea PINTADA y éste es
 * cromo BLITEADO, y por eso se quedó fuera de aquel arreglo.
 *
 * Se asierta en RECTS y contra el layout REAL de los cinco teléfonos del censo portrait.
 */
import { describe, expect, it } from "vitest";
import {
  ROW,
  tramoFiloDeCierreAlBorde,
  type Pane,
} from "../src/skin/portrait/layout.js";
import { squareLayout } from "../src/skin/portrait/layout-cuadrado.js";

/** Mismo censo que `portrait-cuadrado` / `portrait-filo-kpis`. */
const TELEFONOS = [
  { name: "iPhone SE", w: 375, h: 667 },
  { name: "iPhone 13", w: 390, h: 844 },
  { name: "iPhone 15", w: 393, h: 852 },
  { name: "Pixel 7", w: 412, h: 915 },
  { name: "Galaxy S8", w: 360, h: 740 },
] as const;

const K = 3; // dpr del censo (iPhone); el aserto es de PROPORCIÓN, no del valor de k.

function layoutDe(t: (typeof TELEFONOS)[number], scroll: boolean) {
  const L = squareLayout(t.w, t.h - 340, {
    force: "reflow",
    orient: "portrait",
    consoleScrollActive: scroll,
  });
  if (L.kind !== "reflow") throw new Error(`${t.name}: no cayó en re-flow`);
  return L;
}

describe("#225 — el filo de cierre llega al borde izquierdo", () => {
  for (const scroll of [false, true]) {
    it(`prolonga el filo real sin hueco ni solape (scrollback=${scroll})`, () => {
      for (const t of TELEFONOS) {
        const p = layoutDe(t, scroll).panes;
        const r = tramoFiloDeCierreAlBorde(p, K);
        // El filo existe en los dos modos: sin scrollback lo pone la costura, con él
        // `panelEdgeBottom` (03-08). Si algún día no existiera, este aserto lo diría.
        expect(r, `${t.name} scroll=${scroll}`).not.toBeNull();

        // De qué pane sale, y su geometría propia.
        const fuente: Pane = scroll ? p.panelEdgeBottom! : p.seamPanel!;
        const hFila = fuente.dh / fuente.sh;
        const yFilo = scroll ? fuente.dy : fuente.dy + (fuente.sh - 1) * hFila;

        // CONTIGUO: acaba EXACTAMENTE donde empieza el cromo — ni hueco ni solape.
        expect(r!.x).toBe(0);
        expect(r!.x + r!.w).toBeCloseTo(fuente.dx * K, 6);
        // COPLANAR: misma scanline y mismo grosor que el filo que prolonga.
        expect(r!.y).toBeCloseTo(yFilo * K, 6);
        expect(r!.h).toBeCloseTo(hFila * K, 6);
        // Y tiene algo que prolongar: la tira azul perimetral mide más de cero.
        expect(r!.w).toBeGreaterThan(0);
      }
    });
  }

  it("la scanline prolongada es la ÚLTIMA de la costura, no la primera", () => {
    // El primero (y80) es el filo de KPIs y ya lo pinta la caja; el que cierra la
    // columna es y87. Confundirlos pintaría la raya a 7 renglones de donde toca.
    const p = layoutDe(TELEFONOS[1], false).panes;
    const r = tramoFiloDeCierreAlBorde(p, K)!;
    const seam = p.seamPanel!;
    expect(seam.sh).toBe(ROW);
    expect(r.y).toBeGreaterThan(seam.dy * K);
    expect(r.y + r.h).toBeCloseTo((seam.dy + seam.dh) * K, 6);
  });

  it("panel FUNDIDO: quién cierra la columna y quién se prolonga — #378→#380", () => {
    // #378 (24-08 mañana) reponía el cierre (y87) al fondo con la costura a media
    // columna. #380 (24-08 tarde) estira el bloque del modal 14/11 y su costura llega
    // al fondo EXACTO: la scanline blanca final es la ÚLTIMA de la propia costura (y87
    // con su ventana ►↕◄, como en 1988) y `panelEdgeBottom` vuelve a `null` —
    // repintarla maciza taparía la ventana del ►↕◄. Con HISTORIAL la costura se anula
    // (la fila 10 es del banner) y el cierre de #378 sigue haciendo falta.
    for (const scroll of [false, true]) {
      const L = squareLayout(390, 504, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: scroll,
        panelBoxesFused: true,
      });
      if (L.kind !== "reflow") throw new Error("no cayó en re-flow");
      const p = L.panes;
      const fondoLog = p.log.dy + p.log.dh;
      const r = tramoFiloDeCierreAlBorde(p, K)!;
      expect(r, `tramo presente (scroll=${scroll})`).not.toBeNull();
      if (scroll) {
        const cierre = p.panelEdgeBottom!;
        expect(cierre, "cierre presente con historial").not.toBeNull();
        // Fuente en crudo: el flanco de y87, no el y56 del divisor (texto con overlay).
        expect(cierre.sy).toBe(87);
        expect(cierre.sh).toBe(1);
        expect(cierre.dy + cierre.dh).toBeCloseTo(fondoLog, 6);
        expect(r.y).toBeCloseTo(cierre.dy * K, 6);
        expect(r.h).toBeCloseTo((cierre.dh / cierre.sh) * K, 6);
      } else {
        // #380: el borde del modal ES el cierre — costura al fondo, filo `null`, y el
        // tramo prolongado sale de la ÚLTIMA scanline de la costura.
        expect(p.panelEdgeBottom).toBeNull();
        const seam = p.seamPanel!;
        expect(seam).not.toBeNull();
        expect(seam.dy + seam.dh).toBeCloseTo(fondoLog, 6);
        const hLinea = seam.dh / seam.sh; // una scanline fuente de la costura estirada
        expect(r.y).toBeCloseTo((seam.dy + (ROW - 1) * hLinea) * K, 6);
        expect(r.h).toBeCloseTo(hLinea * K, 6);
        // MUTANTE — la geometría de #378 (costura sin estirar, a 24 filas del fondo):
        // su borde inferior quedaba por ENCIMA del fondo del log, no coplanar.
        const sbLog = p.log.dh / p.log.sh;
        expect(seam.dy + seam.dh).not.toBeCloseTo(fondoLog - 24 * sbLog, 6);
      }
    }
  });

  it("sin tira azul (bandX = 0) no se prolonga nada", () => {
    const p = layoutDe(TELEFONOS[1], false).panes;
    const seam = { ...p.seamPanel!, dx: 0 };
    expect(tramoFiloDeCierreAlBorde({ seamPanel: seam, panelEdgeBottom: null }, K)).toBeNull();
  });
});
