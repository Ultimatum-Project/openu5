/**
 * VARIANTE CUADRADO — guardas del descriptor (PURO).
 *
 * Lo que impone este fichero, en orden de importancia:
 *   1. **INVARIANTE DEL CUADRADO** — el visor 11×11 sale CUADRADO en pantalla en los 7
 *      dispositivos del censo × las 2 orientaciones × 3 huecos de botonera. Es la petición
 *      literal del usuario y aquí es aritmética, no una impresión mirando una captura.
 *   2. Isotropía pane a pane (dh/sh ÷ dw/sw == 1 en los 6 panes): si un pane se estirara
 *      solo, el mapa seguiría cuadrado pero el texto chirriaría — se vería tarde y en vivo.
 *   3. La rama de APAISADO existe y coloca: mapa a la izquierda llenando el alto, columna
 *      roster→costura→log a la derecha, sin solapes y sin salirse del canvas.
 *   4. «Nunca peor» por construcción, igual que la variante «banda».
 *   5. El hit-test (que es COMPARTIDO) sigue devolviendo la celda correcta con la
 *      geometría nueva, incluido el apaisado — 121 de 121, ida y vuelta.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VIEW_WINDOW } from "../src/skin/api.js";
import { VIEWPORT } from "../src/skin/fiel/frame.js";
import { CONSOLE_RECT } from "../src/skin/fiel/skin.js";
import {
  BOX_W,
  CHROME_BAND_W,
  FRAME_W,
  MAP_BLOCK_H,
  PANEL_BOX_EDGES,
  PANEL_STRETCH_ROWS,
  PANEL_W,
  PLAYABLE_SIDE,
  ROSTER_BOX_BOT,
  SB_CAP,
  classicFitScale,
  portraitLayout,
  type Pane,
  type PortraitLayout,
} from "../src/skin/portrait/layout.js";
import {
  BAND_STACK_H,
  SEP_GAP_PX,
  isLandscapeGap,
  squareBandScaleLandscape,
  squareLayout,
  viewportSides,
} from "../src/skin/portrait/layout-cuadrado.js";
import { portraitHitTest } from "../src/skin/portrait/hittest.js";
import {
  bandaFlag,
  reflowFlag,
  isForcedVariant,
  isSquareVariant,
} from "../src/skin/portrait/skin.js";
import { cursoresFlag, deck3Flag, wideDeckFlag } from "../src/skin/portrait/deck-ancho.js";

/** Teléfonos y tabletas del censo (CSS px). */
const DEVICES = [
  { name: "iPhone SE", w: 375, h: 667 },
  { name: "Galaxy S8", w: 360, h: 740 },
  { name: "iPhone 15", w: 393, h: 852 },
  { name: "Pixel 7", w: 412, h: 915 },
  { name: "iPhone 15 Pro Max", w: 430, h: 932 },
  { name: "iPad mini", w: 744, h: 1133 },
  { name: 'iPad Pro 12,9"', w: 1024, h: 1366 },
] as const;

/** Huecos de botonera medidos: canónica en mundo, deck ancho, y sin botonera (tablet). */
const DECKS = [520, 340, 0] as const;

/** Panes de CONTENIDO de un layout (los opcionales ya filtrados). Quedan FUERA a
 *  propósito los panes de CROMO UNIFORME, que llevan exención de isotropía declarada en
 *  su definición: `panelFill` (Pieza B 27-07), `panelStretch` y las tres tiras
 *  `band*` (01-08) — todos son un rect de color/scanline uniforme estirado, así que su
 *  «estirado» no es observable. Para los tests de límites úsese `allPanesConFill`. */
function allPanes(L: PortraitLayout): Pane[] {
  const p = L.panes;
  return [
    p.sky,
    p.box,
    p.winds,
    p.panel,
    p.seamLog,
    p.log,
    ...(p.seamPanel ? [p.seamPanel] : []),
    ...(p.panelBottom ? [p.panelBottom] : []),
    // `panelEdge` (02-08) va aquí y NO en la lista de exentos: es una copia RECTA de 7
    // scanlines de cromo a la escala de la banda, sin estirar nada.
    ...(p.panelEdge ? [p.panelEdge] : []),
  ];
}

/** Todos los panes, cromo uniforme incluido (para los tests de «no se sale del canvas»). */
function allPanesConFill(L: PortraitLayout): Pane[] {
  const p = L.panes;
  return [
    ...allPanes(L),
    // `panelEdgeBottom` (03-08) va con los EXENTOS y no con `panelEdge`: aquél es una copia
    // recta de 7 scanlines, éste una tira de 4 px de blanco MACIZO estirada al ancho de la
    // columna — porque con el scrollback abierto no queda en toda la fuente una fila blanca
    // de 129 px que copiar (medido). Color uniforme ⇒ el estirado es inobservable.
    ...([p.panelFill, p.panelStretch, p.panelEdgeBottom, p.bandLeft, p.bandRight, p.bandBottom].filter(
      Boolean,
    ) as Pane[]),
  ];
}

/** Estirado de un pane: 1 = píxel cuadrado. */
function stretch(p: Pane): number {
  return p.dh / p.sh / (p.dw / p.sw);
}

describe("cuadrado — INVARIANTE: el visor 11×11 es un cuadrado", () => {
  it("lado horizontal == lado vertical en 7 dispositivos × 2 orientaciones × 3 botoneras", () => {
    let n = 0;
    for (const d of DEVICES) {
      for (const deck of DECKS) {
        for (const [W, H] of [
          [d.w, d.h - deck], // vertical: la botonera se come ALTO
          [d.h - deck, d.w], // apaisado: la botonera es columna, se come ANCHO
        ] as const) {
          const L = squareLayout(W, H, { force: "reflow" });
          const s = viewportSides(L);
          expect(s.w).toBeCloseTo(s.h, 6);
          expect(s.w).toBeGreaterThan(0);
          n++;
        }
      }
    }
    expect(n).toBe(42);
  });

  it("también con la decisión HONESTA puesta (cuando delega en clásico sigue cuadrado)", () => {
    for (const d of DEVICES) {
      const L = squareLayout(d.w, d.h - 520);
      const s = viewportSides(L);
      expect(s.w).toBeCloseTo(s.h, 6);
    }
  });

  it("los 6 panes son ISÓTROPOS (ni el texto se estira)", () => {
    for (const [W, H] of [
      [393, 852 - 340],
      [852 - 0, 393],
      [1024, 1366],
    ] as const) {
      for (const p of allPanes(squareLayout(W, H, { force: "reflow" }))) {
        expect(stretch(p)).toBeCloseTo(1, 6);
      }
    }
  });

  it("la variante «banda» con el 4:3 de época NO es cuadrada — la diferencia es real", () => {
    // Guarda anti-tautología: si `squareLayout` fuese un alias de `portraitLayout`, este
    // test lo cazaría. Con `aspectY=1,2` la banda estira el visor un 20 %.
    const banda = portraitLayout(393, 512, 1.2, { force: "reflow" });
    const sb = viewportSides(banda);
    expect(sb.h / sb.w).toBeCloseTo(1.2, 6);
    const cuad = squareLayout(393, 512, { force: "reflow" });
    const sc = viewportSides(cuad);
    expect(sc.h / sc.w).toBeCloseTo(1, 6);
    expect(cuad.aspectY).toBe(1);
  });
});

describe("cuadrado — rama VERTICAL", () => {
  const L = squareLayout(393, 852 - 340, { force: "reflow" });

  it("la pila: mapa arriba, HUECO de separación, banda de dos columnas debajo", () => {
    const p = L.panes;
    expect(p.sky.dy).toBe(0);
    expect(p.box.dy).toBeCloseTo(7 * L.mapScale, 6);
    expect(p.winds.dy).toBeCloseTo(184 * L.mapScale, 6);
    // La banda ya NO es contigua al mapa: desde el 26-07 los separa un hueco en PÍXELES
    // DE JUEGO (petición del usuario: «separadas unos píxeles»), escalado con el mapa para
    // que se vea igual de grueso en cualquier teléfono. Se vigila el hueco, no la
    // contigüidad: si alguien lo pierde, este test lo dice.
    expect(p.panel.dy - MAP_BLOCK_H * L.mapScale).toBeCloseTo(SEP_GAP_PX * L.mapScale, 6);
    expect(SEP_GAP_PX).toBeGreaterThan(0);
    expect(p.seamLog.dy).toBeCloseTo(p.panel.dy, 6);
    expect(p.log.dy).toBeCloseTo(p.seamLog.dy + p.seamLog.dh, 6);
    expect(p.log.dx).toBeCloseTo(p.panel.dx + p.panel.dw, 6);
  });

  it("nada se sale del canvas en los 7 dispositivos", () => {
    for (const d of DEVICES) {
      const R = squareLayout(d.w, d.h - 340, { force: "reflow" });
      for (const p of [...allPanesConFill(R), R.full]) {
        expect(p.dx).toBeGreaterThanOrEqual(-1e-6);
        expect(p.dy).toBeGreaterThanOrEqual(-1e-6);
        expect(p.dx + p.dw).toBeLessThanOrEqual(R.canvasW + 1e-6);
        expect(p.dy + p.dh).toBeLessThanOrEqual(R.canvasH + 1e-6);
      }
    }
  });

  it("el log NO se degrada: su pitch de glifo ≥ el del layout clásico (salvo cap en tablet)", () => {
    for (const d of DEVICES) {
      const Hav = d.h - 340;
      const R = squareLayout(d.w, Hav, { force: "reflow" });
      const pitch = (R.panes.log.dh / R.panes.log.sh) * 8;
      if (R.bandScale < SB_CAP) expect(pitch).toBeGreaterThanOrEqual(classicFitScale(d.w, Hav, 1) * 8 - 1e-6);
      else expect(pitch).toBeLessThanOrEqual(16 + 1e-6);
    }
  });

  it("la costura de la fila 10 se ENRUTA por el scrollback (igual que la variante banda)", () => {
    const normal = squareLayout(393, 512, { force: "reflow", consoleScrollActive: false });
    expect(normal.panes.seamPanel).not.toBeNull();
    const scrolled = squareLayout(393, 512, { force: "reflow", consoleScrollActive: true });
    expect(scrolled.panes.seamPanel).toBeNull();
    expect(scrolled.panes.box).toEqual(normal.panes.box);
    expect(scrolled.panes.log).toEqual(normal.panes.log);
  });

  /**
   * PIEZA B (spec del usuario 27-07) + DIRECTRIZ del 01-08. El 27-07 pidió que la columna
   * de jugadores «llegue hasta donde llega el log» y se resolvió con RELLENO AZUL. El
   * 01-08, viéndolo, lo concretó: «alargando en altura la zona de jugadores y bajando por
   * ende los KPIs». O sea, los mismos 104 px de columna, pero llenos de CAJA en vez de
   * vacío azul. Aquí se vigila la cadena COMPLETA sin huecos y sin solapes:
   *   panel(0..55) → estirado(16) → panelBottom(56..79) → costura(80..87) = 104.
   */
  it("B: la columna de jugadores llega al FONDO del log con CROMO, sin huecos", () => {
    for (const scrollActive of [false, true]) {
      const R = squareLayout(393, 512, { force: "reflow", consoleScrollActive: scrollActive });
      const p = R.panes;
      const fondo = p.log.dy + p.log.dh;
      // La cadena de piezas es CONTIGUA y todas comparten columna (x y ancho).
      const cadena = [
        p.panel,
        p.panelStretch!,
        p.panelBottom!,
        (p.seamPanel ?? p.panelFill)!,
      ];
      for (const [i, q] of cadena.entries()) {
        expect(q, `pieza ${i} presente (scroll=${scrollActive})`).toBeTruthy();
        expect(q.dx).toBeCloseTo(p.panel.dx, 6);
        expect(q.dw).toBeCloseTo(p.panel.dw, 6);
        expect(q.dh).toBeGreaterThan(0);
        if (i > 0) expect(q.dy).toBeCloseTo(cadena[i - 1]!.dy + cadena[i - 1]!.dh, 6);
      }
      // …y la última LLEGA exactamente al fondo de la columna del log.
      const ultima = cadena[cadena.length - 1]!;
      expect(ultima.dy + ultima.dh).toBeCloseTo(fondo, 6);
      // El estirado sale del INTERIOR de la caja de jugadores (fila en blanco), y su
      // fuente es UNA scanline: si alguien lo apuntara a un tramo con tinta, se estiraría
      // texto y esto lo dice.
      expect(p.panelStretch!.sh).toBe(1);
      expect(p.panelStretch!.sy).toBe(ROSTER_BOX_BOT - 1);
      expect(p.panelStretch!.dh).toBeCloseTo(PANEL_STRETCH_ROWS * R.bandScale, 6);
    }
  });

  /**
   * LA CIFRA de la directriz: la caja de JUGADORES crece exactamente lo que la columna
   * tenía de menos que el log, y la de KPIs no se estira — sólo BAJA. Test de aritmética,
   * no de captura: si alguien cambia el reparto, el número canta.
   */
  it("B: jugadores +16 filas fuente · KPIs igual de altos y 16 filas más abajo", () => {
    const R = squareLayout(393, 512, { force: "reflow" });
    const p = R.panes;
    const sb = R.bandScale;
    // Caja de jugadores: del filo de arriba (fila 7) al de abajo, que ahora vive al final
    // del tramo estirado.
    const jugAntes = (ROSTER_BOX_BOT - PANEL_BOX_EDGES[0]!) * sb; // 49·sb
    const jugAhora = p.panelStretch!.dy + p.panelStretch!.dh - (p.panel.dy + PANEL_BOX_EDGES[0]! * sb);
    expect(jugAhora - jugAntes).toBeCloseTo(PANEL_STRETCH_ROWS * sb, 6);
    // Caja de KPIs: MISMO alto (no se estira) y desplazada justo esas 16 filas.
    const kpiAlto = (PANEL_BOX_EDGES[3]! - PANEL_BOX_EDGES[2]!) * sb; // 17·sb
    const kpiTopAhora = p.panelBottom!.dy + (PANEL_BOX_EDGES[2]! - ROSTER_BOX_BOT) * sb;
    const kpiTopAntes = p.panel.dy + PANEL_BOX_EDGES[2]! * sb;
    expect(kpiTopAhora - kpiTopAntes).toBeCloseTo(PANEL_STRETCH_ROWS * sb, 6);
    expect(kpiAlto).toBeGreaterThan(0);
  });
});

/**
 * ENCARGO C (01-08) — la BANDA AZUL perimetral. Lo que se vigila no es «que se vea
 * bonito» sino las dos cosas que pueden romperse sin que nadie se entere: que la tira
 * tenga EL MISMO grosor que la banda lateral del mapa (si no, hay escalón), y que el
 * precio lo pague la banda y NUNCA el visor 11×11.
 */
describe("cuadrado — banda azul perimetral (encargo 01-08)", () => {
  const modos = ["off", "izq", "full"] as const;

  it("el visor 11×11 NO paga la banda: mapScale idéntico en los tres modos", () => {
    const escalas = modos.map((banda) => squareLayout(393, 512, { force: "reflow", banda }).mapScale);
    expect(escalas[1]).toBeCloseTo(escalas[0]!, 9);
    expect(escalas[2]).toBeCloseTo(escalas[0]!, 9);
  });

  it("la tira tiene el grosor de la banda lateral del MAPA (misma columna, sin escalón)", () => {
    for (const banda of ["izq", "full"] as const) {
      const R = squareLayout(393, 512, { force: "reflow", banda });
      const izq = R.panes.bandLeft!;
      expect(izq, `bandLeft con banda=${banda}`).toBeTruthy();
      expect(izq.dw).toBeCloseTo(CHROME_BAND_W * R.mapScale, 6);
      expect(izq.dx).toBeCloseTo(0, 6);
      // Arranca en el techo de la banda y llega a su fondo.
      expect(izq.dy).toBeCloseTo(R.panes.panel.dy, 6);
      expect(izq.dy + izq.dh).toBeCloseTo(R.panes.log.dy + R.panes.log.dh, 6);
    }
  });

  it("`izq` deja SÓLO la izquierda; `full` añade derecha y abajo; `off` no pone ninguna", () => {
    const off = squareLayout(393, 512, { force: "reflow", banda: "off" }).panes;
    expect([off.bandLeft, off.bandRight, off.bandBottom]).toEqual([null, null, null]);
    const izq = squareLayout(393, 512, { force: "reflow", banda: "izq" }).panes;
    expect(izq.bandLeft).not.toBeNull();
    expect([izq.bandRight, izq.bandBottom]).toEqual([null, null]);
    const full = squareLayout(393, 512, { force: "reflow", banda: "full" });
    expect(full.panes.bandRight).not.toBeNull();
    expect(full.panes.bandBottom).not.toBeNull();
    expect(full.panes.bandRight!.dx + full.panes.bandRight!.dw).toBeCloseTo(full.canvasW, 6);
    expect(full.panes.bandBottom!.dy + full.panes.bandBottom!.dh).toBeCloseTo(full.canvasH, 6);
  });

  it("el DEFECTO es `izq` (la directriz), y la bandera lo lee de la URL", () => {
    expect(squareLayout(393, 512, { force: "reflow" }).panes.bandLeft).not.toBeNull();
    expect(bandaFlag("")).toBe("izq");
    expect(bandaFlag("?banda=full")).toBe("full");
    expect(bandaFlag("?banda=completa")).toBe("full");
    expect(bandaFlag("?banda=off")).toBe("off");
    expect(bandaFlag("?banda=loquesea")).toBe("izq");
  });

  it("el log paga MENOS pitch, pero sigue por encima del clásico en los 5 teléfonos", () => {
    for (const d of DEVICES.slice(0, 5)) {
      // `orient` EXPLÍCITO: con el deck reservado, el hueco de varios teléfonos queda más
      // ancho que alto y la rama que decide sería la APAISADA — donde la banda no aplica y
      // este control se absolvería solo (el defecto «control verde sin dientes»).
      const Hav = d.h - 340;
      const o = { force: "reflow", orient: "portrait" } as const;
      const conBanda = squareLayout(d.w, Hav, { ...o, banda: "full" });
      const pitch = (conBanda.panes.log.dh / conBanda.panes.log.sh) * 8;
      expect(pitch, `${d.name}`).toBeGreaterThanOrEqual(classicFitScale(d.w, Hav, 1) * 8 - 1e-6);
      // Y es MENOR que sin banda: si fuese igual, la tira no estaría saliendo de ningún
      // sitio y el control no estaría midiendo nada.
      const sin = squareLayout(d.w, Hav, { ...o, banda: "off" });
      expect(conBanda.bandScale, `${d.name}`).toBeLessThan(sin.bandScale);
    }
  });

  it("en APAISADO la banda NO aplica (la columna ya va pegada al marco del mapa)", () => {
    const R = squareLayout(852 - 300, 393, { force: "reflow", banda: "full" });
    expect([R.panes.bandLeft, R.panes.bandRight, R.panes.bandBottom]).toEqual([null, null, null]);
  });
});

describe("cuadrado — rama APAISADA (la que la variante «banda» no tenía)", () => {
  // iPhone 15 girado con el deck en columna lateral (~300 px medidos por touch.ts).
  const L = squareLayout(852 - 300, 393, { force: "reflow" });

  it("el hueco apaisado se detecta por el HUECO, no por la pantalla", () => {
    expect(isLandscapeGap(552, 393)).toBe(true);
    expect(isLandscapeGap(393, 512)).toBe(false);
  });

  it("mapa a la IZQUIERDA, columna roster→costura→log a la DERECHA", () => {
    const p = L.panes;
    // Desde el 26-07 el mapa va con su CROMO completo: el marco arranca en x=0 y la caja
    // y las bandas de HUD viven DENTRO, en sus offsets fuente (§refinamiento del usuario).
    expect(p.frame).not.toBeNull();
    expect(p.frame!.dx).toBeCloseTo(0, 6);
    expect(p.sky.dx).toBeCloseTo(p.sky.sx * L.mapScale, 6);
    expect(p.box.dx).toBeCloseTo(p.box.sx * L.mapScale, 6);
    expect(p.panel.dx).toBeCloseTo(FRAME_W * L.mapScale, 6);
    // La columna es ÚNICA y va apilada en el orden del original.
    expect(p.seamLog.dx).toBeCloseTo(p.panel.dx, 6);
    expect(p.log.dx).toBeCloseTo(p.panel.dx, 6);
    expect(p.seamLog.dy).toBeCloseTo(p.panel.dy + p.panel.dh, 6);
    expect(p.log.dy).toBeCloseTo(p.seamLog.dy + p.seamLog.dh, 6);
    // Y la costura NO se duplica (apiladas, sería pintar dos veces el mismo renglón).
    expect(p.seamPanel).toBeNull();
    // Columna única apilada: no hay hueco que rellenar (el relleno es de la rama vertical).
    expect(p.panelFill).toBeNull();
  });

  it("el mapa llena el ALTO y la columna cabe en el ancho que sobra", () => {
    expect(MAP_BLOCK_H * L.mapScale).toBeLessThanOrEqual(L.canvasH + 1e-6);
    expect(FRAME_W * L.mapScale + PANEL_W * L.bandScale).toBeCloseTo(L.canvasW, 6);
    expect(BAND_STACK_H * L.bandScale).toBeLessThanOrEqual(L.canvasH + 1e-6);
  });

  it("nada se sale del canvas en los 7 dispositivos girados", () => {
    for (const d of DEVICES) {
      const R = squareLayout(d.h - 300, d.w, { force: "reflow" });
      for (const p of [...allPanesConFill(R), R.full]) {
        expect(p.dx).toBeGreaterThanOrEqual(-1e-6);
        expect(p.dy).toBeGreaterThanOrEqual(-1e-6);
        expect(p.dx + p.dw).toBeLessThanOrEqual(R.canvasW + 1e-6);
        expect(p.dy + p.dh).toBeLessThanOrEqual(R.canvasH + 1e-6);
      }
    }
  });

  it("con el hueco muy estrecho la columna se acota y el mapa encoge, sin negativos", () => {
    const tight = squareLayout(260, 200, { force: "reflow" });
    expect(tight.mapScale).toBeGreaterThan(0);
    expect(tight.bandScale).toBeGreaterThan(0);
    expect(squareBandScaleLandscape(0, 0)).toBe(0);
    const s = viewportSides(tight);
    expect(s.w).toBeCloseTo(s.h, 6);
  });
});

describe("cuadrado — decisión honesta y bandera", () => {
  it("elige siempre el layout con MÁS área jugable, en las dos orientaciones", () => {
    for (const d of DEVICES) {
      for (const deck of DECKS) {
        for (const [W, H] of [
          [d.w, d.h - deck],
          [d.h - deck, d.w],
        ] as const) {
          const L = squareLayout(W, H);
          expect(L.playableArea).toBeGreaterThanOrEqual(L.classicPlayableArea - 1e-6);
          expect(L.kind).toBe(L.mapScale > L.classicScale ? "reflow" : "clasico");
        }
      }
    }
  });

  /**
   * HALLAZGO (y la razón de que la variante «banda» perdiera en mundo): el re-flow original
   * apila SIEMPRE en vertical, así que cuando la botonera canónica deja un hueco MÁS ANCHO
   * QUE ALTO (393×332 en un iPhone 15, que es el caso real medido) sigue apilando y paga
   * ×0,80-0,94. La variante cuadrado conmuta ahí a la rama apaisada — y con eso deja de
   * perder. El barrido de 2 156 huecos no encuentra NI UNO en que pierda.
   */
  it("barrido de 2 156 huecos: el cuadrado NUNCA queda por debajo del clásico", () => {
    let n = 0;
    let peor = Infinity;
    for (let W = 200; W <= 1400; W += 25) {
      for (let H = 100; H <= 1400; H += 30) {
        const L = squareLayout(W, H, { force: "reflow" });
        peor = Math.min(peor, L.mapScale / classicFitScale(W, H, 1));
        expect(L.mapScale).toBeGreaterThanOrEqual(classicFitScale(W, H, 1) - 1e-9);
        n++;
      }
    }
    expect(n).toBe(2156);
    expect(peor).toBeGreaterThanOrEqual(1);
  });

  it("hueco degenerado: sin NaN ni negativos", () => {
    const Z = squareLayout(0, 0);
    expect(Z.kind).toBe("clasico");
    expect(Z.playableArea).toBe(0);
    expect(Number.isFinite(Z.canvasW)).toBe(true);
    expect(Number.isFinite(squareLayout(393, 40).mapScale)).toBe(true);
    expect(squareLayout(-5, -5).playableArea).toBe(0);
  });

  it("la bandera reconoce la variante y su modo forzado", () => {
    expect(reflowFlag("?reflow=cuadrado")).toBe("cuadrado");
    expect(reflowFlag("?skin=cuadrado")).toBe("cuadrado");
    expect(reflowFlag("?reflow=cuadrado-force")).toBe("cuadrado-force");
    expect(reflowFlag("?reflow=force")).toBe("force");
    expect(reflowFlag("?reflow=1")).toBe("auto");
    expect(reflowFlag("")).toBe("off");
    expect(isSquareVariant("cuadrado")).toBe(true);
    expect(isSquareVariant("cuadrado-force")).toBe(true);
    expect(isSquareVariant("auto")).toBe(false);
    expect(isForcedVariant("cuadrado-force")).toBe(true);
    expect(isForcedVariant("cuadrado")).toBe(false);
  });

  it("`?deck=` elige la sub-variante de botonera y `off` la AÍSLA", () => {
    expect(wideDeckFlag("?deck=fila", "bloques")).toBe("fila");
    expect(wideDeckFlag("?deck=cruz", "bloques")).toBe("cruz");
    expect(wideDeckFlag("?deck=columnas", "bloques")).toBe("columnas");
    expect(wideDeckFlag("?deck=nativo", "bloques")).toBe("nativo");
    expect(wideDeckFlag("?deck=bloques", "off")).toBe("bloques");
    expect(wideDeckFlag("?deck=off", "bloques")).toBe("off");
    // Valor desconocido ⇒ la sub-variante de la ÚLTIMA iteración del usuario, no una vieja.
    expect(wideDeckFlag("?deck=ancho", "cruz")).toBe("bloques");
    expect(wideDeckFlag("", "bloques")).toBe("bloques");
    expect(wideDeckFlag("")).toBe("off");
    // Los dos knobs de la sub-variante `nativo` (ambigüedades declaradas del encargo).
    expect(deck3Flag("?deck3=full")).toBe("full");
    expect(deck3Flag("")).toBe("min");
    expect(cursoresFlag("?cursores=cruz")).toBe("cruz");
    expect(cursoresFlag("")).toBe("fila");
  });
});

describe("cuadrado — el hit-test COMPARTIDO sigue acertando", () => {
  for (const [label, L] of [
    ["vertical", squareLayout(393, 852 - 340, { force: "reflow" })],
    ["apaisado", squareLayout(852 - 300, 393, { force: "reflow" })],
  ] as const) {
    it(`${label}: el centro de cada celda del visor vuelve a SU celda (121 de 121)`, () => {
      const p = L.panes.box;
      let ok = 0;
      for (let col = 0; col < VIEW_WINDOW; col++) {
        for (let row = 0; row < VIEW_WINDOW; row++) {
          const lx = VIEWPORT.x + (col + 0.5) * VIEWPORT.tile;
          const ly = VIEWPORT.y + (row + 0.5) * VIEWPORT.tile;
          const hit = portraitHitTest(
            L,
            p.dx + ((lx - p.sx) / p.sw) * p.dw,
            p.dy + ((ly - p.sy) / p.sh) * p.dh,
          );
          if (hit?.region === "map" && hit.col === col && hit.row === row) ok++;
        }
      }
      expect(ok).toBe(VIEW_WINDOW * VIEW_WINDOW);
    });

    it(`${label}: la columna del log devuelve px lógicos dentro de CONSOLE_RECT`, () => {
      const p = L.panes.log;
      const hit = portraitHitTest(L, p.dx + p.dw / 2, p.dy + p.dh / 2);
      expect(hit?.region).toBe("log");
      expect(hit!.py).toBeGreaterThanOrEqual(CONSOLE_RECT.topRow * 8);
      expect(hit!.py).toBeLessThan((CONSOLE_RECT.botRow + 1) * 8);
    });
  }

  it("la ventana lógica sigue siendo 11×11 (se gana escala, jamás tiles)", () => {
    expect(PLAYABLE_SIDE).toBe(VIEW_WINDOW * VIEWPORT.tile);
    const L = squareLayout(430, 932 - 340, { force: "reflow" });
    expect(L.panes.box.sw).toBe(BOX_W);
    expect(L.panes.box.sh).toBe(BOX_W);
  });
});

/**
 * ★★ PUNTO FIJO EN UNA PASADA — el invariante «SIN BUCLE», ejecutable.
 *
 * POR QUÉ EXISTE ESTE FICHERO Y NO UNA FRASE. La cabecera de `skin.ts` garantizaba, en
 * prosa, que el reparto de alto entre mapa y botonera **no se realimenta**: «Sin bucle: el
 * cap del deck no cambia `canvasH`». Al plantearse derogar la política de al lado (el mapa
 * se lleva el ancho entero), esa garantía se habría caído con ella **sin que nada se pusiera
 * rojo**, porque vivía en un comentario. Un invariante en prosa es un invariante que se
 * puede derogar por accidente. Aquí queda atado.
 *
 * QUÉ MODELA. El único camino de realimentación posible es éste: la botonera se queda con
 * `H − canvasH`, así que si alguien acotara el mapa contra una altura YA mordida por la
 * botonera, la salida del layout volvería a entrar como su propia entrada. Se simula
 * exactamente eso — recalcular el layout con `availH = canvasH` de la pasada anterior — y se
 * exige que el resultado NO SE MUEVA.
 *
 * CÓMO SE LEE UN ROJO AQUÍ: alguien ha hecho `canvasH` dependiente de una altura que la
 * propia botonera reduce. El arreglo NO es relajar este test: es acotar contra una altura
 * que la botonera no pueda mover.
 *
 * ⚠ Y QUE QUEDE DICHO: este test NO habría cazado el intento del 03-08 —medido, allí
 * `availH` era el viewport ENTERO (`innerHeight − container.clientHeight` = 0 en las 20
 * celdas) y no había bucle que cazar—. Existe porque el invariante debe ser ejecutable ANTES
 * de que alguien introduzca la dependencia, no después.
 */
describe("cuadrado: el reparto de alto no se realimenta", () => {
  for (const d of DEVICES) {
    it(`${d.name}: realimentar canvasH como availH no mueve el layout`, () => {
      // ★ SE PASA `viewportH` — SIN ÉL EL TEST NO TOCA EL TOPE Y ES UN VERDE VACÍO.
      // Lo cazó su propio mutante: mutar la piel dejaba los 39 verdes porque este test es
      // PURO y no pasaba por el camino acotado. El `viewportH` es lo que NO se realimenta
      // (en producción, el alto de `#app`); `availH` sí, y por eso es el que se devuelve.
      const vp = { force: "reflow" as const, viewportH: d.h };
      const L1 = squareLayout(d.w, d.h, vp);
      // La botonera se queda con lo que sobra; se le devuelve al layout como si fuera el
      // hueco disponible — que es LITERALMENTE lo que hace la piel. Un layout sin
      // realimentación da EXACTAMENTE lo mismo.
      const L2 = squareLayout(d.w, L1.canvasH, vp);
      expect(L2.canvasH, "canvasH se mueve al realimentar ⇒ hay bucle").toBe(L1.canvasH);
      expect(L2.canvasW, "canvasW se mueve al realimentar ⇒ hay bucle").toBe(L1.canvasW);
      expect(L2.mapScale, "la escala del mapa se mueve ⇒ hay bucle").toBe(L1.mapScale);
      expect(L2.bandScale, "la escala de la banda se mueve ⇒ hay bucle").toBe(L1.bandScale);
    });
  }

  it("★ y el punto fijo se alcanza en UNA pasada, no converge en varias", () => {
    // Converger en tres pasadas también «estabiliza», pero significa que el primer render
    // que ve el usuario es distinto del segundo. La exigencia es que la primera ya sea la
    // definitiva.
    for (const d of DEVICES) {
      const vp = { force: "reflow" as const, viewportH: d.h };
      let L = squareLayout(d.w, d.h, vp);
      const primera = L.canvasH;
      for (let i = 0; i < 3; i++) L = squareLayout(d.w, L.canvasH, vp);
      expect(L.canvasH, `${d.name}: el layout converge en varias pasadas, no en una`).toBe(
        primera,
      );
    }
  });
});

/**
 * ★★ EL CABLEADO DEL TOPE, AFIRMADO — porque «si falta, no hay tope» se desactiva EN SILENCIO.
 *
 * `opts.viewportH` es OPCIONAL a propósito: sin él la conducta histórica queda intacta y los
 * tests que no lo pasan siguen valiendo. Pero ese default es **«sin tope»**, así que un
 * llamador que se lo deje —un refactor que reordene el sitio de llamada de la piel— devuelve
 * las teclas del numpad a 34 px **con la suite entera en verde**. Es
 * `guarda-de-existencia-bendice-el-vacio` en su forma más barata de cometer.
 *
 * Los criterios de efecto (F3/F6: el canvas topa, las teclas miden 44) lo cazarían HOY, pero
 * miden el RESULTADO; lo que aquí se fija es que **el cableado siga existiendo**. Por eso es
 * análisis estático del fuente y no una medición: la pregunta no es «¿funciona?» sino
 * «¿sigue la piel pasándoselo?».
 *
 * Un rojo aquí NO se arregla relajando el test: se arregla devolviendo el `viewportH` al sitio
 * de llamada. Y si algún día el tope deja de existir, este test se borra CON él, a mano y a
 * propósito — que es exactamente la fricción que se quiere.
 */
/*
 * 🔴 AQUÍ VIVÍA EL GUARDA DEL CABLEADO DEL TOPE, y se retira con el tope (03-08 tarde).
 *
 * Vigilaba que `skin.ts` pasara `viewportH` al layout y que lo cableara al PADRE del
 * contenedor —no a `availH`—, porque «si falta `viewportH` no hay tope» era un guarda que se
 * desactivaba EN SILENCIO. Era un buen guarda: su sujeto era el TOPE.
 *
 * Al restituirse «el mapa no negocia», `viewportH` se queda **sin consumidor**: ya no existe
 * nada que acotar, así que el cableado sería código muerto y su guarda vigilaría la nada.
 * Conservarlo habría sido exactamente lo que hoy hemos borrado en `filaCromo`: una guarda
 * que pasa siempre sobre una función que nadie llama.
 *
 * LO QUE **NO** SE VA, y era la otra mitad: los tests de PUNTO FIJO de arriba («el reparto de
 * alto no se realimenta»). El bucle de realimentación es real con tope y sin él, y esos no
 * dependían del `viewportH` — corren sobre el reparto puro.
 *
 * Si algún día vuelve un tope, vuelve este guarda CON él, y su tabla de coste medida en LOS
 * DOS EJES (alto y ancho) y sobre métricas de dispositivo REALES.
 */
