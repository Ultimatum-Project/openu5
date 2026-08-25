/**
 * Animación del AGUA (`render/waterfn32.ts`, calco de `fn32` del EGA.DRV @0x1fe6-0x23b7).
 * Verifica el SCROLL vertical circular (mecanismo B), la máscara de canal por plano-3
 * (mecanismo C) y el composite por píxel, más la exclusión del ciclo-de-id en tileanim.
 */
import { describe, expect, it } from "vitest";
import {
  WATER_SCROLL_TILES,
  WATER_SOURCE_TILE,
  WATER_COMPOSITE_MASKS,
  channelMaskFromTile,
  compositeChannel,
  isWaterScrollTile,
  isWaterCompositeTile,
  bakedWaterTileOrder,
  scrollRowsDown,
} from "../src/render/waterfn32.js";
import { buildAnimGroups, animatedFrame } from "../src/render/tileanim.js";

const W = 16;

/** Tile 16×16 RGBA cuyo canal R codifica el nº de fila (para rastrear el scroll). */
function rowTaggedTile(): Uint8ClampedArray {
  const a = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      a[o] = y;
      a[o + 3] = 255;
    }
  return a;
}

describe("scrollRowsDown — scroll vertical circular (mecanismo B)", () => {
  it("offset 0 es identidad", () => {
    const base = rowTaggedTile();
    const out = new Uint8ClampedArray(W * W * 4);
    scrollRowsDown(base, 0, out);
    expect(Array.from(out)).toEqual(Array.from(base));
  });

  it("offset 1 mueve el contenido 1 fila hacia abajo (fila 15 -> fila 0)", () => {
    const base = rowTaggedTile();
    const out = new Uint8ClampedArray(W * W * 4);
    scrollRowsDown(base, 1, out);
    // fila 0 muestra el contenido de la vieja fila 15
    expect(out[(0 * W + 3) * 4]).toBe(15);
    // fila 5 muestra el contenido de la vieja fila 4
    expect(out[(5 * W + 3) * 4]).toBe(4);
  });

  it("offset 16 vuelve al original (periodo 16)", () => {
    const base = rowTaggedTile();
    const out = new Uint8ClampedArray(W * W * 4);
    scrollRowsDown(base, 16, out);
    expect(Array.from(out)).toEqual(Array.from(base));
  });

  it("es determinista (sin RNG): mismo offset -> mismo resultado", () => {
    const base = rowTaggedTile();
    const a = new Uint8ClampedArray(W * W * 4);
    const b = new Uint8ClampedArray(W * W * 4);
    scrollRowsDown(base, 7, a);
    scrollRowsDown(base, 7, b);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe("channelMaskFromTile — plano-3 (intensidad) = canal (mecanismo C)", () => {
  it("bit de intensidad a 1 -> canal (1); a 0 -> orilla (0)", () => {
    // mitad izq = color índice 9 [0x55,0x55,0xff] (bit3=1); der = índice 1 [0,0,0xaa] (bit3=0).
    const t = new Uint8ClampedArray(W * W * 4);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const bright = x < 8;
        t[o] = bright ? 0x55 : 0x00;
        t[o + 1] = bright ? 0x55 : 0x00;
        t[o + 2] = bright ? 0xff : 0xaa;
        t[o + 3] = 255;
      }
    const mask = channelMaskFromTile(t);
    expect(mask[0 * W + 3]).toBe(1); // izq brillante = canal
    expect(mask[0 * W + 12]).toBe(0); // der oscuro = orilla
  });
});

describe("compositeChannel — select por píxel agua/orilla", () => {
  it("out[p] = mask ? water : bank", () => {
    const bank = new Uint8ClampedArray(W * W * 4).fill(10);
    const water = new Uint8ClampedArray(W * W * 4).fill(200);
    const mask = new Uint8Array(W * W);
    mask[5] = 1; // solo el píxel 5 es canal
    const out = new Uint8ClampedArray(W * W * 4);
    compositeChannel(bank, water, mask, out);
    expect(out[5 * 4]).toBe(200); // canal -> agua
    expect(out[6 * 4]).toBe(10); // orilla -> bank
  });
});

describe("catálogo de tiles de agua", () => {
  it("scroll = 0x01/0x02/0x03/0x8f", () => {
    expect([...WATER_SCROLL_TILES].sort((a, b) => a - b)).toEqual([
      0x01, 0x02, 0x03, 0x8f,
    ]);
    expect(isWaterScrollTile(0x01)).toBe(true);
    expect(isWaterScrollTile(0x00)).toBe(false);
    expect(WATER_SOURCE_TILE).toBe(0x03);
  });

  it("composite cubre ríos 0x60-0x6f, costa 0x34-0x37, esquinas 0xe4-0xe7", () => {
    expect(WATER_COMPOSITE_MASKS.size).toBe(24);
    expect(WATER_COMPOSITE_MASKS.get(0x60)).toBe(0x70); // río -> máscara 0x70
    expect(WATER_COMPOSITE_MASKS.get(0x6f)).toBe(0x7f);
    expect(WATER_COMPOSITE_MASKS.get(0x34)).toBe(0xd0); // costa -> 0xd0
    expect(WATER_COMPOSITE_MASKS.get(0xe4)).toBe(0xd0); // esquina -> 0xd0
    expect(isWaterCompositeTile(0x6a)).toBe(true); // TrollBridge tambien fluye
    expect(isWaterCompositeTile(0x05)).toBe(false);
  });
});

describe("tileanim: el agua de scroll NO cicla por id (corrige el mar)", () => {
  it("0x01 y 0x02 no forman grupo de ciclo (los anima el scroll fn32)", () => {
    const groups = buildAnimGroups();
    expect(groups[0x01]).toBeNull();
    expect(groups[0x02]).toBeNull();
    // una celda 0x01 se queda en 0x01 en cualquier fase (no muta a 0x02)
    expect(animatedFrame(0x01, 3, groups)).toBe(0x01);
    expect(animatedFrame(0x02, 7, groups)).toBe(0x02);
  });

  it("la cascada 0xd4-d7 SÍ sigue ciclando (reloj maestro, intacto)", () => {
    const groups = buildAnimGroups();
    expect(groups[0xd4]).not.toBeNull();
    expect(animatedFrame(0xd4, 2, groups)).toBe(0xd5); // divisor 2: fase 2 -> +1 frame
  });
});

describe("bakedWaterTileOrder: filas del atlas xBRZ pre-horneado (water-look)", () => {
  it("es el set de agua DEDUPLICADO y ORDENADO (casa con bake_water_xbrz.py)", () => {
    // MISMO orden que `sorted(set(scroll + composite))` del horneador. Si esto cambia,
    // el atlas se re-hornea o la piel blitea la fila equivocada.
    const order = bakedWaterTileOrder();
    const expected = [
      0x01, 0x02, 0x03, 0x34, 0x35, 0x36, 0x37, 0x60, 0x61, 0x62, 0x63, 0x64,
      0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x8f,
      0xe4, 0xe5, 0xe6, 0xe7,
    ];
    expect([...order]).toEqual(expected);
  });

  it("incluye todo scroll + composite, sin duplicados, ascendente", () => {
    const order = bakedWaterTileOrder();
    for (const t of WATER_SCROLL_TILES) expect(order).toContain(t);
    for (const t of WATER_COMPOSITE_MASKS.keys()) expect(order).toContain(t);
    expect(new Set(order).size).toBe(order.length);
    expect([...order]).toEqual([...order].sort((a, b) => a - b));
  });
});
