/**
 * Wis An Ylem (idx 33) — el REVELADO de 20 fotogramas de la ventana 11×11.
 * Ficha #319; acta `re/notes/hechizos-inertes-319.md` §5 y cableado en
 * `re/notes/hechizos-inertes-319-cableado.md`.
 *
 * Lo derivado que cada aserto defiende:
 *  · `CAST2.OVL:0x0473 push 0xffff` → `vis_buffer_build` (kernel 0x5D0A) con radio −1:
 *    el `jle 0x5d8f` de 0x5d45 SALTA el flood entero y el búfer 0xAB02 queda como lo
 *    siembra el prólogo (5d12-5d31: 11×11 a 0xFF) = TODO visible, muros incluidos.
 *  · `0x049d mov si, 0x14` = VEINTE fotogramas — DEATH_VISION_FRAMES en crudo.
 *  · Al acabar, `call 0x7730` → viewport_redraw normal (0x5910): la censura vuelve.
 *  · Ventana temporal 0x0c = exterior + pueblo (TIME_PERMITTED_BITS[33]).
 *  · El tick por fotograma del binario (`0x6372` → kernel 0x4552, TRES rand_range
 *    dentro del barrido del pool 0x5c5a, gateado por `g_time_spell != 'T'`) NO se
 *    porta: cardinal dependiente de la población, no derivado — el port consume CERO
 *    tiradas y la divergencia de stream queda DECLARADA (familia #31/#101).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { TILE_HIDDEN, VIEW_WINDOW } from "../src/skin/api.js";
import { castSpell, DEATH_VISION_FRAMES } from "../src/core/magic/cast.js";
import { buildSpellDefs, type MagicDefsJson, type SpellDef } from "../src/core/magic/spells.js";
import { CombatRng } from "../src/core/combat/formulas.js";
import { OriginalRng } from "../src/core/rng-original.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}
const init = load<ExtractedInitialState>("../assets/initial-state.json");
const defs: SpellDef[] = buildSpellDefs(load<MagicDefsJson>("../src/core/data/MagicDefinitions.json"));

/** Mundo de MONTAÑA (0x0c ∈ ALWAYS_OPAQUE): a 2+ celdas del centro, todo queda oculto. */
const MOUNTAIN = 0x0c;
function mountainWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => MOUNTAIN));
  return { overworld, underworld: overworld, smallMaps: new Map() };
}
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
};

function makeView(): { game: Game; view: CoreViewImpl } {
  const state: GameState = createNewGame(init);
  state.position = { location: 0, floor: 0, x: 100, y: 100 };
  state.time = { year: 139, month: 4, day: 7, hour: 12, minute: 0 };
  const game = new Game({} as ExtractedInitialState, mountainWorld(), gameData, state, {
    combatResources,
  });
  return { game, view: new CoreViewImpl(game) };
}
const corner = 0; // celda (0,0) de la ventana: a distancia 5+5 del centro, oculta seguro
const hiddenCells = (w: ArrayLike<number>): number => {
  let n = 0;
  for (let i = 0; i < VIEW_WINDOW * VIEW_WINDOW; i++) if (w[i] === TILE_HIDDEN) n++;
  return n;
};

describe("DEATH_VISION_FRAMES — el cardinal del bucle, en crudo", () => {
  it("son 0x14 = VEINTE fotogramas (CAST2:0x049d `mov si, 0x14`)", () => {
    expect(DEATH_VISION_FRAMES).toBe(0x14);
  });
});

describe("CoreViewImpl.revealViewport — el búfer 0xFF sembrado y su caducidad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("SIN revelado, la montaña censura: la esquina de la ventana es TILE_HIDDEN", () => {
    const { view } = makeView();
    const w = view.snapshot().window;
    expect(w[corner]).toBe(TILE_HIDDEN);
    expect(hiddenCells(w)).toBeGreaterThan(0);
  });

  it("con el revelado activo NO hay NI UNA celda oculta (flood saltado ⇒ todo 0xFF)", () => {
    const { view } = makeView();
    view.revealViewport(DEATH_VISION_FRAMES * 55);
    const w = view.snapshot().window;
    expect(hiddenCells(w)).toBe(0);
    expect(w[corner]).toBe(MOUNTAIN); // la celda enseña su TILE, no negro
  });

  it("y el visMask del shader va todo a 1 mientras dura (las DOS pieles por el mismo choke)", () => {
    const { view } = makeView();
    view.revealViewport(DEATH_VISION_FRAMES * 55);
    const mask = view.snapshot().visMask!;
    for (let i = 0; i < VIEW_WINDOW * VIEW_WINDOW; i++) expect(mask[i]).toBe(1);
  });

  it("CADUCA: pasado el plazo, el siguiente snapshot re-censura (el 0x5910 final)", () => {
    const { view } = makeView();
    view.revealViewport(DEATH_VISION_FRAMES * 55); // 1100 ms
    expect(hiddenCells(view.snapshot().window)).toBe(0);
    vi.setSystemTime(1_000_000 + DEATH_VISION_FRAMES * 55 + 1);
    const w = view.snapshot().window;
    expect(w[corner]).toBe(TILE_HIDDEN);
    expect(hiddenCells(w)).toBeGreaterThan(0);
  });

  it("NEGATIVO: dentro del plazo (fotograma 19) sigue revelado — no caduca antes de hora", () => {
    const { view } = makeView();
    view.revealViewport(DEATH_VISION_FRAMES * 55);
    vi.setSystemTime(1_000_000 + 19 * 55);
    expect(hiddenCells(view.snapshot().window)).toBe(0);
  });
});

describe("castSpell con Wis An Ylem — ventana 0x0c (exterior+pueblo) y stream declarado", () => {
  function cast(location: number, inCombat = false) {
    const g: GameState = createNewGame(init);
    g.spellQuantities[33] = 3;
    const caster = g.characters[3]!;
    caster.level = 8;
    caster.currentMp = 30;
    const def = defs.find((d) => d.index === 33)!;
    const rng = new CombatRng(new OriginalRng(0x1234));
    const antes = rng.rng.getSeed();
    const r = castSpell(g, caster, def, { location, inCombat }, rng);
    return { r, antes, despues: rng.rng.getSeed() };
  }

  it("en EXTERIOR y en PUEBLO devuelve el descriptor deathVision (bits 0x08 y 0x04)", () => {
    for (const location of [0, 0x0a]) {
      const { r } = cast(location);
      expect(r.ok).toBe(true);
      expect(r.effect).toEqual({ kind: "deathVision" });
    }
  });

  it("NEGATIVO donde el binario calla: mazmorra y combate → «Not here!»", () => {
    expect(cast(0x21).r.message).toBe("Not here!");
    expect(cast(0x81, true).r.message).toBe("Not here!");
  });

  it("el PORT consume CERO tiradas (divergencia de stream DECLARADA, no inventada)", () => {
    // El binario sí consume (0x4552 ×20 fotogramas, condicional por An Tym y por
    // población del pool): un port que 'aproximara' un número fijo estaría inventando
    // stream. Aquí se afirma el CERO del port, que es lo declarado.
    const { antes, despues } = cast(0);
    expect(despues).toBe(antes);
  });
});
