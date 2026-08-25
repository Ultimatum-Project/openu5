/**
 * An Sanct (idx 6) — ABRE el cofre en MAZMORRA. `CAST.OVL:0x02d2`, rama
 * `0x20 < g_location < 0x80` (cuerpo 0x02ee-0x0395). Ficha #286; derivación en
 * `re/notes/an-sanct-286-derivacion.md`.
 *
 * Las piezas que cada aserto defiende (offsets del cuerpo derivado):
 *  · 0x030c-0x033a: PRIMERO la celda BAJO el grupo (`and al,0xf0 / cmp al,0x40` —
 *    nibble alto 0x4 = cofre cerrado, CUALQUIER subtipo).
 *  · 0x033c-0x0356: si no, la DE ENFRENTE — deltas por facing de DS 0x24d6 (dx) /
 *    0x24de (dy), las MISMAS tablas que An Grav — con `and 7` en LOS DOS ejes
 *    (0x0341/0x034b): envuelve el toro 8×8.
 *  · 0x0367 `test byte [bp-0xe],1`: SOLO el bit 0 del subtipo dispara el
 *    "Disarmed!" (DS 0x45a1, crudo `Disarmed!\n\0`) — y va ANTES de abrir.
 *  · 0x0374-0x037f `(tile & 8) | 0x70`: cofre ABIERTO conservando SOLO el bit
 *    iluminado — trampa y cerradura fuera de golpe, sin tirada.
 *  · Éxito: "Chest opened!" (DS 0x45ac, crudo `Chest opened!\n\0`) y res=0xFFFF
 *    ⇒ la cola 0x11a6 NO añade "Success!". Fallo: res=0 ⇒ "Failed!" (DS 0x4660).
 *  · CERO rand_range en la rama entera (llamadas censadas: jingle CAST2:0x0000 ·
 *    print_string 0x1850 — nada más).
 * La rama de TABLA DE OBJETOS (0x03de-0x0432, pool 0x5c5a de #103) queda SIN
 * cablear — bloqueada, misma decisión que la rama de combate de An Grav (#319 §6);
 * aquí sólo se afirma la rama de mazmorra.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  DungeonState,
  CellType,
  LIT_BIT,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/index.js";
import { buildSpellDefs, type MagicDefsJson, type SpellDef } from "../src/core/magic/spells.js";
import { castSpell } from "../src/core/magic/cast.js";
import { CombatRng } from "../src/core/combat/formulas.js";
import { OriginalRng } from "../src/core/rng-original.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}
const init = load<ExtractedInitialState>("../assets/initial-state.json");
const defs: SpellDef[] = buildSpellDefs(load<MagicDefsJson>("../src/core/data/MagicDefinitions.json"));

/** Mazmorra sintética 8×8×8 vacía (misma forma que an-grav-dispel-319.test.ts). */
function emptyDungeon(location: number): DungeonData {
  const floors: DungeonCell[][][] = [];
  for (let f = 0; f < 8; f++) {
    const grid: DungeonCell[][] = [];
    for (let y = 0; y < 8; y++) {
      const row: DungeonCell[] = [];
      for (let x = 0; x < 8; x++) row.push({ type: CellType.Nothing, sub: 0 });
      grid.push(row);
    }
    floors.push(grid);
  }
  return { location, name: `synthetic-${location}`, floors };
}
function pos(over: Partial<DungeonPos> = {}): DungeonPos {
  return { dungeon: 33, floor: 3, x: 4, y: 4, facing: "north", ...over };
}
function dng(over: Partial<DungeonPos> = {}): DungeonState {
  return new DungeonState([emptyDungeon(33)], pos(over));
}
type SetCell = { setCell(f: number, x: number, y: number, c: DungeonCell): void };
const plant = (d: DungeonState, f: number, x: number, y: number, c: DungeonCell): void =>
  (d as unknown as SetCell).setCell(f, x, y, c);
const OPENED = [{ kind: "message", text: "Chest opened!" }];
const DISARMED_OPENED = [
  { kind: "message", text: "Disarmed!" },
  { kind: "message", text: "Chest opened!" },
];
const FAILED = [{ kind: "message", text: "Failed!" }];

describe("Dungeon.anSanctOpenChest — bajo los pies PRIMERO, enfrente después", () => {
  it("con cofre BAJO el grupo abre ESE, aunque también haya uno enfrente", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 4, { type: CellType.Chest, sub: 0 });
    plant(d, 3, 4, 3, { type: CellType.Chest, sub: 0 });
    expect(d.anSanctOpenChest()).toEqual(OPENED);
    expect(d.cellAt(3, 4, 4)).toEqual({ type: CellType.OpenChest, sub: 0 }); // el pisado, abierto
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.Chest, sub: 0 }); // el de enfrente, INTACTO
  });

  it("sin cofre bajo los pies cae al de ENFRENTE por el facing", () => {
    const esperado: Record<string, [number, number]> = {
      north: [4, 3], south: [4, 5], east: [5, 4], west: [3, 4],
    };
    for (const [facing, [ex, ey]] of Object.entries(esperado)) {
      const d = dng({ x: 4, y: 4, facing: facing as DungeonPos["facing"] });
      plant(d, 3, ex, ey, { type: CellType.Chest, sub: 0 });
      expect(d.anSanctOpenChest()).toEqual(OPENED);
      expect(d.cellAt(3, ex, ey)).toEqual({ type: CellType.OpenChest, sub: 0 });
    }
  });

  it("ENVUELVE en el toro (`and 7` de 0341/034b): desde y=0 al norte abre en y=7", () => {
    const d = dng({ x: 0, y: 0, facing: "north" });
    plant(d, 3, 0, 7, { type: CellType.Chest, sub: 0 });
    expect(d.anSanctOpenChest()).toEqual(OPENED);
    expect(d.cellAt(3, 0, 7).type).toBe(CellType.OpenChest);
  });

  it("opera en la PLANTA actual, no en otra", () => {
    const d = dng({ floor: 5, x: 4, y: 4, facing: "east" });
    plant(d, 5, 5, 4, { type: CellType.Chest, sub: 0 });
    plant(d, 3, 5, 4, { type: CellType.Chest, sub: 0 });
    expect(d.anSanctOpenChest()).toEqual(OPENED);
    expect(d.cellAt(5, 5, 4).type).toBe(CellType.OpenChest);
    expect(d.cellAt(3, 5, 4).type).toBe(CellType.Chest); // la otra planta, intacta
  });
});

describe("Dungeon.anSanctOpenChest — bit 0 = 'Disarmed!' y la máscara `(tile&8)|0x70`", () => {
  it("cofre con TRAMPA (bit 0): 'Disarmed!' ANTES de 'Chest opened!'", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 3, { type: CellType.Chest, sub: 1 });
    expect(d.anSanctOpenChest()).toEqual(DISARMED_OPENED);
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.OpenChest, sub: 0 }); // trampa fuera
  });

  it("NEGATIVO del `test ...,1`: subtipo 2 (sin bit 0) abre SIN 'Disarmed!'", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 3, { type: CellType.Chest, sub: 2 });
    expect(d.anSanctOpenChest()).toEqual(OPENED);
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.OpenChest, sub: 0 });
  });

  it("conserva el bit ILUMINADO: cofre 0x49 (trampa|LIT) queda en 0x78, no en 0x70", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 3, { type: CellType.Chest, sub: 1 | LIT_BIT });
    expect(d.anSanctOpenChest()).toEqual(DISARMED_OPENED);
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.OpenChest, sub: LIT_BIT });
  });

  it("cofre iluminado SIN trampa (0x48): sin 'Disarmed!' (el LIT no es el bit 0)", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 3, { type: CellType.Chest, sub: LIT_BIT });
    expect(d.anSanctOpenChest()).toEqual(OPENED);
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.OpenChest, sub: LIT_BIT });
  });

  it("NEGATIVO: sin cofre ni debajo ni enfrente → 'Failed!' y NINGUNA celda tocada", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    expect(d.anSanctOpenChest()).toEqual(FAILED);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        expect(d.cellAt(3, x, y)).toEqual({ type: CellType.Nothing, sub: 0 });
  });

  it("NEGATIVO: un cofre YA ABIERTO (0x70) no pasa el `cmp al,0x40` → 'Failed!'", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 3, { type: CellType.OpenChest, sub: 0 });
    expect(d.anSanctOpenChest()).toEqual(FAILED);
    expect(d.cellAt(3, 4, 3)).toEqual({ type: CellType.OpenChest, sub: 0 }); // intacto
  });

  it("abrir ↔ vaciar: el 0x70 que deja An Sanct es EXACTAMENTE lo que el (G)et vacía", () => {
    const d = dng({ x: 4, y: 4, facing: "north" });
    plant(d, 3, 4, 4, { type: CellType.Chest, sub: 1 }); // bajo los pies, con trampa
    expect(d.anSanctOpenChest()).toEqual(DISARMED_OPENED);
    const state: GameState = createNewGame(init);
    const ev = d.getHere(state); // SJOG 0x179E: rama 0x70 → "contents\nof chest\n..."
    expect(ev.some((e) => (e.text ?? "").startsWith("contents\nof chest"))).toBe(true);
    expect(d.cellAt(3, 4, 4).type).toBe(CellType.Nothing); // vaciado
  });
});

describe("Game.applyAnSanctOpenChest — el puente del (C)ast de mazmorra", () => {
  function gameEnMazmorra(): Game {
    const g = new Game(
      {} as ExtractedInitialState,
      { overworld: [], underworld: [], smallMaps: new Map() } as unknown as WorldData,
      { locationsX: [], locationsY: [], locationNames: [] } as GameData,
      createNewGame(init),
      {
        combatResources: {
          combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
        } as CombatResources,
      },
    );
    g.dungeonState = dng({ x: 4, y: 4, facing: "north" });
    return g;
  }

  it("delega en la mazmorra viva y propaga 'Disarmed!' + 'Chest opened!'", () => {
    const g = gameEnMazmorra();
    plant(g.dungeonState!, 3, 4, 3, { type: CellType.Chest, sub: 1 });
    expect(g.applyAnSanctOpenChest()).toEqual(DISARMED_OPENED);
    expect(g.dungeonState!.cellAt(3, 4, 3).type).toBe(CellType.OpenChest);
  });

  it("sin mazmorra activa no fabrica nada", () => {
    const g = gameEnMazmorra();
    g.dungeonState = null;
    expect(g.applyAnSanctOpenChest()).toEqual([]);
  });
});

describe("castSpell con An Sanct — ventana 0x0f (los cuatro contextos) y cero RNG", () => {
  function cast(location: number, inCombat = false) {
    const g: GameState = createNewGame(init);
    g.spellQuantities[6] = 3;
    const caster = g.characters[3]!;
    caster.level = 8;
    caster.currentMp = 30;
    const def = defs.find((d) => d.index === 6)!;
    const rng = new CombatRng(new OriginalRng(0x1234));
    const antes = rng.rng.getSeed();
    const r = castSpell(g, caster, def, { location, inCombat }, rng);
    return { r, antes, despues: rng.rng.getSeed() };
  }

  it("en MAZMORRA (loc 0x21) devuelve el descriptor disarmOrOpen", () => {
    const { r } = cast(0x21);
    expect(r.ok).toBe(true);
    expect(r.effect).toEqual({ kind: "disarmOrOpen" });
  });

  it("la máscara 0x0f admite TAMBIÉN exterior, pueblo y combate (las otras ramas)", () => {
    for (const [location, inCombat] of [[0, false], [0x0a, false], [0x80, true]] as const) {
      const { r } = cast(location, inCombat);
      expect(r.ok).toBe(true);
      expect(r.effect).toEqual({ kind: "disarmOrOpen" });
    }
  });

  it("CERO tiradas en la rama de mazmorra: la semilla no se mueve", () => {
    const { antes, despues } = cast(0x21);
    expect(despues).toBe(antes);
  });
});
