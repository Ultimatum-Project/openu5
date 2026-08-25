/**
 * ★ #106 — La ventana del picker por VARIANTE, y sobre todo: (M)ix NO se recorta a 7.
 *
 * `mix_reagent_select` (CMDS.OVL 0x18be) cuenta primero los reagentes poseídos y usa esa
 * cuenta —no una constante— como tope del bucle de pintado (`18e2: mov word ptr [bp-0x14],
 * cx` … `196a: cmp si, word ptr [bp-0x14]`), sobre los 8 reagentes del juego
 * (`18da: cmp si, 8`). El cuerpo emite un flujo de líneas, sin rejilla que recortar.
 * ⇒ con los 8 en la bolsa el original los lista los 8; la ventana de 7 que el port
 * heredaba del picker de Ready escondía el último. Derivación completa en el docblock de
 * `MIX_VISIBLE_ROWS` (skin/fiel/ready.ts).
 */
import { describe, expect, it } from "vitest";
import { pickerVisibleRows } from "../src/skin/fiel/ready";

describe("#106 — filas visibles por variante del picker", () => {
  it("(M)ix cabe los OCHO reagentes, no siete", () => {
    expect(pickerVisibleRows("mix")).toBe(8);
  });

  it("las otras dos variantes NO se mueven (Ready 7 · tienda 4)", () => {
    // Controles negativos: el fix de mix no debe arrastrar a sus hermanas, que tienen
    // su propia derivación (draw_list_frame(8) @0x12ee · `cmp ax,5` @0x0d9d).
    expect(pickerVisibleRows("ready")).toBe(7);
    expect(pickerVisibleRows("shop")).toBe(4);
  });
});
