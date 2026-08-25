import { describe, it, expect } from "vitest";
import { mountFaceTile, faceTile } from "../src/core/world/transport.js";

/**
 * GIRO DE SPRITE de caballo y alfombra — `transport_face` MAINOUT.OVL 0x00da (ramas
 * 0x010a caballo / 0x0130 alfombra), repetido instrucción a instrucción por
 * `town_transport_face` TOWN.OVL 0x057c en 0x05a9/0x05cb.
 *
 * El binario compara SÓLO dos direcciones y deja el tile intacto en las otras dos:
 *   0111: cmp [bp+4],1 → mov [g_transport_tile],0x12   (alfombra 0x0137 → 0x14)
 *   011e: cmp [bp+4],3 → mov [g_transport_tile],0x13   (alfombra 0x0144 → 0x15)
 *   0129: sigue SIN tocar el tile
 */
describe("mountFaceTile — caballo y alfombra tienen SÓLO dos sprites (E y O)", () => {
  it("caballo: ESTE escribe 0x12 y OESTE escribe 0x13 (0x0117 / 0x0124)", () => {
    expect(mountFaceTile(0x12, "east")).toBe(0x12);
    expect(mountFaceTile(0x13, "east")).toBe(0x12);
    expect(mountFaceTile(0x12, "west")).toBe(0x13);
    expect(mountFaceTile(0x13, "west")).toBe(0x13);
  });

  it("alfombra: ESTE escribe 0x14 y OESTE escribe 0x15 (0x013d / 0x014a)", () => {
    expect(mountFaceTile(0x14, "east")).toBe(0x14);
    expect(mountFaceTile(0x15, "east")).toBe(0x14);
    expect(mountFaceTile(0x14, "west")).toBe(0x15);
    expect(mountFaceTile(0x15, "west")).toBe(0x15);
  });

  it("★ NORTE y SUR dejan el tile INTACTO — la mitad fina (caen al jmp 0x129)", () => {
    for (const t of [0x12, 0x13]) {
      expect(mountFaceTile(t, "north")).toBe(t);
      expect(mountFaceTile(t, "south")).toBe(t);
    }
    for (const t of [0x14, 0x15]) {
      expect(mountFaceTile(t, "north")).toBe(t);
      expect(mountFaceTile(t, "south")).toBe(t);
    }
  });

  it("NO aplica la fórmula naval: (tile&0xFC)+facing es de los BARCOS, no del caballo", () => {
    // Si el caballo usara la fórmula de barcos, ESTE daría 0x11 (base+1). Da 0x12.
    expect(faceTile(0x12, "east")).toBe(0x11); // lo que haría la fórmula naval
    expect(mountFaceTile(0x12, "east")).toBe(0x12); // lo que hace el binario
    // Y el SUR naval daría 0x12; el caballo no toca nada.
    expect(faceTile(0x13, "south")).toBe(0x12);
    expect(mountFaceTile(0x13, "south")).toBe(0x13);
  });

  it("clases NO montadas (a pie, barco, esquife) no las toca", () => {
    for (const t of [0x1c, 0x1d, 0x20, 0x24, 0x28]) {
      for (const d of ["north", "east", "south", "west"] as const) {
        expect(mountFaceTile(t, d)).toBe(t);
      }
    }
  });
});
