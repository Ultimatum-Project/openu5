/**
 * RE-FLOW VERTICAL — banco de medición y guardas del descriptor (PURO).
 *
 * Lo que impone este fichero:
 *   1. INVARIANTE DURO: la ventana lógica sigue siendo 11×11. El re-flow gana PÍXELES
 *      POR TILE, jamás tiles (`VIEW_WINDOW` es contrato, espejado en el censurado de
 *      LOS/luz del core: tocarlo sería divergencia L0, no L3).
 *   2. Los rects FUENTE salen del marco fiel y cubren las 4 bandas de HUD del visor
 *      (sol/lunas, ►L8◄, vientos, ►Dir:◄): sin ellas desaparecerían EN SILENCIO.
 *   3. «NUNCA PEOR» por construcción: `portraitLayout` elige el layout que da MÁS área
 *      jugable; el umbral cerrado predice el mismo signo que la comparación de áreas.
 *   4. La inversa del hit-test devuelve la MISMA celda que la fórmula de la fiel, en las
 *      tres regiones, ida y vuelta.
 */
import { describe, expect, it } from "vitest";
import { VIEW_HALF, VIEW_WINDOW } from "../src/skin/api.js";
import { SCREEN_H, SCREEN_W, VIEWPORT } from "../src/skin/fiel/frame.js";
import { CONSOLE_RECT } from "../src/skin/fiel/skin.js";
import {
  BAND_SRC_H,
  BAND_SRC_W,
  PLAYABLE_SIDE,
  SB_CAP,
  SRC_BOX,
  SRC_LOG,
  SRC_PANEL,
  SRC_SEAM,
  SRC_SKY,
  SRC_WINDS,
  classicFitScale,
  portraitLayout,
  reflowBandScale,
  reflowMapScale,
  reflowWins,
} from "../src/skin/portrait/layout.js";
import {
  cellInWindow,
  cellOf,
  paneContains,
  paneToSource,
  portraitHitTest,
} from "../src/skin/portrait/hittest.js";

/** Teléfonos verticales del censo (CSS px) + el hueco de la botonera medido. */
const PHONES = [
  { name: "iPhone SE", w: 375, h: 667 },
  { name: "Galaxy S8", w: 360, h: 740 },
  { name: "iPhone 15", w: 393, h: 852 },
  { name: "Pixel 7", w: 412, h: 915 },
  { name: "iPhone 15 Pro Max", w: 430, h: 932 },
  { name: "iPad mini", w: 744, h: 1133 },
  { name: 'iPad Pro 12,9"', w: 1024, h: 1366 },
] as const;
const DECK_PX = 326;

describe("re-flow vertical — invariante de la ventana lógica", () => {
  it("la ventana de juego sigue siendo 11×11 (contrato, no parámetro de piel)", () => {
    expect(VIEW_WINDOW).toBe(11);
    expect(VIEW_HALF).toBe(5);
    expect(VIEWPORT.tiles).toBe(VIEW_WINDOW);
    expect(PLAYABLE_SIDE).toBe(VIEWPORT.tiles * VIEWPORT.tile);
  });

  it("la rejilla del hit-test es la MISMA fórmula que la fiel (celdas 0..10)", () => {
    for (let col = 0; col < VIEW_WINDOW; col++) {
      for (let row = 0; row < VIEW_WINDOW; row++) {
        const px = VIEWPORT.x + col * VIEWPORT.tile + 0.5;
        const py = VIEWPORT.y + row * VIEWPORT.tile + 0.5;
        expect(cellOf(px, py)).toEqual({ col, row });
        expect(cellInWindow(col, row)).toBe(true);
      }
    }
    expect(cellInWindow(-1, 0)).toBe(false);
    expect(cellInWindow(0, VIEW_WINDOW)).toBe(false);
  });
});

describe("re-flow vertical — rects fuente derivados del marco fiel", () => {
  it("el bloque de mapa cubre las filas 0 y 23 DEL MARCO (bandas de HUD)", () => {
    // Fila 0 = sol + fases lunares + ►L8◄ · fila 23 = ►East Winds◄ + ►Dir:◄.
    expect(SRC_SKY.sy).toBe(0);
    expect(SRC_SKY.sh).toBe(8);
    expect(SRC_WINDS.sy).toBe(184); // fila 23 · 8 px = 184
    expect(SRC_WINDS.sh).toBe(8);
    // Ambas a lo ANCHO de la caja del visor (x7..184), no del interior.
    expect(SRC_SKY.sx).toBe(SRC_BOX.sx);
    expect(SRC_SKY.sw).toBe(SRC_BOX.sw);
    expect(SRC_WINDS.sw).toBe(SRC_BOX.sw);
  });

  it("la caja del visor es (7,7)-(184,184) = 178×178 con sus dos filos", () => {
    expect(SRC_BOX).toEqual({ sx: 7, sy: 7, sw: 178, sh: 178 });
    // Y el interior 11×11 cae DENTRO con margen de 1 px por lado.
    expect(SRC_BOX.sx + 1).toBe(VIEWPORT.x);
    expect(SRC_BOX.sw - 2).toBe(PLAYABLE_SIDE);
  });

  it("panel/costura/log arrancan en x=191 (el filo izquierdo se pinta AHÍ, no en 192)", () => {
    for (const r of [SRC_PANEL, SRC_SEAM, SRC_LOG]) {
      expect(r.sx).toBe(191);
      expect(r.sw).toBe(129);
      expect(r.sx + r.sw).toBe(SCREEN_W);
    }
  });

  it("el troceado del panel es contiguo y cubre la consola exacta (filas 11..23)", () => {
    expect(SRC_PANEL.sy + SRC_PANEL.sh).toBe(SRC_SEAM.sy); // 80
    expect(SRC_SEAM.sy + SRC_SEAM.sh).toBe(SRC_LOG.sy); // 88
    expect(SRC_LOG.sy).toBe(CONSOLE_RECT.topRow * 8);
    expect(SRC_LOG.sy + SRC_LOG.sh).toBe((CONSOLE_RECT.botRow + 1) * 8);
    expect(BAND_SRC_W).toBe(2 * SRC_LOG.sw);
    expect(BAND_SRC_H).toBe(SRC_SEAM.sh + SRC_LOG.sh);
  });

  it("consume ≥90 % de la fuente y descarta sólo cromo inútil en vertical", () => {
    const used =
      SRC_BOX.sw * (SCREEN_H - 8) + // bloque de mapa: scanlines y0..y191
      (SRC_PANEL.sw * SRC_PANEL.sh + SRC_SEAM.sw * SRC_SEAM.sh + SRC_LOG.sw * SRC_LOG.sh);
    expect(used / (SCREEN_W * SCREEN_H)).toBeGreaterThan(0.9);
  });
});

describe("re-flow vertical — geometría del destino", () => {
  const L = portraitLayout(393, 852 - DECK_PX, 1, { force: "reflow" });

  it("la pila es contigua y el mapeo de scanlines es 1:1 (y7/y184 compartidas)", () => {
    const p = L.panes;
    const ky = p.box.dh / p.box.sh; // px de destino por scanline lógica
    expect(p.sky.dy).toBe(0);
    // La caja arranca en la scanline 7, que es la ÚLTIMA del cielo: el solape se resuelve
    // por ORDEN de pintado (caja → cielo → vientos), como el fillRect del original.
    expect(p.box.dy).toBeCloseTo(7 * ky, 6);
    expect(p.box.dy + p.box.dh).toBeCloseTo(185 * ky, 6);
    expect(p.winds.dy).toBeCloseTo(184 * ky, 6);
    expect(p.winds.dy + p.winds.dh).toBeCloseTo(p.panel.dy, 6);
    expect(p.panel.dy).toBeCloseTo(p.seamLog.dy, 6);
    expect(p.log.dy).toBeCloseTo(p.seamLog.dy + p.seamLog.dh, 6);
  });

  it("mapa a TODO el ancho y las dos columnas de la banda lado a lado", () => {
    const p = L.panes;
    // El reparto del alto (reflowBandScale) da a la banda lo máximo que deja al mapa
    // limitado por el ANCHO ⇒ el mapa ocupa el ancho ENTERO del canvas.
    expect(p.box.dw).toBeCloseTo(L.canvasW, 6);
    expect(p.panel.dw).toBeCloseTo(p.log.dw, 6);
    expect(p.log.dx).toBeCloseTo(p.panel.dx + p.panel.dw, 6);
    expect(p.panel.dx + 2 * p.panel.dw).toBeLessThanOrEqual(L.canvasW + 1e-6);
  });

  it("el log NO se degrada: su pitch de glifo ≥ el del layout clásico", () => {
    for (const d of PHONES) {
      const Hav = d.h - DECK_PX;
      const R = portraitLayout(d.w, Hav, 1, { force: "reflow" });
      const pitchReflow = (R.panes.log.dh / R.panes.log.sh) * 8;
      const pitchClasico = classicFitScale(d.w, Hav, 1) * 8;
      // Único caso en que baja adrede: el cap de banda en TABLET (a favor del mapa).
      if (R.bandScale < SB_CAP) expect(pitchReflow).toBeGreaterThanOrEqual(pitchClasico - 1e-6);
      else expect(pitchReflow).toBeLessThanOrEqual(16 + 1e-6);
    }
  });

  it("todo el contenido cabe en el canvas (nada se sale ni se recorta)", () => {
    for (const p of [
      L.panes.sky,
      L.panes.box,
      L.panes.winds,
      L.panes.panel,
      L.panes.log,
      L.panes.seamLog,
      L.full,
    ]) {
      expect(p.dx).toBeGreaterThanOrEqual(-1e-6);
      expect(p.dy).toBeGreaterThanOrEqual(-1e-6);
      expect(p.dx + p.dw).toBeLessThanOrEqual(L.canvasW + 1e-6);
      expect(p.dy + p.dh).toBeLessThanOrEqual(L.canvasH + 1e-6);
    }
  });

  it("aspecto uniforme por pane: el estirado vertical es el MISMO en los tres del mapa", () => {
    const ratio = (p: { dh: number; sh: number; dw: number; sw: number }): number =>
      p.dh / p.sh / (p.dw / p.sw);
    expect(ratio(L.panes.sky)).toBeCloseTo(1, 6);
    expect(ratio(L.panes.box)).toBeCloseTo(1, 6);
    expect(ratio(L.panes.winds)).toBeCloseTo(1, 6);
  });

  it("el 4:3 de época estira SÓLO en vertical (px 1:1,2), en los tres panes por igual", () => {
    const A = portraitLayout(393, 852 - DECK_PX, 1.2, { force: "reflow" });
    for (const p of [A.panes.sky, A.panes.box, A.panes.winds, A.panes.panel, A.panes.log]) {
      expect(p.dh / p.sh / (p.dw / p.sw)).toBeCloseTo(1.2, 6);
    }
  });

  it("roster y log comparten pitch de glifo (si no, chirría)", () => {
    expect(L.panes.panel.dw / L.panes.panel.sw).toBeCloseTo(L.panes.log.dw / L.panes.log.sw, 6);
    expect(L.panes.panel.dh / L.panes.panel.sh).toBeCloseTo(L.panes.log.dh / L.panes.log.sh, 6);
  });

  it("la costura de la fila 10 se ENRUTA por el scrollback (§3.2)", () => {
    const normal = portraitLayout(393, 526, 1, { force: "reflow", consoleScrollActive: false });
    expect(normal.panes.seamPanel).not.toBeNull();
    expect(normal.panes.seamPanel!.dx).toBeCloseTo(normal.panes.panel.dx, 6);
    const scrolled = portraitLayout(393, 526, 1, { force: "reflow", consoleScrollActive: true });
    // Con historial abierto la fila 10 es el banner ►HISTORY◄: pertenece a la CONSOLA.
    expect(scrolled.panes.seamPanel).toBeNull();
    expect(scrolled.panes.seamLog.dx).toBeCloseTo(scrolled.panes.log.dx, 6);
    // El resto de la geometría no se mueve un píxel al enrutar la costura.
    expect(scrolled.panes.box).toEqual(normal.panes.box);
    expect(scrolled.panes.log).toEqual(normal.panes.log);
  });

  it("el pitch de la banda está capado (tablet: la banda no roba el alto del mapa)", () => {
    const tablet = portraitLayout(1024, 1040, 1, { force: "reflow" });
    expect(tablet.bandScale).toBe(SB_CAP);
    expect((tablet.panes.log.dh / tablet.panes.log.sh) * 8).toBeLessThanOrEqual(16 * 1.0 + 1e-6);
    expect(reflowBandScale(4000, 4000)).toBe(SB_CAP);
  });
});

describe("re-flow vertical — decisión honesta («nunca peor»)", () => {
  it("elige siempre el layout con MÁS área jugable", () => {
    for (const d of PHONES) {
      for (const deck of [DECK_PX, 266]) {
        for (const a of [1.0, 1.2]) {
          const L = portraitLayout(d.w, d.h - deck, a);
          expect(L.playableArea).toBeGreaterThanOrEqual(L.classicPlayableArea - 1e-6);
          expect(L.kind).toBe(reflowWins(d.w, d.h - deck, a) ? "reflow" : "clasico");
        }
      }
    }
  });

  it("el umbral cerrado predice el mismo signo en las 42 combinaciones medidas", () => {
    let n = 0;
    for (const d of PHONES) {
      for (const deck of [326, 266, 0]) {
        for (const a of [1.0, 1.2]) {
          const Hav = d.h - deck;
          const sb = reflowBandScale(d.w, Hav, a);
          // En vertical el clásico es SIEMPRE width-limited (Hav > 0,625·a·W): premisa
          // del umbral, comprobada aquí para no colar un caso fuera de dominio.
          expect(Hav / (SCREEN_H * a)).toBeGreaterThan(d.w / SCREEN_W);
          const mapHeightLimited = (Hav - BAND_SRC_H * sb * a) / (MAP_BLOCK * a) < d.w / 178;
          // Mapa limitado por ANCHO ⇒ gana siempre (W/178 > W/320 ≥ escala clásica).
          // Mapa limitado por ALTO  ⇒ gana ⟺ Hav > a·(0,6·W + 104·sb).
          const closed =
            !mapHeightLimited || Hav > a * ((MAP_BLOCK / SCREEN_W) * d.w + BAND_SRC_H * sb);
          expect(reflowWins(d.w, Hav, a)).toBe(closed);
          n++;
        }
      }
    }
    expect(n).toBe(42);
  });

  it("con hueco degenerado (banda más alta que la pantalla) cae a clásico sin romper", () => {
    const L = portraitLayout(393, 40, 1);
    expect(L.kind).toBe("clasico");
    expect(L.mapScale).toBeLessThan(L.classicScale);
    expect(Number.isFinite(L.canvasW)).toBe(true);
    const Z = portraitLayout(0, 0, 1);
    expect(Z.kind).toBe("clasico");
    expect(Z.mapScale).toBe(0);
    expect(Z.playableArea).toBe(0);
  });

  it("`force` salta la decisión en los dos sentidos (para medir y capturar)", () => {
    expect(portraitLayout(375, 341, 1, { force: "reflow" }).kind).toBe("reflow");
    expect(portraitLayout(412, 915, 1, { force: "clasico" }).kind).toBe("clasico");
  });

  it("en el hueco donde gana, gana de verdad: escala del mapa > escala clásica", () => {
    const Hav = 915 - DECK_PX; // Pixel 7 con la botonera puesta
    const sb = reflowBandScale(412, Hav, 1);
    expect(reflowMapScale(412, Hav, 1, sb)).toBeGreaterThan(classicFitScale(412, Hav, 1));
  });
});

describe("re-flow vertical — hit-test inverso, ida y vuelta", () => {
  const L = portraitLayout(412, 915 - DECK_PX, 1, { force: "reflow" });

  it("el centro de cada celda del visor vuelve a SU celda (121 de 121)", () => {
    const p = L.panes.box;
    let ok = 0;
    for (let col = 0; col < VIEW_WINDOW; col++) {
      for (let row = 0; row < VIEW_WINDOW; row++) {
        // Ida: celda → px lógico → px de destino.
        const lx = VIEWPORT.x + (col + 0.5) * VIEWPORT.tile;
        const ly = VIEWPORT.y + (row + 0.5) * VIEWPORT.tile;
        const dx = p.dx + ((lx - p.sx) / p.sw) * p.dw;
        const dy = p.dy + ((ly - p.sy) / p.sh) * p.dh;
        const hit = portraitHitTest(L, dx, dy);
        if (hit?.region === "map" && hit.col === col && hit.row === row) ok++;
      }
    }
    expect(ok).toBe(VIEW_WINDOW * VIEW_WINDOW);
  });

  it("las bandas de HUD NO son mapa (un tap en el sol no camina)", () => {
    const sky = portraitHitTest(L, L.canvasW / 2, 1);
    expect(sky?.region).toBe("sky");
    const winds = portraitHitTest(L, L.canvasW / 2, L.panes.winds.dy + L.panes.winds.dh - 1);
    expect(winds?.region).toBe("winds");
  });

  it("la columna del log devuelve px lógicos DENTRO de CONSOLE_RECT", () => {
    const p = L.panes.log;
    const hit = portraitHitTest(L, p.dx + p.dw / 2, p.dy + p.dh / 2);
    expect(hit?.region).toBe("log");
    expect(hit!.px).toBeGreaterThanOrEqual(CONSOLE_RECT.leftCol * 8);
    expect(hit!.py).toBeGreaterThanOrEqual(CONSOLE_RECT.topRow * 8);
    expect(hit!.py).toBeLessThan((CONSOLE_RECT.botRow + 1) * 8);
  });

  it("la columna del roster devuelve región panel con px lógicos del panel", () => {
    const p = L.panes.panel;
    const hit = portraitHitTest(L, p.dx + p.dw / 2, p.dy + p.dh / 2);
    expect(hit?.region).toBe("panel");
    expect(hit!.px).toBeGreaterThan(191);
    expect(hit!.py).toBeLessThan(80);
  });

  it("fuera del canvas no hay hit; el modo clásico usa la transformada uniforme", () => {
    expect(portraitHitTest(L, -5, -5)).toBeNull();
    const C = portraitLayout(375, 667 - DECK_PX, 1, { force: "clasico" });
    const f = C.full;
    const lx = VIEWPORT.x + 5.5 * VIEWPORT.tile;
    const ly = VIEWPORT.y + 5.5 * VIEWPORT.tile;
    const hit = portraitHitTest(C, f.dx + (lx / SCREEN_W) * f.dw, f.dy + (ly / SCREEN_H) * f.dh);
    expect(hit).toMatchObject({ region: "map", col: 5, row: 5 });
  });

  it("`paneContains`/`paneToSource` son inversas exactas en los bordes del pane", () => {
    const p = L.panes.box;
    expect(paneContains(p, p.dx, p.dy)).toBe(true);
    expect(paneContains(p, p.dx + p.dw, p.dy)).toBe(false);
    expect(paneToSource(p, p.dx, p.dy)).toEqual({ px: p.sx, py: p.sy });
    const mid = paneToSource(p, p.dx + p.dw / 2, p.dy + p.dh / 2);
    expect(mid.px).toBeCloseTo(p.sx + p.sw / 2, 6);
    expect(mid.py).toBeCloseTo(p.sy + p.sh / 2, 6);
  });
});

/** Alto del bloque de mapa en la fuente (y0..y191) — para el umbral cerrado. */
const MAP_BLOCK = SCREEN_H - 8;
