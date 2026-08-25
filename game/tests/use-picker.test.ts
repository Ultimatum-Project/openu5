/**
 * Tests del MODELO del picker de (U)se (`core/usePicker.ts`) — la PRESENTACIÓN del
 * comando: qué ítems lista y en qué ORDEN (tabla extendida 0xB9EE), y la navegación del
 * cursor (`item_page_controller` @0x0f2e, modo 'U'). Es el gemelo de `ready-picker.test.ts`;
 * la MECÁNICA de cada verbo (`game.useXxx()`) se testea en `use-tools.test.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  USE_QTY_HIDDEN,
  USE_VISIBLE_ROWS,
  buildUseRows,
  initUsePicker,
  usePickerKey,
  type UseRowsState,
} from "../src/core/usePicker.js";

/** Estado de prueba: todo vacío salvo lo que se pase. */
function state(over: Partial<UseRowsState> = {}): UseRowsState {
  return {
    scrollQuantities: [0, 0, 0, 0, 0, 0, 0, 0],
    potionQuantities: [0, 0, 0, 0, 0, 0, 0, 0],
    magicCarpets: 0,
    skullKeys: 0,
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    specialItems: {
      spyglass: false,
      hmsCape: false,
      sextant: false,
      pocketWatch: false,
      blackBadge: false,
      woodenBox: false,
    },
    ...over,
  };
}

describe("buildUseRows — membresía y orden de la tabla extendida (0xB9EE)", () => {
  it("no lista nada cuando no se posee ningún usable → caller imprime 'No usable items!'", () => {
    expect(buildUseRows(state())).toEqual([]);
  });

  it("lista SÓLO los ítems poseídos (find_next_owned salta las entradas vacías, @0x05a4)", () => {
    const rows = buildUseRows(state({ skullKeys: 2, specialItems: { ...state().specialItems, sextant: true } }));
    expect(rows.map((r) => r.name)).toEqual(["Skull Keys", "Sextant"]);
    // La skull key es CONTABLE (`dec` CAST 0x18c4) y muestra su cuenta; el sextante lo
    // graba TALK 0x06f8 a 0xff ⇒ `print_list_row` @0x05f5 le quita la columna entera.
    expect(rows[0]!.qty).toBe(2);
    expect(rows[1]!.qty).toBe(USE_QTY_HIDDEN);
  });

  it("respeta el ORDEN de la tabla (skull key → artefactos LB → moonstones → shards → herramientas)", () => {
    // Todos poseídos: el orden debe seguir la tabla 0xB9EE (0x11..0x25), no el de inserción.
    // Las moonstones (0x15-0x1c) van ENTRE sceptre (0x14) y shards (0x1d).
    const rows = buildUseRows(
      state({
        skullKeys: 1,
        moonstones: [{ buried: false }, { buried: true }, { buried: false }],
        shards: { falsehood: true, hatred: true, cowardice: true },
        lbArtifacts: { amulet: true, crown: true, sceptre: true },
        specialItems: {
          spyglass: true,
          hmsCape: true,
          sextant: true,
          pocketWatch: true,
          blackBadge: true,
          woodenBox: true,
        },
      }),
    );
    // Nombres = name-table DS 0x1916 VERBATIM (con el sigilo de formato cuando la
    // entrada lo lleva). NO son los nombres largos del (U)se DOM previo.
    expect(rows.map((r) => r.name)).toEqual([
      "Skull Keys",
      "Amulet",
      "Crown",
      "Sceptre",
      "(0", // fase 0 (llevada) → "Moonstone " + '0'
      "(2", // fase 2 (llevada); la fase 1 está enterrada → no se lista
      "Shard/Falsehd",
      "Shard/Hatred",
      "Shard/Cowrdce",
      "Spyglass",
      "HMS Cape Plan",
      "Sextant",
      "Pocket Watch",
      "Black Badge",
      "Wooden Box",
    ]);
    // TODAS menos la llave de calavera son flags 0xff (censo de escritores del disasm)
    // ⇒ ninguna lleva columna de cantidad.
    expect(rows.slice(1).every((r) => r.qty === USE_QTY_HIDDEN)).toBe(true);
    expect(rows[0]!.qty).toBe(1);
  });

  it("moonstones: sólo las LLEVADAS (buried===false) se listan, con su fase en la acción", () => {
    // Fases 0 y 3 llevadas; 1 y 2 enterradas → dos filas 'Moonstone' con phase 0 y 3.
    const rows = buildUseRows(
      state({ moonstones: [{ buried: false }, { buried: true }, { buried: true }, { buried: false }] }),
    );
    expect(rows.map((r) => r.name)).toEqual(["(0", "(3"]);
    expect(rows.map((r) => r.action)).toEqual([
      { kind: "moonstone", phase: 0 },
      { kind: "moonstone", phase: 3 },
    ]);
    // `build_extended_item_table` @0x09b4 NORMALIZA la gema a flag (0xff si llevada) ⇒
    // sin columna de cantidad.
    expect(rows.every((r) => r.qty === USE_QTY_HIDDEN)).toBe(true);
  });

  it("cada fila lleva la acción de despacho correcta (game.useXxx)", () => {
    const rows = buildUseRows(
      state({ skullKeys: 1, shards: { falsehood: true, hatred: false, cowardice: false }, specialItems: { ...state().specialItems, hmsCape: true } }),
    );
    expect(rows.find((r) => r.name === "Skull Keys")!.action).toEqual({ kind: "skullKey" });
    expect(rows.find((r) => r.name === "Shard/Falsehd")!.action).toEqual({ kind: "shard", which: "falsehood" });
    expect(rows.find((r) => r.name === "HMS Cape Plan")!.action).toEqual({ kind: "tool", tool: "hmsCape" });
  });
});

describe("usePickerKey — navegación del cursor (item_page_controller @0x0f2e, mode 'U')", () => {
  const N = 10; // overflow sobre las 7 filas visibles

  it("↓/↑ mueven el cursor una fila con clamp (sin wrap), igual que Ready", () => {
    let m = initUsePicker();
    const down = usePickerKey(m, "ArrowDown", N);
    expect(down.kind).toBe("move");
    if (down.kind === "move") m = down.model;
    expect(m.cursor).toBe(1);
    expect(usePickerKey({ cursor: 0, scroll: 0 }, "ArrowUp", N).kind).toBe("none");
    expect(usePickerKey({ cursor: N - 1, scroll: N - USE_VISIBLE_ROWS }, "ArrowDown", N).kind).toBe("none");
  });

  it("el scroll sigue al cursor al pasar de la ventana visible de 7", () => {
    let m = initUsePicker();
    for (let i = 0; i < 7; i++) {
      const r = usePickerKey(m, "ArrowDown", N);
      if (r.kind === "move") m = r.model;
    }
    expect(m.cursor).toBe(7);
    expect(m.scroll).toBe(7 - USE_VISIBLE_ROWS + 1);
  });

  it("PgDn/PgUp saltan 7; Home/End van a los bordes", () => {
    let m = initUsePicker();
    const pd = usePickerKey(m, "PageDown", N);
    if (pd.kind === "move") m = pd.model;
    expect(m.cursor).toBe(USE_VISIBLE_ROWS);
    const end = usePickerKey(m, "End", N);
    if (end.kind === "move") m = end.model;
    expect(m.cursor).toBe(N - 1);
    const home = usePickerKey(m, "Home", N);
    if (home.kind === "move") m = home.model;
    expect(m.cursor).toBe(0);
  });

  it("RETURN/Space USAN el ítem del cursor y CIERRAN (@0x1230); ESC cierra con 'None!'", () => {
    const m = { cursor: 3, scroll: 0 };
    // A diferencia de Ready (kind 'equip', sigue abierto), Use devuelve 'use' → main cierra.
    expect(usePickerKey(m, "Enter", N)).toEqual({ kind: "use", index: 3 });
    expect(usePickerKey(m, " ", N)).toEqual({ kind: "use", index: 3 });
    expect(usePickerKey(m, "Escape", N)).toEqual({ kind: "close" });
  });

  it("una lista vacía cierra ante cualquier tecla (defensivo)", () => {
    expect(usePickerKey(initUsePicker(), "ArrowDown", 0)).toEqual({ kind: "close" });
  });
});
