/**
 * In Wis (idx 9) — el hechizo que LOCALIZA al grupo en notación de SEXTANTE.
 * Ficha #319; derivación en `re/notes/hechizos-inertes-319.md` §3 (CAST2.OVL:0x06ec,
 * re-careada línea a línea sobre este árbol en el cableado, ver
 * `re/notes/hechizos-inertes-319-cableado.md`).
 *
 * 🔴 LOS ESPERADOS VAN EN CRUDO: cada cadena está calculada A MANO desde la regla del
 * binario (`'A' + nibble`, 0x41+0..15 = 'A'..'P'; Y en 0x06fa ANTES que X en 0x072a;
 * la cadena del medio es DS 0x9548 = `", ` crudo `22 2c 20`). Un aserto que llamara a
 * la misma aritmética del sujeto pasaría con el sujeto roto.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { inWisPeerText, castSpell } from "../src/core/magic/cast.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { buildSpellDefs, type MagicDefsJson, type SpellDef } from "../src/core/magic/spells.js";
import { CombatRng } from "../src/core/combat/formulas.js";
import { OriginalRng } from "../src/core/rng-original.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { CoreViewImpl } from "../src/skin/coreview.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}
const init = load<ExtractedInitialState>("../assets/initial-state.json");
const defs: SpellDef[] = buildSpellDefs(load<MagicDefsJson>("../src/core/data/MagicDefinitions.json"));

describe("inWisPeerText — CAST2.OVL:0x06ec, los doce pasos", () => {
  it("nibbles como letras 'A'..'P' (0x41+n): y=0x6A x=0xF3 → G'K, P'D", () => {
    // A mano: y=0x6A → hi 6 = 'G', lo 0xA = 'K'; x=0xF3 → hi 0xF = 'P', lo 3 = 'D'.
    expect(inWisPeerText(0xf3, 0x6a)).toBe("\nG'K\", P'D\"\n");
  });

  it("Y PRIMERO (0x06fa), X después (0x072a) — el orden no es simétrico", () => {
    // y=0x12 → B'C · x=0x34 → D'E. Si alguien invirtiera los ejes saldría D'E, B'C.
    expect(inWisPeerText(0x34, 0x12)).toBe("\nB'C\", D'E\"\n");
  });

  it("extremos del byte: 0x00 → A'A y 0xFF → P'P (el rango entero es 'A'..'P')", () => {
    expect(inWisPeerText(0x00, 0x00)).toBe("\nA'A\", A'A\"\n");
    expect(inWisPeerText(0xff, 0xff)).toBe("\nP'P\", P'P\"\n");
  });

  it("lleva los DOS '\\n' del binario (putchar 0x06f3 y 0x0760): fila en blanco + cierre", () => {
    const s = inWisPeerText(0x10, 0x20);
    expect(s.startsWith("\n")).toBe(true);
    expect(s.endsWith("\n")).toBe(true);
    // Y entre medias UNA sola fila (sin más saltos): el formato es de una línea.
    expect(s.slice(1, -1)).not.toContain("\n");
  });
});

describe("castSpell con In Wis — ventana 0x08 (SOLO exterior) y silencio del binario", () => {
  function cast(location: number) {
    const g: GameState = createNewGame(init);
    g.spellQuantities[9] = 3;
    const caster = g.characters[3]!;
    caster.level = 8;
    caster.currentMp = 30;
    const def = defs.find((d) => d.index === 9)!;
    const rng = new CombatRng(new OriginalRng(0x1234));
    const antes = rng.rng.getSeed();
    const r = castSpell(g, caster, def, { location, inCombat: false }, rng);
    return { r, antes, despues: rng.rng.getSeed() };
  }

  it("en EXTERIOR (loc 0) devuelve el descriptor peer, con éxito MUDO (message vacío)", () => {
    const { r } = cast(0);
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "peer" });
    // El handler no toca el código de resultado (ret 0x0767) ⇒ la cola 0x11a6 calla:
    // ni "Success!" ni nada — lo único que se imprime son las coordenadas.
    expect(r.message).toBe("");
  });

  it("NEGATIVO donde el binario calla: en pueblo y en mazmorra, «Not here!» sin efecto", () => {
    for (const location of [0x0a, 0x21]) {
      const { r } = cast(location);
      expect(r.ok).toBe(false);
      expect(r.message).toBe("Not here!");
      expect(r.effect).toBeNull();
    }
  });

  it("CERO tiradas: ninguna de las doce emisiones es rand_range — la semilla no se mueve", () => {
    const { antes, despues } = cast(0);
    expect(despues).toBe(antes);
  });
});

describe("el impresor modelado (#108) reproduce el cursor del binario con los dos '\\n'", () => {
  it("una fila en BLANCO previa + UNA fila rúnica con las coordenadas, y nada más", () => {
    // El putchar('\n') inicial con cursor en columna 0 quema una fila entera (closeRow);
    // el final sólo cierra la fila de coordenadas. Y el `rune` POR FILA vale porque tras
    // el set_font(0) el binario ya no imprime glifo (sólo LF) — medicion-364c.
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    const world = { overworld, underworld: overworld, smallMaps: new Map() } as unknown as WorldData;
    const state: GameState = createNewGame(init);
    state.position = { location: 0, floor: 0, x: 100, y: 100 };
    const game = new Game({} as ExtractedInitialState, world, { locationsX: [], locationsY: [], locationNames: [] } as GameData, state, {
      combatResources: {
        combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
      } as CombatResources,
    });
    const view = new CoreViewImpl(game);
    const antes = view.snapshot().console.length;
    view.pushConsole(inWisPeerText(0xf3, 0x6a), "message", true);
    const lineas = view.snapshot().console;
    expect(lineas.length).toBe(antes + 2);
    expect(lineas.at(-2)).toEqual({ text: "", kind: "message" });
    expect(lineas.at(-1)).toEqual({ text: "G'K\", P'D\"", kind: "message", rune: true });
  });
});
