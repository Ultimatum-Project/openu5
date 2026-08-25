/**
 * CORTINA NEGRA DEL TWEEN — SELLO DEL CABLEADO (ficha #34).
 *
 * `shader-motion.test.ts` sella el MODELO PURO (`anchoredFogSlideShowsBlack`). Este fichero
 * sella lo que se PINTA: ejecuta el método REAL `ShaderSkin.paintAnchoredFogSlide` contra un
 * mini-rasterizador que implementa sólo las primitivas de canvas que ese método usa (fillRect
 * con `source-over`/`destination-out`, un `rect`+`clip`, save/restore, clearRect) y compara,
 * celda a celda, el ALFA resultante con el veredicto del modelo. Sin esto la lógica queda
 * sellada y el cableado no: un punzado en el orden equivocado, o con el offset equivocado,
 * pasaría los tests del modelo y seguiría pintando la cortina en la cara del usuario.
 *
 * El mini-raster NO replica la composición (eso es el código bajo prueba): replica el CANVAS.
 * Se muestrea el CENTRO de cada celda de pantalla — el mismo punto que el modelo usa
 * (`cx = col + 0.5`) — con `cell = 8 px`, que hace enteros todos los offsets de t ∈ {0, ¼, ½, ¾, 1}.
 */
import { describe, expect, it } from "vitest";
import { ShaderSkin } from "../src/skin/shader/skin.js";
import {
  anchoredFogSlideShowsBlack,
  carriedGlowMask,
  emitterGlowMask,
  freshLitMask,
  persistentLitMask,
} from "../src/skin/shader/motion.js";
import { computeRadiusMask } from "../src/core/world/visibility.js";

/** Unión de dos máscaras (la que arma `ShaderSkin.anchoredHoles` para el punzado anclado). */
function orMask(a: Uint8Array, b: Uint8Array): Uint8Array {
  const o = new Uint8Array(a.length);
  for (let i = 0; i < o.length; i++) o[i] = a[i] === 1 || b[i] === 1 ? 1 : 0;
  return o;
}


const W = 11;
const CELL = 8;
const SIZE = W * CELL;

/** Rasterizador mínimo: sólo las primitivas de canvas 2D que usa `paintAnchoredFogSlide`. */
class MiniRaster {
  readonly alpha = new Uint8Array(SIZE * SIZE);
  globalCompositeOperation = "source-over";
  fillStyle = "";
  imageSmoothingEnabled = true;
  private clipRect: [number, number, number, number] = [0, 0, SIZE, SIZE];
  private readonly stack: [number, number, number, number][] = [];
  private pending: [number, number, number, number] | null = null;

  setTransform(): void {}
  save(): void {
    this.stack.push([...this.clipRect] as [number, number, number, number]);
  }
  restore(): void {
    const c = this.stack.pop();
    if (c) this.clipRect = c;
  }
  beginPath(): void {
    this.pending = null;
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.pending = [x, y, w, h];
  }
  clip(): void {
    if (!this.pending) return;
    const [px, py, pw, ph] = this.pending;
    const [cx, cy, cw, ch] = this.clipRect;
    const x0 = Math.max(px, cx);
    const y0 = Math.max(py, cy);
    const x1 = Math.min(px + pw, cx + cw);
    const y1 = Math.min(py + ph, cy + ch);
    this.clipRect = [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.paint(x, y, w, h, 0);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.paint(x, y, w, h, this.globalCompositeOperation === "destination-out" ? 0 : 1);
  }
  drawImage(): void {}

  private paint(x: number, y: number, w: number, h: number, v: number): void {
    const [cx, cy, cw, ch] = this.clipRect;
    const x0 = Math.max(0, Math.round(Math.max(x, cx)));
    const y0 = Math.max(0, Math.round(Math.max(y, cy)));
    const x1 = Math.min(SIZE, Math.round(Math.min(x + w, cx + cw)));
    const y1 = Math.min(SIZE, Math.round(Math.min(y + h, cy + ch)));
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) this.alpha[py * SIZE + px] = v;
  }
  /** ¿La celda de PANTALLA (col,row) queda NEGRA? Se muestrea su centro, como el modelo. */
  blackAt(col: number, row: number): boolean {
    return this.alpha[(row * CELL + CELL / 2) * SIZE + (col * CELL + CELL / 2)] === 1;
  }
}

/** Pinta un frame de tween con el método REAL y devuelve las celdas negras, con nombre. */
function pintadasNegras(
  visMask0: Uint8Array,
  visRadius0: Uint8Array,
  visMask1: Uint8Array,
  visRadius1: Uint8Array,
  dx: number,
  dy: number,
  t: number,
): string[] {
  const skin = new ShaderSkin() as unknown as Record<string, unknown>;
  const raster = new MiniRaster();
  skin.fogCtx = raster;
  skin.fogCanvas = {};
  const paint = skin.paintAnchoredFogSlide as (...a: unknown[]) => void;
  paint.call(
    skin,
    { save() {}, beginPath() {}, rect() {}, clip() {}, drawImage() {}, restore() {} },
    emitterGlowMask(visMask0, visRadius0),
    // 🔴 Los MISMOS argumentos que arma `skin.ts` (filo delantero, 08-08): sólo desliza el halo
    // que el campo viejo también veía, y la luz NUEVA del paso va con el punzado ANCLADO.
    // Si esta llamada se queda con las máscaras viejas, el harness compara el pintado de AYER
    // contra el modelo de HOY y el rojo acusa al modelo — que es lo que pasó al escribirlo.
    carriedGlowMask(emitterGlowMask(visMask1, visRadius1), visMask0, dx, dy, W),
    visRadius1,
    // Gate de la LUZ SALIENTE que sobrevive al paso (22-08): `visMask1` CRUDO, no su halo de
    // emisor — la casilla del anillo del disco sigue visible y `emitterGlowMask` la excluiría.
    // Ver `survivingGlowMask` (motion.ts) y el paso (4) de `paintAnchoredFogSlide`.
    visMask1,
    orMask(persistentLitMask(visMask0, visMask1), freshLitMask(visMask0, visMask1, dx, dy, W)),
    { x: 0, y: 0, size: SIZE },
    SIZE,
    { t, dx, dy },
  );
  const out: string[] = [];
  for (let row = 0; row < W; row++)
    for (let col = 0; col < W; col++) if (raster.blackAt(col, row)) out.push(`${col},${row}`);
  return out;
}

/** El mismo censo, según el MODELO puro. */
function modeloNegras(
  visMask0: Uint8Array,
  visRadius0: Uint8Array,
  visMask1: Uint8Array,
  visRadius1: Uint8Array,
  dx: number,
  dy: number,
  t: number,
): string[] {
  const out: string[] = [];
  for (let row = 0; row < W; row++)
    for (let col = 0; col < W; col++)
      if (
        anchoredFogSlideShowsBlack({
          visMask0,
          visRadius0,
          visMask1,
          visRadius1,
          window: W,
          dx,
          dy,
          t,
          col,
          row,
        })
      )
        out.push(`${col},${row}`);
  return out;
}

describe("capa anclada del tween: lo PINTADO coincide con el modelo (ficha #34)", () => {
  const DIRS: [string, number, number][] = [
    ["Este", 1, 0],
    ["Oeste", -1, 0],
    ["Sur", 0, 1],
    ["Norte", 0, -1],
  ];
  const TS = [0, 0.25, 0.5, 0.75, 1];
  const disc = computeRadiusMask(2);
  const lit = new Uint8Array(W * W).fill(1);
  const mitad = new Uint8Array(W * W);
  for (let row = 0; row < W; row++) for (let col = 0; col <= 4; col++) mitad[row * W + col] = 1;

  const ESCENAS: [string, Uint8Array, Uint8Array][] = [
    ["sala entera iluminada (el testigo de #34)", lit, lit],
    ["noche cerrada, sólo el disco de la party", disc, disc],
    ["sala a medias (mitad oeste iluminada)", mitad, mitad],
    ["la sala se apaga con el paso (V0 la veía, V1 no)", lit, mitad],
  ];

  it("las CUATRO direcciones, todo t, cuatro escenas: el alfa pintado == el veredicto del modelo", () => {
    for (const [escena, vm0, vm1] of ESCENAS) {
      for (const [nombre, dx, dy] of DIRS) {
        for (const t of TS) {
          expect(
            pintadasNegras(vm0, disc, vm1, disc, dx, dy, t),
            `${escena} · ${nombre} · t=${t}`,
          ).toEqual(modeloNegras(vm0, disc, vm1, disc, dx, dy, t));
        }
      }
    }
  });

  it("sala ENTERA iluminada: el render no pinta NINGUNA celda negra en ningún t ni dirección", () => {
    for (const [nombre, dx, dy] of DIRS)
      for (const t of TS)
        expect(pintadasNegras(lit, disc, lit, disc, dx, dy, t), `${nombre} t=${t}`).toEqual([]);
  });

  it("🔴 BORDE DE SALIDA cableado: el halo que abandona la ventana por detrás NO se apaga de golpe", () => {
    // Reporte del usuario (07-08): «detrás, las tiles que se van ocultando no lo hacen suave».
    // Escena por dirección: un emisor DETRÁS cuyo halo llega a la fila/columna trasera antes
    // del paso y ya no llega después. Es la familia que el gate de `outgoingGatedMaskV0`
    // apagaba entera en el primer fotograma. Se comprueba sobre lo PINTADO (mini-raster), no
    // sólo sobre el modelo: el arreglo vive en `motion.ts` pero quien lo pinta es `skin.ts`.
    const halo = (hc: number, hr: number, rad: number): Uint8Array => {
      const m = new Uint8Array(W * W);
      for (let row = 0; row < W; row++)
        for (let col = 0; col < W; col++) {
          const ddx = col - hc;
          const ddy = row - hr;
          if (ddx * ddx + ddy * ddy <= rad * rad) m[row * W + col] = 1;
        }
      return m;
    };
    const or = (a: Uint8Array, b: Uint8Array): Uint8Array => {
      const o = new Uint8Array(a.length);
      for (let i = 0; i < o.length; i++) o[i] = a[i] === 1 || b[i] === 1 ? 1 : 0;
      return o;
    };
    for (const [nombre, dx, dy] of DIRS) {
      const at: [number, number] = dx !== 0 ? [dx > 0 ? -3 : 13, 5] : [5, dy > 0 ? -3 : 13];
      const vm0 = or(disc, halo(at[0], at[1], 3));
      const vm1 = or(disc, halo(at[0] - dx, at[1] - dy, 3));
      // La celda del borde trasero que el halo iluminaba y que ya no tiene contraparte.
      const [bc, br] = dx !== 0 ? [dx > 0 ? 0 : W - 1, 5] : [5, dy > 0 ? 0 : W - 1];
      expect(vm0[br * W + bc], `${nombre}: la escena debe partir de esa celda ILUMINADA`).toBe(1);
      expect(vm1[br * W + bc], `${nombre}: y APAGADA tras el paso (si no, no prueba nada)`).toBe(0);
      // En t=0 y t=0.25 (franja saliente viva) el render NO la pinta negra.
      for (const t of [0, 0.25]) {
        expect(pintadasNegras(vm0, disc, vm1, disc, dx, dy, t), `${nombre} t=${t}`).not.toContain(
          `${bc},${br}`,
        );
      }
      // En el ASENTAMIENTO sí (V1 manda): el arreglo no mueve t=1.
      expect(pintadasNegras(vm0, disc, vm1, disc, dx, dy, 1), `${nombre} t=1`).toContain(
        `${bc},${br}`,
      );
    }
  });

  it("CONTROL NEGATIVO del render (noche cerrada): las 112 celdas de fuera del disco siguen negras ∀t ∀dirección", () => {
    const fuera: string[] = [];
    for (let row = 0; row < W; row++)
      for (let col = 0; col < W; col++) if (disc[row * W + col] === 0) fuera.push(`${col},${row}`);
    expect(fuera.length).toBe(112); // control con dientes
    for (const [nombre, dx, dy] of DIRS)
      for (const t of TS)
        expect(pintadasNegras(disc, disc, disc, disc, dx, dy, t), `${nombre} t=${t}`).toEqual(fuera);
  });
});
