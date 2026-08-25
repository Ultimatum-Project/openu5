/**
 * #283 — VENTANA «GUEST REGISTER» de la posada (`SHOPPES3.OVL:0x052a-0x06c7`).
 *
 * ORDEN HONESTO: aquí NO hubo failing-first — se derivó del binario, se implementó y
 * luego se selló; el sustituto es la MUTACIÓN, y las cuatro van listadas en
 * `re/notes/inn-register-283-acta.md` §6 con qué caso mata a cada una.
 *
 * Los esperados van EN CRUDO (números y códigos de glifo literales, no recalculados
 * desde el sujeto): si `layoutInnRegister` cambiara la geometría, el aserto tiene que
 * enrojecer — no seguirle la corriente.
 */
import { describe, it, expect } from "vitest";
import {
  INN_REGISTER_RECT,
  INN_REGISTER_VISIBLE_NAMES,
  innRegisterBarY,
  layoutInnRegister,
} from "../src/skin/fiel/innRegister.js";
import {
  initInnRegister,
  innRegisterKey,
} from "../src/core/shops/innRegisterPicker.js";

/** Lee la celda (fila, col) de la rejilla como código de glifo. */
function cell(cells: Uint8Array, cols: number, row: number, col: number): number {
  return cells[row * cols + col]!;
}
/** Lee una fila entera como texto (para carear cabeceras verbatim). */
function rowText(cells: Uint8Array, cols: number, row: number): string {
  let s = "";
  for (let c = 0; c < cols; c++) s += String.fromCharCode(cell(cells, cols, row, c));
  return s;
}

describe("#283 · geometría de la ventana REGISTER", () => {
  it("el descriptor es cols 24..38 × filas 1..9 — el `set_text_window(1,0x18,1,0x26,9)` de 0x0530", () => {
    expect(INN_REGISTER_RECT).toEqual({ leftCol: 24, topRow: 1, rightCol: 38, botRow: 9 });
  });

  it("el marco lleva los glifos 0x10/0x11/0x13/0x17/0x14/0x15/0x16 en 15×9", () => {
    const l = layoutInnRegister({ guests: [], cursor: 0 });
    expect([l.cols, l.rows]).toEqual([15, 9]);
    // Fila 0 (0x0565-0x057e): ┌ + TRECE 0x11 + ┐. El 13 es el `mov [bp-0x2c],0xd`.
    expect(cell(l.cells, l.cols, 0, 0)).toBe(0x10);
    expect(cell(l.cells, l.cols, 0, 14)).toBe(0x13);
    const top: number[] = [];
    for (let c = 1; c <= 13; c++) top.push(cell(l.cells, l.cols, 0, c));
    expect(top).toEqual([
      0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11,
    ]);
    // Filas 1..7 (bucle `si=1..7` de 0x0588): barras en col 0 y col 14, y SÓLO ahí.
    for (let r = 1; r <= 7; r++) {
      expect(cell(l.cells, l.cols, r, 0)).toBe(0x17);
      expect(cell(l.cells, l.cols, r, 14)).toBe(0x17);
    }
    // Fila 8 (0x05b5-0x05d2): └ + TRECE 0x15 + ┘ — el horizontal INFERIOR es 0x15, no 0x11.
    expect(cell(l.cells, l.cols, 8, 0)).toBe(0x14);
    expect(cell(l.cells, l.cols, 8, 7)).toBe(0x15);
    expect(cell(l.cells, l.cols, 8, 14)).toBe(0x16);
  });

  it("las cabeceras van VERBATIM en (col 1, fila 1) y (col 1, fila 2), con la fila 3 en blanco", () => {
    const l = layoutInnRegister({ guests: [], cursor: 0 });
    // DS 0x4fc0 `    GUEST` desde la col 1 ⇒ «GUEST» ocupa las cols 5..9.
    expect(rowText(l.cells, l.cols, 1)).toBe("    GUEST    ");
    // DS 0x4fca `  REGISTER:` desde la col 1 ⇒ «REGISTER:» en las cols 3..11.
    expect(rowText(l.cells, l.cols, 2)).toBe("  REGISTER:  ");
    // El `\n\n` de la cadena deja la 3 vacía y el cursor en la 4 (§3 del módulo).
    expect(rowText(l.cells, l.cols, 3)).toBe("             ");
  });

  it("los nombres arrancan en la col 4 / fila 4 — `gotoxy(4, fila)` de 0x0610", () => {
    const l = layoutInnRegister({ guests: ["Iolo", "Shamino"], cursor: 0 });
    expect(rowText(l.cells, l.cols, 4)).toBe("   Iolo      ");
    expect(rowText(l.cells, l.cols, 5)).toBe("   Shamino   ");
  });
});

describe("#283 · barra XOR de selección", () => {
  it("el primer huésped cae en y=40 — el literal `mov di,0x28` de 0x0643", () => {
    expect(innRegisterBarY(0)).toBe(40);
  });

  it("cada salto de huésped mueve la barra 8 px (`sub di,8` / `add di,8`)", () => {
    expect(innRegisterBarY(1)).toBe(48);
    expect(innRegisterBarY(2)).toBe(56);
    expect(innRegisterBarY(3)).toBe(64);
  });

  it("la barra apunta al huésped resaltado, y a nada si el cursor no cabe", () => {
    expect(layoutInnRegister({ guests: ["Iolo", "Shamino"], cursor: 1 }).barIndex).toBe(1);
    expect(layoutInnRegister({ guests: ["Iolo"], cursor: 3 }).barIndex).toBeNull();
  });
});

describe("#283 · caben CUATRO nombres (§5: el 5º pisaría el borde inferior)", () => {
  it("cuatro entran enteros y el quinto se declara como overflow", () => {
    expect(INN_REGISTER_VISIBLE_NAMES).toBe(4);
    const l = layoutInnRegister({
      guests: ["Iolo", "Shamino", "Dupre", "Mariah", "Julia"],
      cursor: 0,
    });
    expect(l.overflow).toBe(1);
    // La fila 8 sigue siendo el borde INFERIOR intacto, no el quinto nombre.
    expect(cell(l.cells, l.cols, 8, 0)).toBe(0x14);
    expect(rowText(l.cells, l.cols, 8)).not.toContain("Julia");
  });
});

describe("#283 · cursor: el reductor de 0x0668-0x06ee", () => {
  const m0 = initInnRegister();

  it("↓ y → avanzan (códigos 2 y 4 → 0x04b6); ↑ y ← retroceden (1 y 3 → 0x0494)", () => {
    expect(innRegisterKey(m0, "ArrowDown", 3)).toEqual({ kind: "move", model: { cursor: 1 } });
    expect(innRegisterKey(m0, "ArrowRight", 3)).toEqual({ kind: "move", model: { cursor: 1 } });
    expect(innRegisterKey({ cursor: 2 }, "ArrowUp", 3)).toEqual({
      kind: "move",
      model: { cursor: 1 },
    });
    expect(innRegisterKey({ cursor: 2 }, "ArrowLeft", 3)).toEqual({
      kind: "move",
      model: { cursor: 1 },
    });
  });

  it("★ el ESPACIO CONFIRMA (0x06eb salta al mismo 0x06d4 que el Enter), NO cancela", () => {
    // Control discriminante: si el espacio se hubiera copiado del picker «Arms»
    // (shopArmsPicker, donde `" "` cae con `Escape`), esto sería `cancel`.
    expect(innRegisterKey({ cursor: 1 }, " ", 3)).toEqual({ kind: "pick", index: 1 });
    expect(innRegisterKey({ cursor: 1 }, "Enter", 3)).toEqual({ kind: "pick", index: 1 });
    // Y el hermano NEGATIVO en el mismo caso: ESC sí cancela.
    expect(innRegisterKey({ cursor: 1 }, "Escape", 3)).toEqual({ kind: "cancel" });
  });

  it("en los extremos NO envuelve: la barra se queda quieta (0x069e→0x06a2 re-lee tecla)", () => {
    expect(innRegisterKey({ cursor: 0 }, "ArrowUp", 3)).toEqual({ kind: "none" });
    expect(innRegisterKey({ cursor: 2 }, "ArrowDown", 3)).toEqual({ kind: "none" });
  });

  it("una tecla cualquiera no mueve ni elige (0x06f0 `sub si,si`)", () => {
    expect(innRegisterKey(m0, "q", 3)).toEqual({ kind: "none" });
  });
});

describe("★ la barra NUNCA se pierde: la ventana se DESPLAZA con el cursor", () => {
  // 🔴 Bug de CONDUCTA (no de presentación) que destapó el careo del carril
  // `ready-picker-fidelidad`: con más huéspedes que huecos, `layoutInnRegister` pintaba
  // SIEMPRE los 4 primeros y devolvía `barIndex: null` en cuanto el cursor pasaba del
  // 4º. `drawInnRegister` hace `if (barIndex == null) return`, así que la barra
  // DESAPARECÍA y el Enter cobraba a un huésped sin marcar. El original no la pierde
  // (`06c3: 83c708 add di, 8` la sigue bajando) y su ventana SÍ se desplaza: el
  // `putchar('\n')` que sigue al 5º nombre (`061c`/`0620`) deja la fila en 9 y
  // `174f: cmp al,[si+3] / 1752: jle` da 9+1=10 > bot(9) ⇒ `1754: call 0x1f77` = scroll.
  const guests = ["Shamino", "Iolo", "Dupre", "Mariah", "Geoffrey", "Julia"];

  it("con 6 huéspedes y el cursor en el último, la barra SIGUE existiendo", () => {
    const layout = layoutInnRegister({ guests, cursor: 5 });
    expect(layout.barIndex).not.toBeNull();
    expect(layout.barIndex).toBe(INN_REGISTER_VISIBLE_NAMES - 1); // última fila visible
  });

  it("y la ventana muestra la COLA: el huésped bajo la barra está PINTADO", () => {
    const layout = layoutInnRegister({ guests, cursor: 5 });
    const row = 4 + layout.barIndex!; // FIRST_NAME_ROW + fila visible
    let text = "";
    for (let c = 4; c < layout.cols - 1; c++) {
      text += String.fromCharCode(cell(layout.cells, layout.cols, row, c));
    }
    expect(text.trimEnd()).toBe("Julia");
  });

  it("★ CONTROL POSITIVO: con 4 o menos NADA se desplaza (la cabeza sigue arriba)", () => {
    // Sin este control, «la barra existe» pasaría también con un scroll siempre activo.
    const few = guests.slice(0, 4);
    const layout = layoutInnRegister({ guests: few, cursor: 3 });
    expect(layout.barIndex).toBe(3);
    let head = "";
    for (let c = 4; c < layout.cols - 1; c++) {
      head += String.fromCharCode(cell(layout.cells, layout.cols, 4, c));
    }
    expect(head.trimEnd()).toBe("Shamino"); // la fila 4 sigue siendo el PRIMER huésped
    expect(layout.overflow).toBe(0);
  });
});
