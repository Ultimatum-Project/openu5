/**
 * EL ESTIRADO DE LA CAJA DE JUGADORES NO PUEDE REPLICAR UNA BARRA DE VÍDEO INVERSO —
 * ficha #223 (reporte del usuario 13-08, captura ui-portrait-…D2362705).
 *
 * EL DEFECTO. La columna izquierda del portrait cuadrado crece 24 scanlines replicando
 * UNA de la caja de jugadores (`SRC_PANEL_STRETCH`, y=55). Esa elección vale mientras y55
 * esté en blanco — lo está con texto normal, porque el octavo renglón de un glifo es el
 * hueco entre líneas. Pero y55 es la ÚLTIMA scanline de la sexta fila de texto de la caja
 * (interior y8..55 = seis filas de 8 exactas), así que en cuanto esa fila va en VÍDEO
 * INVERSO la scanline replicada es blanco macizo y el estirado la multiplica: la barra de
 * selección pasa de 8 a 8+24 = 32 px fuente, CUATRO renglones con el texto pegado arriba.
 *
 * DOS PUERTAS a la misma scanline, y ninguna es rara:
 *   · el picker de «Use item»/Ready con el cursor en la 5ª fila visible (`fiel/ready.ts`
 *     la sitúa en la fila 6 de la ventana ⇒ y48..55) — el caso que fotografió el usuario;
 *   · la fila 6 del ROSTER en inverso (selección de personaje, impacto, veneno de #213).
 *
 * QUÉ SE ASIERTA AQUÍ. La GEOMETRÍA del bloque blanco que resulta de componer la columna,
 * medida en scanlines fuente: con el fix es UN renglón (8) y con la scanline fija son
 * CUATRO (32). El mutante —forzar la constante— está instanciado abajo y tiene que dar 32,
 * porque un test que sólo comprobara «devuelve 47» pasaría también con un compositor que
 * ignorase el valor devuelto.
 *
 * La medición VIVA que originó los números (WebKit/iPhone 390×844@3, canvas 1170×1696,
 * bandScale 1,456 ⇒ 34,95 px de dispositivo por renglón) está en el commit: antes, bloque
 * blanco continuo y1416..1556 = 140 px = 32 scanlines; después, y1416..1450 = 35 px = 8.
 */
import { describe, expect, it } from "vitest";
import {
  PANEL_BOX_EDGES,
  ROSTER_BOX_INNER_TOP,
  PANEL_STRETCH_ROWS,
  ROSTER_BOX_BOT,
  ROW,
  SRC_PANEL_STRETCH,
  stretchSourceRow,
} from "../src/skin/portrait/layout.js";

/** Fracciones de blanco MEDIDAS sobre la fuente viva el 13-08 (x191..319 = 129 col). */
const BLANCA = 2 / 129; // 1,6 % — los dos filos de la caja
const BLANCA_CON_PICKER = 6 / 129; // 4,7 % — + los filos del pergamino del picker
const INVERSA = 118 / 129; // 91,5 % — bajo la barra de vídeo inverso

/**
 * Panel sintético: fracción de blanco por scanline fuente. `filaInversa` es el índice
 * (1..6) de la fila de texto de la caja que va en vídeo inverso; `null` = ninguna.
 */
function panelSintetico(filaInversa: number | null, fondo = BLANCA): (sy: number) => number {
  return (sy) => {
    if (filaInversa === null) return fondo;
    const ini = ROSTER_BOX_INNER_TOP + (filaInversa - 1) * ROW;
    return sy >= ini && sy < ini + ROW ? INVERSA : fondo;
  };
}

/**
 * COMPONE la columna del panel como lo hace la variante cuadrado —filas 0..55, luego
 * `PANEL_STRETCH_ROWS` réplicas de la scanline elegida, luego 56..79— y devuelve el
 * bloque contiguo de scanlines BLANCAS más alto, en scanlines fuente.
 */
function altoDelBloqueBlanco(lector: (sy: number) => number, syEstirado: number): number {
  const col: number[] = [];
  for (let sy = 0; sy < ROSTER_BOX_BOT; sy++) col.push(lector(sy));
  for (let i = 0; i < PANEL_STRETCH_ROWS; i++) col.push(lector(syEstirado));
  for (let sy = ROSTER_BOX_BOT; sy < 80; sy++) col.push(lector(sy));
  let mejor = 0;
  let run = 0;
  for (const f of col) {
    run = f > 0.5 ? run + 1 : 0;
    if (run > mejor) mejor = run;
  }
  return mejor;
}

describe("estirado de la caja de jugadores (#223)", () => {
  it("la caja interior son SEIS filas de texto exactas y la fija es la última del todo", () => {
    // Si esto deja de cumplirse, la premisa entera («y55 es contenido») cambia de forma.
    expect(ROSTER_BOX_INNER_TOP).toBe(PANEL_BOX_EDGES[0]! + 1);
    expect(ROSTER_BOX_BOT - ROSTER_BOX_INNER_TOP).toBe(6 * ROW);
    expect(SRC_PANEL_STRETCH.sy).toBe(ROSTER_BOX_BOT - 1);
  });

  it("sin inversión replica la scanline de siempre", () => {
    expect(stretchSourceRow(panelSintetico(null))).toBe(SRC_PANEL_STRETCH.sy);
    expect(stretchSourceRow(panelSintetico(null, BLANCA_CON_PICKER))).toBe(SRC_PANEL_STRETCH.sy);
  });

  it("con la fila 6 en inverso la barra mide UN renglón, no cuatro", () => {
    const lector = panelSintetico(6);
    const sy = stretchSourceRow(lector);
    expect(altoDelBloqueBlanco(lector, sy)).toBe(ROW);

    // MUTANTE — el compositor de antes del fix, que replicaba la constante: el mismo
    // panel da 8 + PANEL_STRETCH_ROWS. Sin este brazo, un compositor que IGNORASE el
    // valor devuelto pasaría el aserto de arriba igual.
    expect(altoDelBloqueBlanco(lector, SRC_PANEL_STRETCH.sy)).toBe(ROW + PANEL_STRETCH_ROWS);
  });

  it("la inversión en CUALQUIER fila deja la barra en un renglón", () => {
    for (let fila = 1; fila <= 6; fila++) {
      const lector = panelSintetico(fila);
      expect(altoDelBloqueBlanco(lector, stretchSourceRow(lector))).toBe(ROW);
    }
  });

  it("con el picker abierto y el cursor en la 5ª fila visible (el caso fotografiado)", () => {
    // El renderer de Ready pone el cursor de la 5ª fila visible en la fila 6 de la
    // ventana, o sea y48..55: la misma que la fila 6 del roster.
    const lector = panelSintetico(6, BLANCA_CON_PICKER);
    const sy = stretchSourceRow(lector);
    expect(sy).toBe(ROSTER_BOX_INNER_TOP + 5 * ROW - 1); // y47, la anterior a la barra
    expect(altoDelBloqueBlanco(lector, sy)).toBe(ROW);
  });

  it("fuente ILEGIBLE ⇒ la scanline de siempre (fallo por el lado seguro)", () => {
    expect(stretchSourceRow(() => null)).toBe(SRC_PANEL_STRETCH.sy);
  });

  it("caja ENTERA en inverso ⇒ la de siempre (no hay nada mejor que elegir)", () => {
    expect(stretchSourceRow(() => INVERSA)).toBe(SRC_PANEL_STRETCH.sy);
  });

  it("el umbral cae en el hueco MEDIDO entre las dos poblaciones", () => {
    // Control de que el 0,5 no es un tanteo: separa las tres mediciones del 13-08 con
    // margen por los dos lados. (La avería inversa —umbral inalcanzable— es la que
    // dejó muerto al `whiteRowInBlock` retirado el 03-08.)
    expect(BLANCA).toBeLessThan(0.5);
    expect(BLANCA_CON_PICKER).toBeLessThan(0.5);
    expect(INVERSA).toBeGreaterThan(0.5);
    expect(INVERSA - BLANCA_CON_PICKER).toBeGreaterThan(0.8);
  });
});
