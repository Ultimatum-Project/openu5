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
 * #224 — EL LOG RECIBÍA LA TIRA ENTERA, así que estrenaba un filo de KPIs sin caja de
 * KPIs encima: la «línea blanca extra encima del log» del reporte (capturas …B193000B y
 * …1FAF3EC6). Cuatro arreglos anteriores de esta zona (7b797b79 · 7168751a · 29b359a8 ·
 * 505ea5d0) NO la tocaron porque todos movieron el SEPARADOR PINTADO, y ésta es CROMO
 * BLITEADO.
 *
 * Se asierta en RECTS y contra el layout REAL de los cinco teléfonos del censo portrait.
 */
/**
 * MEDICIÓN VIVA de los tres estados (13-08, WebKit móvil iPhone 390×844@3, canvas 1170×1696).
 * Este fichero asierta sobre el DESCRIPTOR; lo que sigue son las cifras de PÍXEL que se
 * miraron antes de firmar, porque un aserto de rects no ve si el remate empalma.
 * Blancos por fila, separando columna del PANEL (x<606) y del LOG (x≥606):
 *
 *              fila   ANTES(banner)   FIX(banner)   SIN BANNER
 *   separador  1203-1205  606 | 248    606 | 248     606 | 554   ← de la BANDA, no del log:
 *                                                                  full-width en los TRES
 *   regla cinta 1206-1209   0 | 140      0 | 367       0 |   0   ← lo que cambia
 *   brazo ▲     1210-1213   0 | 122      0 | 122       0 |   0
 *   brazo ▼     1232-1235   0 | 132      0 | 132       0 |   0
 *   regla inf.  1236-1240 533 | 248    533 | 248     533 | 554
 *
 * Lo que dice la tabla, y es el fondo de #246: la regla de la cinta EXISTÍA antes (140 px),
 * pero sólo DENTRO del vano del rótulo — se cortaba justo en los remates, que es por lo que
 * el brazo de arriba quedaba en el aire. Con el fix corre entera (367 px = x606..1138, la
 * columna del log completa) y los dos brazos abutan: 1209|1210 arriba, 1235|1236 abajo.
 * SIN banner las filas 1206-1235 dan CERO blancos sobre el log: la guarda de #224 sigue viva
 * MEDIDA, no sólo aserida. Apaisado: mirado aparte, intacto — usa `fiel/skin.ts`, y esto es
 * `portrait/`, así que la independencia es estructural además de observada.
 *
 * ★ LA PIEL SHADER TIENE EL MISMO DEFECTO Y LA MISMA CURA — medido, no supuesto (13-08):
 * regla de la cinta 148 → 375, y 0 sin banner (frente a 140 → 367 → 0 de la fiel; los pocos
 * píxeles de diferencia son el antialias de su remate vectorial). El pre-fix se midió DE
 * VERDAD, en `HEAD~1`. Y la razón por la que UN solo arreglo cubre las dos: `portrait/skin.ts`
 * es una piel ENVOLTORIO que aloja a la fiel *o* a la shader, y el tapado vive en el
 * envoltorio ⇒ es compartido POR CONSTRUCCIÓN. Lo que podía diferir era quién PINTA la regla
 * (eso sí es del alojado), y las dos la pintan. ⇒ **no hay que tocar nada por-piel aquí.**
 *
 * 🔴 APUNTE DE INSTRUMENTO: en WebKit MÓVIL `page.mouse.wheel` lanza «Mouse wheel is not
 * supported in mobile WebKit». Para abrir el historial en la sonda hay que ARRASTRAR con
 * eventos de puntero — que además es la vía de producción en táctil (`portrait/skin.ts`,
 * `dragMoveHandler` → `consoleScrollLines`). Quien reescriba la sonda con `wheel` no verá un
 * error de scroll: verá el estado SIN banner y creerá que está midiendo el estado CON.
 */
import { describe, expect, it } from "vitest";
import { tramosFiloAjenoDelLog } from "../src/skin/portrait/layout.js";
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

describe("#224 — el filo de KPIs no entra en la columna del log", () => {
  it("sin banner se tapa la PRIMERA scanline fuente entera, y sólo ésa", () => {
    for (const t of TELEFONOS) {
      const p = layoutDe(t, false).panes;
      const [r, ...resto] = tramosFiloAjenoDelLog(p.seamLog, K, null);
      expect(resto, t.name).toEqual([]);
      expect(r, t.name).toBeDefined();
      // ALTO = UNA scanline fuente. Si fuera más, se comería el margen azul; si menos,
      // dejaría un pelo del filo ajeno asomando.
      expect(r!.h).toBeCloseTo((p.seamLog.dh / p.seamLog.sh) * K, 6);
      expect(r!.h * p.seamLog.sh).toBeCloseTo(p.seamLog.dh * K, 6);
      // Y arranca EN el techo del pane, no dentro.
      expect(r!.y).toBeCloseTo(p.seamLog.dy * K, 6);
      // ANCHO = la columna del log entera.
      expect(r!.x).toBeCloseTo(p.seamLog.dx * K, 6);
      expect(r!.x + r!.w).toBeCloseTo((p.seamLog.dx + p.seamLog.dw) * K, 6);
    }
  });

  /**
   * #246 — CON BANNER NO SE TAPA NADA, y es DECISIÓN DEL USUARIO (13-08).
   *
   * Este `it` decía «con banner se tapan los FLANCOS», y esa conducta es justo la que
   * dejaba la cinta del banner sin regla superior: el remate ◄ —que supone reglas en las
   * filas 0 y 7 de su celda, `drawBandBracket`— se quedaba con el brazo de ARRIBA en el
   * aire mientras el de abajo empalmaba con la «L» de la consola. Ése es el reporte #246.
   *
   * 🔴 Los dos reportes del usuario eran LA MISMA scanline y no se podían satisfacer a la
   * vez (#224 «quita la línea encima del log» ↔ #246 «que el ◄ empalme»). Se le escaló con
   * las dos opciones y eligió la CINTA COMPLETA, «como Winds». Por eso este aserto cambia
   * de signo: no es que la guarda estuviera mal, es que el criterio cambió y quien lo
   * cambió fue quien reporta. **No lo vuelvas a girar sin él.**
   */
  it("#246 — con banner NO se tapa nada: la fila es de la cinta y lleva su regla", () => {
    const p = layoutDe(TELEFONOS[1], true).panes;
    const x0 = p.seamLog.dx * K;
    const x1 = x0 + p.seamLog.dw * K;
    const hueco: [number, number] = [x0 + (x1 - x0) * 0.35, x0 + (x1 - x0) * 0.62];
    expect(tramosFiloAjenoDelLog(p.seamLog, K, hueco)).toEqual([]);
    // Y da igual DÓNDE caiga el banner: pegado a un extremo, al otro, o de ancho total.
    for (const h of [
      [x0, (x0 + x1) / 2],
      [(x0 + x1) / 2, x1],
      [x0, x1],
    ] as [number, number][]) {
      expect(tramosFiloAjenoDelLog(p.seamLog, K, h)).toEqual([]);
    }
  });

  it("los DOS estados siguen siendo DISTINGUIBLES (el fix no colapsó la función)", () => {
    // Control anti-vacuo: si `tramosFiloAjenoDelLog` devolviera [] SIEMPRE, el aserto de
    // arriba pasaría igual y la guarda de #224 quedaría muerta sin avisar. Los dos estados
    // tienen que seguir dando cosas distintas — que es lo que hace que (i) sea una guarda.
    const p = layoutDe(TELEFONOS[1], true).panes;
    const x0 = p.seamLog.dx * K;
    const sinBanner = tramosFiloAjenoDelLog(p.seamLog, K, null);
    const conBanner = tramosFiloAjenoDelLog(p.seamLog, K, [x0, x0 + 10]);
    expect(sinBanner).toHaveLength(1);
    expect(conBanner).toHaveLength(0);
  });
});

