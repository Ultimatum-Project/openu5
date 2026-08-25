/**
 * EL COMPOSER DEL LAYOUT PARTIDO CON UNA FUENTE DE MAYOR RESOLUCIÓN (LOTE C).
 *
 * La geometría juega a favor y ése es todo el truco: el backbuffer de la shader es
 * `SCREEN_W·S × SCREEN_H·S` (`shaderCanvasSize`), o sea el MISMO layout 320×200
 * multiplicado por un entero. Así que alojar una piel filtrada se reduce a multiplicar los
 * rects FUENTE de cada `drawImage` por S. Lo que este fichero fija:
 *
 *  1. `hostedSrcScale` — el criterio de escala, en aritmética y sobre el censo real de
 *     teléfonos. La aserción que carga el criterio del usuario («el mapa se suaviza DE
 *     VERDAD») es que en TODO el censo sale ≥ 2: a ×1 el pase xBR no suaviza nada, que es
 *     exactamente lo que medía el diagnóstico con el host 0×0.
 *  2. `blit` multiplica la FUENTE y no el destino (invertirlo daría una imagen recortada
 *     que en una captura pequeña podría pasar por buena).
 *  3. NO-REGRESIÓN de la fiel: con `srcScale` 1 los rects salen idénticos y el suavizado
 *     sigue APAGADO. Es la mitad que protege lo que ya funcionaba.
 */
import { describe, expect, it } from "vitest";
import {
  HOSTED_SRC_SCALE_CAP,
  PortraitSkin,
  hostedSrcScale,
} from "../src/skin/portrait/skin.js";
import { squareLayout } from "../src/skin/portrait/layout-cuadrado.js";
import type { Pane, PortraitLayout } from "../src/skin/portrait/layout.js";

/** Censo del `portrait-cuadrado`: hueco REAL (ya sin botonera) y dpr acotado a [1,3]. */
const CENSO = [
  { name: "iPhone SE", availW: 375, availH: 330, k: 2 },
  { name: "iPhone 15", availW: 393, availH: 384, k: 3 },
  { name: "Pixel 7", availW: 412, availH: 420, k: 3 },
  { name: "iPhone 15 Pro Max", availW: 430, availH: 430, k: 3 },
];

function layoutDe(availW: number, availH: number): PortraitLayout {
  return squareLayout(availW, availH, {
    consoleScrollActive: false,
    force: "reflow",
    orient: "portrait",
  });
}

describe("hostedSrcScale — la escala que el anfitrión pide al alojado", () => {
  it("en TODO el censo sale ≥ 2 ⇒ la shader alojada SUAVIZA de verdad (no colapsa a ×1)", () => {
    for (const d of CENSO) {
      const s = hostedSrcScale(layoutDe(d.availW, d.availH), d.k);
      expect(s, `${d.name}: escala ${s}`).toBeGreaterThanOrEqual(2);
      expect(s).toBeLessThanOrEqual(HOSTED_SRC_SCALE_CAP);
    }
  });

  it("NINGUNA región se REDUCE con la escala elegida (el criterio, comprobado pane a pane)", () => {
    for (const d of CENSO) {
      const L = layoutDe(d.availW, d.availH);
      const s = hostedSrcScale(L, d.k);
      if (L.kind !== "reflow") continue;
      for (const [nombre, p] of Object.entries(L.panes)) {
        if (!p) continue;
        const q = p as Pane;
        // Factor resultante = destino(dispositivo) ÷ fuente(a ×s). Debe ser ≥ 1.
        expect((q.dw * d.k) / (q.sw * s), `${d.name}/${nombre} eje X`).toBeGreaterThanOrEqual(1);
        expect((q.dh * d.k) / (q.sh * s), `${d.name}/${nombre} eje Y`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("es MONÓTONA en el dpr y respeta el tope (una escala libre reventaría la memoria)", () => {
    const L = layoutDe(393, 384);
    expect(hostedSrcScale(L, 1)).toBeLessThanOrEqual(hostedSrcScale(L, 2));
    expect(hostedSrcScale(L, 2)).toBeLessThanOrEqual(hostedSrcScale(L, 3));
    expect(hostedSrcScale(L, 99)).toBe(HOSTED_SRC_SCALE_CAP);
    expect(hostedSrcScale(L, 99, 2)).toBe(2);
  });

  it("nunca baja de 1 (un 0 dejaría el `drawImage` con fuente vacía)", () => {
    expect(hostedSrcScale(layoutDe(393, 384), 0)).toBe(1);
  });
});

// ── El blit ────────────────────────────────────────────────────────────────────────────

interface Draw {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  smooth: boolean;
}

/** ctx de mentira que anota cada `drawImage` con el estado del suavizado en ese momento. */
function ctxEspia(w: number, h: number): { ctx: CanvasRenderingContext2D; draws: Draw[] } {
  const draws: Draw[] = [];
  let smooth = false;
  const ctx = {
    canvas: { width: w, height: h },
    fillStyle: "",
    get imageSmoothingEnabled(): boolean {
      return smooth;
    },
    set imageSmoothingEnabled(v: boolean) {
      smooth = v;
    },
    fillRect: () => {},
    drawImage: (
      _src: unknown,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ) => {
      draws.push({ sx, sy, sw, sh, dx, dy, dw, dh, smooth });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, draws };
}

/**
 * Corre un `present()` real con la fuente a escala `s`. Los campos privados se siembran
 * por índice — el mismo recurso que usa `skin-lifecycle` (TS `private` es de compilación).
 * `panes.frame` se anula a propósito para saltar `paintSeparators`, que lee píxeles.
 */
function presentCon(s: number, L: PortraitLayout): Draw[] {
  const skin = new PortraitSkin("cuadrado");
  const priv = skin as unknown as Record<string, unknown>;
  const { ctx, draws } = ctxEspia(1000, 1400);
  priv.ctx = ctx;
  priv.srcCanvas = {};
  priv.layout = L;
  priv.srcScale = s;
  priv.dpr = 1;
  priv.presentForce = true;
  priv.lastSeamActive = false;
  priv.hosted = {
    id: "espia",
    sourceFrameGen: 7,
    consoleScrollActive: false,
    panelListOpen: false,
  };
  (priv.present as () => void).call(skin);
  return draws;
}

describe("PortraitSkin.blit — la FUENTE se multiplica por la escala del alojado", () => {
  const L = layoutDe(393, 384);
  if (L.kind !== "reflow") throw new Error("el fixture debe ser reflow");
  const panes = L.panes;

  it("con la fiel (escala 1) los rects son los de siempre y el suavizado sigue APAGADO", () => {
    const draws = presentCon(1, L);
    expect(draws.length).toBeGreaterThan(0);
    const box = draws.find((d) => d.sw === panes.box.sw && d.sy === panes.box.sy * 1);
    expect(box).toBeDefined();
    expect([box!.sx, box!.sy, box!.sw, box!.sh]).toEqual([
      panes.box.sx,
      panes.box.sy,
      panes.box.sw,
      panes.box.sh,
    ]);
    expect(draws.every((d) => d.smooth === false)).toBe(true);
  });

  it("con la shader a ×3 CADA rect fuente va ×3 y el DESTINO no se mueve un píxel", () => {
    const uno = presentCon(1, L);
    const tres = presentCon(3, L);
    expect(tres.length).toBe(uno.length);
    for (let i = 0; i < uno.length; i++) {
      const a = uno[i]!;
      const b = tres[i]!;
      expect([b.sx, b.sy, b.sw, b.sh], `blit #${i} fuente`).toEqual([
        a.sx * 3,
        a.sy * 3,
        a.sw * 3,
        a.sh * 3,
      ]);
      // Si se hubiera escalado el DESTINO en vez de la fuente, la imagen saldría
      // recortada — y en una captura de teléfono podría pasar por buena.
      expect([b.dx, b.dy, b.dw, b.dh], `blit #${i} destino`).toEqual([a.dx, a.dy, a.dw, a.dh]);
    }
  });

  it("el suavizado se enciende SÓLO en la región que reduce (bypass), nunca en las que amplían", () => {
    // `dpr` 1 y escala 4: los panes amplían (factor ≥ 1) pero `full` —el letterbox del
    // BYPASS de pantalla completa del endgame— reduce, y ahí nearest haría picadillo.
    const draws = presentCon(4, L);
    for (const d of draws) {
      const reduce = d.dw < d.sw || d.dh < d.sh;
      expect(d.smooth, `dst ${d.dw}x${d.dh} ← src ${d.sw}x${d.sh}`).toBe(reduce);
    }
  });

  it("BYPASS clásico: un solo blit, y con escala > 1 reduce ⇒ suavizado ENCENDIDO", () => {
    const clasico = { ...L, kind: "clasico" as const };
    const draws = presentCon(4, clasico as unknown as PortraitLayout);
    expect(draws.length).toBe(1);
    expect(draws[0]!.sw).toBe(L.full.sw * 4);
    expect(draws[0]!.smooth).toBe(true);
  });
});
