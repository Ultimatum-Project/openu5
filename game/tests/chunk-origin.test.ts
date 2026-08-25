/**
 * Origen de la ventana de chunks del overworld (g_chunk_origin) — la (V)iew-a-gem lo usa
 * como origen de su rejilla 32×32, por eso el original NO centra en el jugador (task #76 r3).
 * Deriva de MAINOUT 0x0019 (init) y 0x0354 (scroll histerético).
 */
import { describe, expect, it } from "vitest";
import { initChunkOrigin, scrollChunkOrigin, gemChunkOrigin, stepChunkOrigin } from "../src/core/world/chunk-origin.js";

describe("initChunkOrigin (MAINOUT 0x0019-0x004c)", () => {
  it("alinea a 16 hacia abajo, y corre un bloque si el party está en la mitad izquierda", () => {
    // low nibble >= 8 → origen = bloque; el jugador queda en columnas 8..15.
    expect(initChunkOrigin(0x2c, 0x2c)).toEqual({ x: 0x20, y: 0x20 }); // 0x2c&0xf=12≥8
    expect((0x2c - 0x20) & 0x1f).toBe(12); // marcador col 12 (izq del centro 16)
    // low nibble < 8 → origen = bloque-16; el jugador queda en columnas 16..23.
    expect(initChunkOrigin(0x23, 0x23)).toEqual({ x: 0x10, y: 0x10 }); // 0x23&0xf=3<8
    expect((0x23 - 0x10) & 0x1f).toBe(19); // marcador col 19 (der del centro)
  });

  it("NUNCA centra: el marcador cae en [8,23], jamás fijo en 16", () => {
    for (let p = 0; p < 256; p++) {
      const o = initChunkOrigin(p, p);
      const marker = (p - o.x) & 0x1f;
      expect(marker).toBeGreaterThanOrEqual(8);
      expect(marker).toBeLessThanOrEqual(23);
      expect(o.x % 16).toBe(0); // cuantizado a 16
    }
  });

  it("envuelve mod 256 en el borde del mundo toroidal", () => {
    // party_x=3 (low 3<8) → bloque 0, −16 → 0xF0 (240).
    expect(initChunkOrigin(0x03, 0x03)).toEqual({ x: 0xf0, y: 0xf0 });
    expect((0x03 - 0xf0) & 0x1f).toBe(19); // marcador válido en el 32
  });
});

describe("scrollChunkOrigin (MAINOUT 0x0354-0x03cb)", () => {
  it("no mueve la ventana dentro de la zona muerta (rel 5..26 en ambos ejes)", () => {
    const o = { x: 0x20, y: 0x20 };
    // party en el centro del 32 (rel 16,16) → sin scroll.
    expect(scrollChunkOrigin(o, 0x30, 0x30, 1, 0)).toEqual(o);
  });

  it("corre ±16 en la dirección del paso al salir de la zona muerta", () => {
    const o = { x: 0x20, y: 0x20 };
    // party llega al borde derecho (rel_x = 27 > 26) moviéndose al este → ventana +16 en x.
    expect(scrollChunkOrigin(o, 0x20 + 27, 0x30, 1, 0)).toEqual({ x: 0x30, y: 0x20 });
    // party al borde izquierdo (rel_x = 4 < 5) moviéndose al oeste → ventana −16 en x.
    expect(scrollChunkOrigin(o, 0x20 + 4, 0x30, -1, 0)).toEqual({ x: 0x10, y: 0x20 });
  });

  it("mantiene el invariante init tras un paso simple (init y scroll concuerdan)", () => {
    // Entrar en (0x2c,0x2c) e ir 1 al este: el origen no debe saltar (sigue en zona muerta).
    let o = initChunkOrigin(0x2c, 0x2c); // {0x20,0x20}, rel 12
    o = scrollChunkOrigin(o, 0x2d, 0x2c, 1, 0); // rel_x 13, dead zone → sin cambio
    expect(o).toEqual({ x: 0x20, y: 0x20 });
  });
});

describe("gemChunkOrigin — origen para la (V)iew-a-gem (mantenido si fresco, si no re-derivado)", () => {
  it("sin origen mantenido → fórmula de entrada", () => {
    expect(gemChunkOrigin(undefined, 0x2c, 0x2c)).toEqual(initChunkOrigin(0x2c, 0x2c));
  });
  it("origen FRESCO (party dentro de la ventana 32) → se usa el mantenido", () => {
    const kept = { x: 0x30, y: 0x30 };
    expect(gemChunkOrigin(kept, 0x3a, 0x3a)).toBe(kept); // rel 10, dentro
  });
  it("origen STALE (party fuera de la ventana, tras teleport) → re-deriva", () => {
    const stale = { x: 0x30, y: 0x30 };
    // Party saltó a 0x80: (0x80−0x30)&0xff=0x50>31 → stale → initChunkOrigin(0x80).
    expect(gemChunkOrigin(stale, 0x80, 0x80)).toEqual(initChunkOrigin(0x80, 0x80));
  });
});

describe("stepChunkOrigin — mantenimiento histerético por-paso", () => {
  it("pasos continuos que CRUZAN la zona muerta corren el origen +16", () => {
    // Entrada en (0x2c,0x2c) → origen {0x20,0x20}. Caminar al ESTE hasta salir de [5,26]:
    // rel_x llega a 27 en x=0x3b (0x3b−0x20=27) → scroll +16 → {0x30,0x20}.
    let o: { x: number; y: number } | undefined = initChunkOrigin(0x2c, 0x2c);
    for (let x = 0x2d; x <= 0x3b; x++) o = stepChunkOrigin(o, x, 0x2c, 1, 0);
    expect(o).toEqual({ x: 0x30, y: 0x20 }); // corrió un bloque al este
    expect((0x3b - o!.x) & 0x1f).toBe(11); // el party vuelve al centro de la ventana
  });
  it("re-deriva si el origen previo estaba stale (salto no-continuo antes del paso)", () => {
    // origen stale {0x30,0x30}; el party está en 0x80 y da un paso al este → pre-paso 0x80
    // fuera de la ventana → re-init(0x80) y luego scroll de este paso.
    const o = stepChunkOrigin({ x: 0x30, y: 0x30 }, 0x81, 0x80, 1, 0);
    const base = initChunkOrigin(0x80, 0x80);
    expect(o).toEqual(scrollChunkOrigin(base, 0x81, 0x80, 1, 0));
  });
});
