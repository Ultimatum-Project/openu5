/**
 * Selector de reagentes de (M)ix — reductor puro (CMDS.OVL 0x18be). Navegación del
 * cursor, toggle de marcado (máscara `0x80>>id`), 'M' mezcla, ESC cancela.
 */
import { describe, it, expect } from "vitest";
import {
  buildMixReagentRows,
  initMixReagentPicker,
  mixReagentKey,
  reagentBit,
  reagentMask,
  type MixReagentRow,
} from "../src/core/magic/mixReagentPicker.js";

const NAMES = ["Sulfur Ash", "Ginseng", "Garlic", "Sp. Silk", "Blood Moss", "Blk. Pearl", "Nightshade", "Mandrake"];

/** Filas desde un vector de cuentas (índice = reagentId). */
function rowsFrom(qty: number[]): MixReagentRow[] {
  return buildMixReagentRows({ qtyOf: (id) => qty[id] ?? 0, nameOf: (id) => NAMES[id]! });
}

describe("reagentBit / reagentMask", () => {
  it("bit = 0x80 >> id (di del binario, 0x19f1)", () => {
    expect(reagentBit(0)).toBe(0x80);
    expect(reagentBit(7)).toBe(0x01);
  });
  it("máscara = OR de los bits; In Lor [0]=0x80, An Xen Corp [0,2]=0xa0", () => {
    expect(reagentMask([0])).toBe(0x80);
    expect(reagentMask([0, 2])).toBe(0xa0);
    expect(reagentMask([])).toBe(0);
  });
});

describe("buildMixReagentRows", () => {
  it("lista SÓLO los reagentes poseídos (cuenta > 0), en orden de id", () => {
    const rows = rowsFrom([4, 0, 7, 0, 0, 3, 0, 0]); // Ash, Garlic, Blk. Pearl
    expect(rows.map((r) => r.reagentId)).toEqual([0, 2, 5]);
    expect(rows.map((r) => r.name)).toEqual(["Sulfur Ash", "Garlic", "Blk. Pearl"]);
    expect(rows[0]!.qty).toBe(4);
  });
});

describe("mixReagentKey", () => {
  const rows = rowsFrom([4, 6, 7, 0, 0, 3, 0, 0]); // ids 0,1,2,5

  it("flechas mueven el cursor con clamp (sin wrap)", () => {
    let m = initMixReagentPicker();
    expect(mixReagentKey(m, "ArrowUp", rows)).toEqual({ kind: "none" }); // ya en el tope
    const down = mixReagentKey(m, "ArrowDown", rows);
    expect(down).toMatchObject({ kind: "move" });
    if (down.kind === "move") m = down.model;
    expect(m.cursor).toBe(1);
    // ArrowLeft = subir, ArrowRight = bajar (getdir 1/3 vs 2/4).
    const up = mixReagentKey(m, "ArrowLeft", rows);
    expect(up.kind === "move" && up.model.cursor).toBe(0);
    // Clamp abajo.
    let c = initMixReagentPicker();
    for (let i = 0; i < 10; i++) {
      const a = mixReagentKey(c, "ArrowDown", rows);
      if (a.kind === "move") c = a.model;
    }
    expect(c.cursor).toBe(rows.length - 1); // 3 (id 5)
  });

  it("RETURN/Space marca y desmarca el reagente del cursor (toggle de máscara)", () => {
    let m = initMixReagentPicker(); // cursor 0 → id 0, bit 0x80
    const t1 = mixReagentKey(m, "Enter", rows);
    expect(t1).toMatchObject({ kind: "toggle" });
    if (t1.kind === "toggle") m = t1.model;
    expect(m.selected).toBe(0x80); // Ash marcado
    // Space sobre el mismo lo DESmarca.
    const t2 = mixReagentKey(m, " ", rows);
    expect(t2.kind === "toggle" && t2.model.selected).toBe(0);
  });

  it("marca en filas distintas acumula bits", () => {
    let m = initMixReagentPicker();
    let a = mixReagentKey(m, "Enter", rows); // id 0 → 0x80
    if (a.kind === "toggle") m = a.model;
    a = mixReagentKey(m, "ArrowDown", rows); // cursor → 1
    if (a.kind === "move") m = a.model;
    a = mixReagentKey(m, "ArrowDown", rows); // cursor → 2 (id 2)
    if (a.kind === "move") m = a.model;
    a = mixReagentKey(m, "Enter", rows); // id 2 → 0x20
    if (a.kind === "toggle") m = a.model;
    expect(m.selected).toBe(0x80 | 0x20); // Ash + Garlic
  });

  it("'M' mezcla con la máscara actual; ESC cancela", () => {
    let m = initMixReagentPicker();
    const t = mixReagentKey(m, "Enter", rows);
    if (t.kind === "toggle") m = t.model;
    expect(mixReagentKey(m, "M", rows)).toEqual({ kind: "mix", selected: 0x80 });
    expect(mixReagentKey(m, "m", rows)).toEqual({ kind: "mix", selected: 0x80 });
    expect(mixReagentKey(m, "Escape", rows)).toEqual({ kind: "close" });
  });

  it("otras teclas se ignoran (getkey re-lee)", () => {
    const m = initMixReagentPicker();
    expect(mixReagentKey(m, "x", rows)).toEqual({ kind: "none" });
  });
});
