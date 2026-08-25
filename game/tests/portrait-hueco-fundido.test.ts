/**
 * EL ESTIRADO NO PUEDE PARTIR LA LISTA DE UN OVERLAY — ficha #244 (reporte del usuario
 * 13-08, capturas use-hueco-5-6-…{B02B573C,2A718188}).
 *
 * EL DEFECTO. La columna izquierda del portrait cuadrado crece 24 scanlines (directriz
 * del usuario 01-08: alargar la caja de JUGADORES y bajar los KPIs con ella), y el punto
 * de inserción es la frontera fuente y55|y56 = el filo inferior de esa caja. Ahí partir
 * es inobservable **mientras el panel sea el panel**: la caja mide seis filas de texto
 * exactas (y8..55) y debajo sólo hay cromo. Con un overlay abierto —`panelBoxesFused`:
 * picker de Use/Ready/Mix, páginas de Ztats— y56 ya no es un filo, es TEXTO, y las 24
 * réplicas se ven como TRES renglones de hueco negro en mitad de la lista.
 *
 * MEDIDO EN VIVO el 13-08 (WebKit/iPhone 390×844@3, canvas 1170×1696, bandScale 1,456
 * ⇒ 34,95 px de dispositivo por renglón), picker de «Use item» con los 8 pergaminos:
 *   · ANTES — filas visibles 1-5 en y1277/1312/1347/1382/1417 (paso 35) y la 6ª en
 *     y1556: Δ = 139 px = 3,98 pasos, o sea TRES renglones de hueco, con cualquier
 *     selección (el usuario lo fotografió con el cursor en la 5ª y en la 6ª).
 *   · DESPUÉS — las siete filas a paso constante 35 px, y la 5ª→6ª a 35 exactos.
 * Las 24 réplicas pasan a ser RELLENO AZUL bajo el panel entero (la Pieza B del 27-07,
 * color uniforme ⇒ estirado inobservable), que es el único sitio donde no parten nada:
 * la clase FUNDIDA no tiene ninguna scanline interior segura en común (Ready/Use llena
 * y16..71, Mix llena y16..79 sin ventana, y las páginas de Ztats lo que haga falta).
 *
 * QUÉ SE ASIERTA AQUÍ, y por qué en el DESCRIPTOR y no en píxeles: la distancia entre
 * dos scanlines FUENTE consecutivas (y55 y y56) medida en el DESTINO es exactamente lo
 * que el usuario ve como «paso de línea», y sale de los rects sin navegador. Los dos
 * regímenes se barren juntos —fundido y no fundido— porque el defecto es que uno herede
 * la geometría del otro. El MUTANTE (abajo) reconstruye el destino de antes del fix y
 * tiene que dar 25 scanlines: sin él, un layout que ignorase `panelBoxesFused` pasaría
 * el aserto de la altura total igual (los 112 cuadran en las dos ramas — por eso la
 * altura sola no es guarda de este defecto).
 *
 * FUERA DE LA PUERTA de la batería mientras la lista de vitest se adjudique (ficha #221).
 */
import { describe, expect, it } from "vitest";
import { MODAL_STRETCH_Y, squareLayout } from "../src/skin/portrait/layout-cuadrado.js";
import {
  BAND_SRC_H,
  PANEL_H,
  PANEL_STRETCH_ROWS,
  ROSTER_BOX_BOT,
  ROW,
  type Pane,
  type PortraitPanes,
} from "../src/skin/portrait/layout.js";

/** iPhone 15 vertical en px CSS, con el hueco que deja la botonera (el del reporte). */
const HUECO = { w: 390, h: 504 };

function panesDe(fused: boolean, scroll = false): PortraitPanes {
  const L = squareLayout(HUECO.w, HUECO.h, {
    force: "reflow",
    orient: "portrait",
    consoleScrollActive: scroll,
    panelBoxesFused: fused,
  });
  if (L.kind !== "reflow") throw new Error("no cayó en re-flow");
  return L.panes;
}

/**
 * Escala de la banda leída del propio descriptor (1 scanline fuente → px de destino).
 * 🔴 DEL PANE DEL **LOG**, no del panel: desde #380 la columna del modal va ESTIRADA
 * (×14/11) con el panel fundido — derivar `sb` del panel devolvería la escala ya
 * estirada y los asertos del estirado se calcularían desde el sujeto (tautología).
 * El log no se estira en ningún régimen: es la vara neutra.
 */
function sbDe(fused: boolean): number {
  const p = panesDe(fused);
  return p.log.dh / p.log.sh;
}

/**
 * DÓNDE cae en el destino la scanline FUENTE `sy` de la columna del panel. Se busca el
 * pane que la contiene en vez de suponerlo: es justo la suposición que el defecto rompe.
 */
function destinoDe(p: PortraitPanes, sy: number): number {
  const candidatos: (Pane | null)[] = [p.panel, p.panelBottom];
  for (const c of candidatos) {
    if (c && sy >= c.sy && sy < c.sy + c.sh) return c.dy + (sy - c.sy) * (c.dh / c.sh);
  }
  throw new Error(`ninguna caja del panel cubre la scanline fuente ${sy}`);
}

describe("el estirado y la lista de un overlay (#244)", () => {
  it("panel FUNDIDO: y55 y y56 quedan CONTIGUAS — un renglón, no cuatro", () => {
    const p = panesDe(true);
    const sb = sbDe(true);
    // Es la distancia fila5→fila6 del picker: sus filas de contenido caen en y16..71,
    // así que la frontera y55|y56 es exactamente el corte entre la 5ª y la 6ª.
    // Desde #380 el renglón del MODAL mide su scanline ESTIRADA (sb·14/11): contiguo
    // sigue queriendo decir UNA scanline — la del bloque, no la del log.
    const paso = destinoDe(p, ROSTER_BOX_BOT) - destinoDe(p, ROSTER_BOX_BOT - 1);
    expect(paso).toBeCloseTo(sb * MODAL_STRETCH_Y, 6);
    expect(MODAL_STRETCH_Y).toBeCloseTo(14 / 11, 12); // en crudo: 112/88

    // MUTANTE — el destino de ANTES del fix #244 (estirado insertado en y56 también con
    // el panel fundido): la misma frontera se abre a 1 + 24 scanlines = los tres
    // renglones de hueco que fotografió el usuario.
    const antes = 1 + PANEL_STRETCH_ROWS;
    expect(paso).not.toBeCloseTo(antes * sb, 6);
    expect(antes).toBe(25);
  });

  it("panel NORMAL: el estirado del 01-08 SIGUE ahí (no se arregla quitándolo)", () => {
    // La caja de jugadores tiene que seguir creciendo 24 scanlines y los KPIs bajando
    // con ella: es la directriz del usuario, y el remedio de #244 sólo la exceptúa
    // cuando un overlay funde el panel.
    const p = panesDe(false);
    const sb = sbDe(false);
    expect(p.panelStretch).not.toBeNull();
    expect(p.panelStretch!.dh).toBeCloseTo(PANEL_STRETCH_ROWS * sb, 6);
    expect(destinoDe(p, ROSTER_BOX_BOT) - destinoDe(p, ROSTER_BOX_BOT - 1)).toBeCloseTo(
      (1 + PANEL_STRETCH_ROWS) * sb,
      6,
    );
  });

  it("con overlay NO hay cromo estirado NI azul: el modal estirado llena la columna — #380", () => {
    const p = panesDe(true);
    const sb = sbDe(true);
    const my = sb * MODAL_STRETCH_Y; // px de destino por scanline del bloque del modal
    expect(p.panelStretch).toBeNull();
    // #380: el azul de 24 filas del reporte use-item-alto-2 DESAPARECE — el bloque de
    // 88 scanlines de 1988 estirado 14/11 mide 112 = la columna entera, sin resto.
    expect(p.panelFill).toBeNull();
    // La costura sigue PEGADA al panel (#378: fila 10 tras la 9, el orden del original)…
    expect(p.seamPanel).not.toBeNull();
    expect(p.seamPanel!.dy).toBeCloseTo(destinoDe(p, PANEL_H - 1) + my, 6);
    // …y su borde inferior cae en el FONDO exacto de la columna (= fondo del log).
    expect(p.seamPanel!.dy + p.seamPanel!.dh).toBeCloseTo(p.log.dy + p.log.dh, 6);

    // MUTANTES — las dos geometrías anteriores, EN CRUDO:
    //   · #378 (modal sin estirar, azul de 24·sb debajo): la costura acababa antes del fondo;
    //   · pre-#378 (azul entre lista y costura): el borde ↕ a 24 filas de la lista.
    expect(p.seamPanel!.dy + p.seamPanel!.dh).not.toBeCloseTo(
      p.log.dy + p.log.dh - PANEL_STRETCH_ROWS * sb,
      6,
    );
    expect(p.seamPanel!.dy).not.toBeCloseTo(
      destinoDe(p, PANEL_H - 1) + (1 + PANEL_STRETCH_ROWS) * sb,
      6,
    );
  });

  it("#378: la columna del log NO ve el borde ↕ del overlay — sustituto azul + filo", () => {
    // Con el picker abierto la fila fuente 10 lleva su indicador ►↕◄: es del MODAL.
    // `seamLog` la bliteaba también en el techo del log y el rombo salía DOS veces
    // (una en el borde del modal y otra pisando la cabecera del log — la captura
    // use-item-alto-flechas). El pintor tapa esa copia con el sustituto declarado.
    const p = panesDe(true);
    const sb = sbDe(true);
    expect(p.seamLogFill).not.toBeNull();
    expect(p.seamLogEdge).not.toBeNull();
    // Mismo rect de destino que `seamLog` (fill 7 filas + filo 1 = las 8 de la costura).
    expect(p.seamLogFill!.dx).toBeCloseTo(p.seamLog.dx, 6);
    expect(p.seamLogFill!.dw).toBeCloseTo(p.seamLog.dw, 6);
    expect(p.seamLogFill!.dy).toBeCloseTo(p.seamLog.dy, 6);
    expect(p.seamLogFill!.dh).toBeCloseTo((ROW - 1) * sb, 6);
    expect(p.seamLogEdge!.dy).toBeCloseTo(p.seamLog.dy + (ROW - 1) * sb, 6);
    expect(p.seamLogEdge!.dh).toBeCloseTo(sb, 6);
    // El filo repuesto es la scanline y87 (filo superior de la consola), EN CRUDO.
    expect(p.seamLogEdge!.sy).toBe(87);
    expect(p.seamLogEdge!.sh).toBe(1);

    // CONTROL de los otros dos regímenes: sin overlay no hay nada que tapar, y con el
    // historial el banner es contenido legítimo del log (la fila vuelve a ser suya).
    expect(panesDe(false).seamLogFill).toBeNull();
    expect(panesDe(false).seamLogEdge).toBeNull();
    expect(panesDe(true, true).seamLogFill).toBeNull();
    expect(panesDe(true, true).seamLogEdge).toBeNull();
  });

  it("overlay + historial: el relleno es el RESTO tras el modal estirado (112/11 filas)", () => {
    // Con el scrollback la fila 10 es del banner: la costura se anula y el modal
    // visible son 80 filas AL MISMO factor 14/11 (el bloque no cambia de tamaño al
    // abrir el historial). El resto queda en azul, en UN pane: 112 − 80·14/11 =
    // 112/11 ≈ 10,18 filas — en crudo, no derivado del sujeto.
    const p = panesDe(true, true);
    const sb = sbDe(true);
    expect(p.seamPanel).toBeNull();
    expect(p.panelFill).not.toBeNull();
    expect(p.panelFill!.dh).toBeCloseTo((112 / 11) * sb, 6);
    // Y cubre EXACTO desde el fondo del panel hasta el fondo del log.
    expect(p.panelFill!.dy).toBeCloseTo(destinoDe(p, PANEL_H - 1) + sb * MODAL_STRETCH_Y, 6);
    expect(p.panelFill!.dy + p.panelFill!.dh).toBeCloseTo(p.log.dy + p.log.dh, 6);
  });

  it("#380: el estirado del modal es 14/11 EN Y y SÓLO en Y — exención declarada", () => {
    // La columna del modal aprovecha el alto ESCALANDO el bloque de 1988 — con factor
    // FRACCIONAL, como el mapa de esta piel (sa = W/FRAME_W), no un múltiplo entero.
    // El eje X no se toca: la única dimensión con hueco es el alto (ensanchar robaría
    // escala al log — su suelo — o re-fluiría el deck bajo el dedo). Es una exención
    // DECLARADA del invariante de isotropía del cuadrado, acotada al estado FUNDIDO
    // de la rama VERTICAL; la guarda de isotropía general (portrait-cuadrado.test.ts)
    // sigue barriendo el estado sin fundir.
    const p = panesDe(true);
    const sb = sbDe(true);
    for (const [nombre, pane] of [
      ["panel", p.panel],
      ["panelBottom", p.panelBottom!],
      ["seamPanel", p.seamPanel!],
    ] as const) {
      expect(pane.dh / pane.sh, `${nombre}: escala Y estirada`).toBeCloseTo(
        sb * MODAL_STRETCH_Y,
        6,
      );
      expect(pane.dw / pane.sw, `${nombre}: escala X intacta`).toBeCloseTo(sb, 6);
    }
    // Y sin fundir, isotropía plena (el control del mismo barrido):
    const q = panesDe(false);
    for (const pane of [q.panel, q.panelBottom!, q.seamPanel!]) {
      expect(pane.dh / pane.sh).toBeCloseTo(pane.dw / pane.sw, 6);
    }
  });

  it("#380: en APAISADO el modal NO se estira (la columna única no tiene hueco)", () => {
    const L = squareLayout(852, 393, {
      force: "reflow",
      orient: "landscape",
      panelBoxesFused: true,
    });
    if (L.kind !== "reflow") throw new Error("no cayó en re-flow");
    const p = L.panes;
    // Columna apilada del original: panel + costura + log contiguos, todos a la misma
    // escala — la fila 10 va una vez y en su sitio.
    const sb = p.log.dh / p.log.sh;
    expect(p.panel.dh / p.panel.sh).toBeCloseTo(sb, 6);
    expect(p.seamLog.dh / p.seamLog.sh).toBeCloseTo(sb, 6);
  });

  it("LA COLUMNA SIGUE CUADRANDO en los cuatro regímenes — 112 = BAND_SRC_H", () => {
    // Lo que el estirado existe para dar: que la columna del panel llegue al fondo del
    // log. Retirar la superficie que compensa destaparía justo esto, así que se asevera
    // en las dos ramas y con/sin historial (la memoria retirar-la-superficie).
    for (const fused of [false, true]) {
      for (const scroll of [false, true]) {
        const p = panesDe(fused, scroll);
        const sb = sbDe(fused);
        const bandY = p.panel.dy;
        const fondoLog = p.log.dy + p.log.dh;
        const ultimo = [p.seamPanel, p.panelFill, p.panelEdgeBottom, p.panelBottom]
          .filter((x): x is Pane => x !== null)
          .reduce((m, x) => Math.max(m, x.dy + x.dh), 0);
        expect(ultimo - bandY).toBeCloseTo(BAND_SRC_H * sb, 6);
        expect(ultimo).toBeCloseTo(fondoLog, 6);
      }
    }
  });
});
