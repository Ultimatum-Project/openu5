/**
 * EL FILO INFERIOR DE LA CAJA DE KPIs — decisión 3 del usuario (02-08).
 *
 * EL DEFECTO (estaba en `main` y se veía en su iPhone). En el portrait, ese filo es la
 * scanline fuente 80, la PRIMERA de la costura. Con el HISTORIAL abierto esa fila pasa a
 * ser el rótulo ►HISTORY◄ —que pertenece al log—, `seamPanel` se anula y la columna
 * izquierda se queda sin filo: bajo la fecha se pasa directo al azul.
 *
 * LA VÍA (la tercera; las dos primeras están descartadas en `portrait-polish-acta.md` §4):
 * prestarle a la columna el bloque GEMELO del divisor (y56..62), que es byte a byte el
 * mismo dibujo que las siete primeras scanlines de la costura. Aquí se sellan las TRES
 * cosas que pueden romperse sin que nadie se entere:
 *
 *   1. QUE EL GEMELO SEA EL GEMELO — no por captura sino DERIVANDO el cromo de
 *      `FRAME_FILLS`/`FRAME_SEGMENTS` con el mismo orden de pintado que `applyFrame`.
 *      Si el marco se moviera un píxel, este test canta antes que ningún ojo.
 *   2. QUE EL FILO ESTÉ — la columna izquierda termina en una scanline que ES uno de los
 *      filos del panel (`PANEL_BOX_EDGES`), con y sin historial.
 *   3. QUE NO SE PRESTE CUANDO NO SE PUEDE — con el panel FUNDIDO por un overlay (página
 *      de Ztats, picker de Ready) el divisor ya no existe en el canvas y copiarlo pintaría
 *      NEGRO donde hoy hay azul: exactamente el motivo por el que se descartó la vía B.
 */
import { describe, expect, it } from "vitest";
import { FRAME_FILLS, FRAME_SEGMENTS, SCREEN_W } from "../src/skin/fiel/frame.js";
import { panelOverlayKind } from "../src/skin/fiel/skin.js";
import {
  PANEL_BOX_EDGES,
  PANEL_W,
  ROW,
  SRC_PANEL_EDGE_BOTTOM,
  SRC_PANEL_SEAM_TWIN,
  type PortraitLayout,
} from "../src/skin/portrait/layout.js";
import { squareLayout } from "../src/skin/portrait/layout-cuadrado.js";

/** Censo de teléfonos del carril portrait (los mismos de `portrait-cuadrado`). */
const TELEFONOS = [
  { name: "iPhone SE", w: 375, h: 667 },
  { name: "iPhone 13", w: 390, h: 844 },
  { name: "iPhone 15", w: 393, h: 852 },
  { name: "Pixel 7", w: 412, h: 915 },
  { name: "Galaxy S8", w: 360, h: 740 },
] as const;

const PANEL_X = SCREEN_W - PANEL_W; // 191
/** Filo INFERIOR de la caja de KPIs en la fuente: el último de `PANEL_BOX_EDGES`. */
const KPI_BOT = PANEL_BOX_EDGES[PANEL_BOX_EDGES.length - 1]!; // 80

/**
 * RASTERIZA la columna del panel (x=191..319) SÓLO con el cromo del marco, en el mismo
 * orden que `applyFrame`: fondo → barras (`FRAME_FILLS`) → bordes (`FRAME_SEGMENTS`).
 *
 * Los glifos de esquina se omiten a PROPÓSITO y se puede: sus tres celdas viven en las
 * filas 0..7 y 184..191, y ninguna de las filas que este test compara (56..63 · 80..87)
 * las toca. Se aserta más abajo para que la omisión no sea una suposición.
 */
function cromoPanel(): string[] {
  const H = 200;
  const filas: string[] = [];
  for (let y = 0; y < H; y++) filas.push(".".repeat(PANEL_W));
  const pinta = (x0: number, y0: number, x1: number, y1: number, c: string): void => {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      const f = filas[y]!.split("");
      for (let x = Math.max(PANEL_X, x0); x <= Math.min(SCREEN_W - 1, x1); x++) {
        f[x - PANEL_X] = c;
      }
      filas[y] = f.join("");
    }
  };
  for (const r of FRAME_FILLS) pinta(r.x0, r.y0, r.x1, r.y1, "B");
  for (const s of FRAME_SEGMENTS) {
    pinta(Math.min(s.x0, s.x1), Math.min(s.y0, s.y1), Math.max(s.x0, s.x1), Math.max(s.y0, s.y1), "#");
  }
  return filas;
}

/**
 * El pane que aporta la PRIMERA scanline del hueco de la costura en la columna IZQUIERDA
 * — o sea, lo que el usuario ve justo debajo de la fecha. Es la pregunta del encargo
 * puesta en código: con la costura viva es `seamPanel`; con el historial abierto, el filo
 * prestado; y si no hubiera ninguno, el relleno azul (que es el DEFECTO).
 */
function primeraScanlineDelHueco(L: PortraitLayout): { sy: number; origen: string } {
  const p = L.panes;
  if (p.seamPanel) return { sy: p.seamPanel.sy, origen: "seamPanel" };
  if (p.panelEdge) return { sy: p.panelEdge.sy, origen: "panelEdge" };
  if (p.panelFill) return { sy: p.panelFill.sy, origen: "panelFill" };
  throw new Error("la columna izquierda no llega al fondo: no hay pane en el hueco");
}

/**
 * Lo MISMO para la ÚLTIMA scanline del hueco — «la línea blanca inferior debajo de KPIs»
 * del reporte del 03-08. El pane que manda ahí es el ÚLTIMO en pintarse que la cubra, y el
 * orden del pintor es `panelFill` → `panelEdge` → `panelEdgeBottom`.
 *
 * Devolver «quién la pinta» y no «de qué color es» es a propósito: lo que el usuario echa
 * en falta es un FILO, y un filo es un pane de cromo blanco. Si la respuesta es `panelFill`
 * (el trozo SIEMPRE-AZUL del cromo lateral) es que ahí no hay filo — que era el defecto.
 */
function ultimaScanlineDelHueco(L: PortraitLayout): { sy: number; origen: string } {
  const p = L.panes;
  const fondo = (p.panelFill ?? p.seamPanel)!;
  const y = fondo.dy + fondo.dh;
  const cubre = (q: { dy: number; dh: number } | null): boolean =>
    q !== null && q.dy + q.dh > y - 1e-6;
  if (cubre(p.panelEdgeBottom)) return { sy: p.panelEdgeBottom!.sy, origen: "panelEdgeBottom" };
  if (cubre(p.seamPanel)) return { sy: p.seamPanel!.sy + p.seamPanel!.sh - 1, origen: "seamPanel" };
  if (cubre(p.panelEdge)) return { sy: p.panelEdge!.sy, origen: "panelEdge" };
  if (cubre(p.panelFill)) return { sy: p.panelFill!.sy, origen: "panelFill" };
  throw new Error("nadie pinta la última scanline del hueco");
}

describe("filo de KPIs · 1 · el GEMELO es el gemelo (derivado del marco, no capturado)", () => {
  const cromo = cromoPanel();

  it("las 7 scanlines del divisor son IDÉNTICAS a las 7 primeras de la costura", () => {
    for (let i = 0; i < SRC_PANEL_SEAM_TWIN.sh; i++) {
      expect(
        cromo[SRC_PANEL_SEAM_TWIN.sy + i],
        `divisor y${SRC_PANEL_SEAM_TWIN.sy + i} vs costura y${KPI_BOT + i}`,
      ).toBe(cromo[KPI_BOT + i]);
    }
  });

  it("la scanline prestada ES un filo blanco de caja (no una fila cualquiera)", () => {
    // La primera del bloque: blanca de x191 a x312 y azul hasta el borde de pantalla.
    const fila = cromo[SRC_PANEL_SEAM_TWIN.sy]!;
    expect(fila.slice(0, 122)).toBe("#".repeat(122));
    expect(fila.slice(122)).toBe("B".repeat(PANEL_W - 122));
    expect(fila).toBe(cromo[KPI_BOT]);
  });

  it("la OCTAVA scanline NO es gemela — por eso el bloque son 7 y no 8", () => {
    // y63 (filo superior de KPIs) llega a x312; y87 (la «L» de la consola) a x319. El
    // renglón se deja al relleno azul en vez de inventar una línea con muesca.
    expect(cromo[SRC_PANEL_SEAM_TWIN.sy + SRC_PANEL_SEAM_TWIN.sh]).not.toBe(
      cromo[KPI_BOT + SRC_PANEL_SEAM_TWIN.sh],
    );
  });

  it("los glifos de esquina no tocan ninguna fila comparada (la omisión es lícita)", () => {
    // Celdas de glifo: filas 0..7 y 184..191. El bloque comparado va de 56 a 87.
    const tocadas = [SRC_PANEL_SEAM_TWIN.sy, KPI_BOT + ROW - 1];
    for (const y of tocadas) expect(y > 7 && y < 184).toBe(true);
  });

  it("el bloque gemelo se LEE de `PANEL_BOX_EDGES`, no se re-escribe a mano", () => {
    expect(SRC_PANEL_SEAM_TWIN.sx).toBe(PANEL_X);
    expect(SRC_PANEL_SEAM_TWIN.sw).toBe(PANEL_W);
    expect(SRC_PANEL_SEAM_TWIN.sy).toBe(PANEL_BOX_EDGES[1]);
    expect(SRC_PANEL_SEAM_TWIN.sh).toBe(PANEL_BOX_EDGES[2]! - PANEL_BOX_EDGES[1]!);
  });
});

describe("filo de KPIs · 2 · EL INVARIANTE: la columna termina en un filo", () => {
  /**
   * FAILING-FIRST. Sobre `main` (sin `panelEdge`) el caso `historial=true` cae en
   * `panelFill`, cuya `sy` es la del trozo azul del cromo lateral — que NO es un filo de
   * caja. Este `it` se pone rojo ahí, en los 5 teléfonos, y sólo ahí.
   */
  it("con y sin HISTORIAL, la primera scanline del hueco es un filo de `PANEL_BOX_EDGES`", () => {
    for (const t of TELEFONOS) {
      for (const historial of [false, true]) {
        const L = squareLayout(t.w, t.h - 340, {
          force: "reflow",
          orient: "portrait",
          consoleScrollActive: historial,
          panelBoxesFused: false,
        });
        const { sy, origen } = primeraScanlineDelHueco(L);
        expect(
          PANEL_BOX_EDGES.includes(sy),
          `${t.name} historial=${historial}: la aporta ${origen} desde la scanline ${sy}`,
        ).toBe(true);
      }
    }
  });

  it("sin historial la trae la COSTURA (el filo de verdad: no se presta nada)", () => {
    const L = squareLayout(393, 512, { force: "reflow", consoleScrollActive: false });
    expect(L.panes.seamPanel).not.toBeNull();
    expect(L.panes.panelEdge).toBeNull();
    expect(primeraScanlineDelHueco(L).sy).toBe(KPI_BOT);
  });

  it("con historial la trae el GEMELO, en el sitio EXACTO de la costura anulada", () => {
    for (const t of TELEFONOS) {
      const L = squareLayout(t.w, t.h - 340, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: true,
        panelBoxesFused: false,
      });
      const p = L.panes;
      const edge = p.panelEdge!;
      const fill = p.panelFill!;
      expect(edge, t.name).toBeTruthy();
      // Misma columna y misma anchura que el panel: es la MISMA tira, no una vecina.
      expect(edge.dx).toBeCloseTo(p.panel.dx, 6);
      expect(edge.dw).toBeCloseTo(p.panel.dw, 6);
      // Arranca justo donde arrancaría la costura y cabe DENTRO de su hueco (7 de 8).
      expect(edge.dy).toBeCloseTo(fill.dy, 6);
      expect(edge.dh).toBeCloseTo(SRC_PANEL_SEAM_TWIN.sh * L.bandScale, 6);
      expect(edge.dy + edge.dh).toBeLessThan(fill.dy + fill.dh);
      // Copia RECTA: ni estirada ni encogida (no lleva exención de isotropía).
      expect(edge.dh / edge.sh / (edge.dw / edge.sw)).toBeCloseTo(1, 9);
    }
  });
});

describe("filo de KPIs · 3 · NO se presta cuando no hay de dónde", () => {
  it("panel FUNDIDO por un overlay ⇒ `panelEdge` null (no se pinta negro sobre azul)", () => {
    for (const t of TELEFONOS) {
      const L = squareLayout(t.w, t.h - 340, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: true,
        panelBoxesFused: true,
      });
      expect(L.panes.panelEdge, t.name).toBeNull();
      // Y la columna sigue llegando al fondo con el relleno azul de la Pieza B.
      expect(L.panes.panelFill, t.name).not.toBeNull();
    }
  });

  it("la señal que lo decide es la MISMA que usa el pintor del panel", () => {
    // `panelOverlayKind` es la función que `paintFaithful` consulta para elegir rama; el
    // getter `panelBoxesFused` de la piel es `=== "full"`. Aquí se fija su tabla.
    expect(panelOverlayKind(null, null)).toBe("none");
    expect(panelOverlayKind(null, { mode: "select", page: 0, scroll: 0, cursor: 0 })).toBe("none");
    expect(panelOverlayKind(null, { mode: "page", page: 0, scroll: 0, cursor: 0 })).toBe("full");
    expect(panelOverlayKind({ phase: "select" } as never, null)).toBe("none");
    expect(panelOverlayKind({ phase: "pick" } as never, null)).toBe("full");
    // La ventana «Arms» de la TIENDA limpia sólo las filas 1..6: la caja de KPIs y su
    // divisor SIGUEN VIVOS, así que ahí sí se puede prestar.
    expect(panelOverlayKind({ phase: "pick", variant: "shop" } as never, null)).toBe("shop");
  });
});

/**
 * ═══ EL FILO DE CIERRE (reporte del usuario, 03-08) ═══════════════════════════════════
 *
 * «mira estas dos cuando se activa historial, **la línea blanca inferior debajo de KPIs
 * desaparece**». Es la OCTAVA scanline del bloque de costura (y87, la «L» de la consola),
 * la que `SRC_PANEL_SEAM_TWIN` deja fuera A PROPÓSITO —«preferimos la fila que hoy ya está
 * azul a una línea nueva con una muesca de 7 px»—. El usuario ha derogado esa preferencia.
 *
 * Lo que se sella aquí, todo DERIVADO del marco y no capturado:
 *   1. que el problema es real y de FUENTE: y87 mide 129 px de blanco y NINGÚN filo del
 *      panel llega a tanto (los tres miden 122) — o sea, no hay de dónde copiar recto;
 *   2. que la tira que se estira es blanco MACIZO (si el marco se moviera, canta aquí);
 *   3. que el bloque queda CERRADO sin hueco ni solape entre `panelEdge` y este pane;
 *   4. y el failing-first: quién pinta la última scanline con el historial abierto.
 */
describe("filo de KPIs · 3-bis · el FILO DE CIERRE del bloque (03-08)", () => {
  const cromo = cromoPanel();
  /** Longitud del tramo blanco contiguo más largo de una scanline de la columna. */
  const tiraBlanca = (y: number): number => {
    let mejor = 0;
    let run = 0;
    for (const c of cromo[y]!) {
      run = c === "#" ? run + 1 : 0;
      if (run > mejor) mejor = run;
    }
    return mejor;
  };

  it("EL PROBLEMA: y87 mide 129 px de blanco y NINGÚN filo del panel llega — no hay copia recta", () => {
    // La scanline que el historial se lleva: la «L» de la consola, de borde a borde.
    expect(tiraBlanca(KPI_BOT + ROW - 1), "y87 llega al borde de pantalla").toBe(PANEL_W);
    // Y los candidatos que SÍ sobreviven al scrollback (viven en las filas 0..79 del panel,
    // que el banner no toca) se quedan todos 7 px cortos: ésa es la «muesca».
    for (const e of PANEL_BOX_EDGES) {
      expect(tiraBlanca(e), `filo y${e}`).toBe(PANEL_W - 7);
    }
  });

  it("la tira que se estira es blanco MACIZO y está lejos de los dos extremos", () => {
    const { sx, sy, sw, sh } = SRC_PANEL_EDGE_BOTTOM;
    expect(sh, "una sola scanline").toBe(1);
    for (let i = 0; i < sw; i++) {
      expect(cromo[sy]![sx - PANEL_X + i], `x${sx + i} de la scanline ${sy}`).toBe("#");
    }
    // Holgura real a cada lado dentro del tramo macizo (que arranca en PANEL_X y mide 122).
    expect(sx - PANEL_X, "holgura por la izquierda").toBeGreaterThan(8);
    expect(PANEL_X + (PANEL_W - 7) - (sx + sw), "holgura por la derecha").toBeGreaterThan(8);
    // Y su scanline es un filo de caja de verdad, no una fila cualquiera.
    expect(PANEL_BOX_EDGES.includes(sy)).toBe(true);
  });

  it("con historial, la ÚLTIMA scanline del hueco la pinta el FILO y no el relleno azul", () => {
    for (const t of TELEFONOS) {
      const L = squareLayout(t.w, t.h - 340, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: true,
        panelBoxesFused: false,
      });
      expect(ultimaScanlineDelHueco(L).origen, t.name).toBe("panelEdgeBottom");
    }
  });

  it("sin historial la sigue trayendo la COSTURA (no se presta nada de más)", () => {
    for (const t of TELEFONOS) {
      const L = squareLayout(t.w, t.h - 340, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: false,
        panelBoxesFused: false,
      });
      expect(L.panes.panelEdgeBottom, t.name).toBeNull();
      expect(ultimaScanlineDelHueco(L).origen, t.name).toBe("seamPanel");
    }
  });

  it("EL BLOQUE QUEDA CERRADO: `panelEdge` + cierre = la costura entera, sin hueco ni solape", () => {
    for (const t of TELEFONOS) {
      const L = squareLayout(t.w, t.h - 340, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: true,
        panelBoxesFused: false,
      });
      const p = L.panes;
      const edge = p.panelEdge!;
      const cierre = p.panelEdgeBottom!;
      const fill = p.panelFill!;
      // Contiguo por arriba con el gemelo…
      expect(cierre.dy, `${t.name} contiguo al gemelo`).toBeCloseTo(edge.dy + edge.dh, 6);
      // …y cerrando por abajo el hueco EXACTO que dejaba la costura anulada.
      expect(cierre.dy + cierre.dh, `${t.name} cierra el hueco`).toBeCloseTo(
        fill.dy + fill.dh,
        6,
      );
      // Misma columna y misma anchura que el panel (no una tira vecina).
      expect(cierre.dx).toBeCloseTo(p.panel.dx, 6);
      expect(cierre.dw).toBeCloseTo(p.panel.dw, 6);
      // Y una scanline de alto: ni más ni menos que la que faltaba.
      expect(cierre.dh).toBeCloseTo(L.bandScale, 6);
    }
  });

  it("panel FUNDIDO: el cierre NO se anula — cambia de fuente a y87 (#378)", () => {
    // Hasta el 24-08: `null`, porque su única fuente era el y56 del divisor (TEXTO con
    // el overlay). #378 lo repone desde `SRC_SEAM_EDGE_BOTTOM` (flanco de y87, que
    // sobrevive en toda la clase fundida) — sin él, al subir la costura a cerrar el
    // modal la columna perdía su scanline blanca final (la clase de los reportes del
    // 02/03-08). `panelEdge` (el gemelo de 7 filas) SÍ sigue a null: eso no cambió.
    for (const t of TELEFONOS) {
      const L = squareLayout(t.w, t.h - 340, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: true,
        panelBoxesFused: true,
      });
      const cierre = L.panes.panelEdgeBottom!;
      expect(cierre, t.name).not.toBeNull();
      expect(cierre.sy, t.name).toBe(87);
      expect(cierre.sh, t.name).toBe(1);
      expect(L.panes.panelEdge, t.name).toBeNull();
      // Al fondo exacto de la columna, coplanar con el fondo del log.
      expect(cierre.dy + cierre.dh, t.name).toBeCloseTo(
        L.panes.log.dy + L.panes.log.dh,
        6,
      );
    }
  });
});

describe("filo de KPIs · 4 · las otras ramas no lo tocan", () => {
  it("APAISADO: `panelEdge` null (la costura va una sola vez, en la columna apilada)", () => {
    const L = squareLayout(844, 390, {
      force: "reflow",
      orient: "landscape",
      consoleScrollActive: true,
      panelBoxesFused: false,
    });
    expect(L.panes.panelEdge).toBeNull();
  });

  it("en los tres modos de banda azul el filo sigue pegado a SU columna", () => {
    for (const b of ["off", "izq", "full"] as const) {
      const L = squareLayout(393, 512, {
        force: "reflow",
        consoleScrollActive: true,
        panelBoxesFused: false,
        banda: b,
      });
      const e = L.panes.panelEdge!;
      expect(e.sy, b).toBe(SRC_PANEL_SEAM_TWIN.sy);
      expect(e.dx, b).toBeCloseTo(L.panes.panel.dx, 6);
      expect(e.dw, b).toBeCloseTo(L.panes.panel.dw, 6);
    }
  });
});
