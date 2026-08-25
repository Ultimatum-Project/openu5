/**
 * #375 — (G)et de ANTORCHAS (y fallback por tile) EN LA ARENA.
 *
 * Derivación (re/disasm/SJOG.OVL.asm, cmd_get 0x18ce leído entero 0x18ce-0x1b33;
 * acta re/notes/siembra-objetos-cbt-353.md §7 + re/notes/get-torch-arena-375.md):
 * cuando el barrido de la tabla de objetos agota los 31 slots (0x19b7), cmd_get cae
 * al FALLBACK POR TILE (0x19c0: `call 0x8482` = kernel 0x4402 get_tile_ptr) y
 * despacha por el tile (switch 0x19cf/0x1b0e). La rutina es la MISMA de la arena
 * (funnel COMBAT.OVL 0x0544 code 0) y el switch no mira g_location — sólo el
 * repintado 0x9eca se salta con loc>=0x80 (guard 0x19fb; en combate loc=0xFF).
 *
 * ESPERADOS EN CRUDO (DATA.OVL, fileoff = DS + 0x10; tiles del asm):
 *   antorcha 0xB0/0xB1 (0x1b1b-0x1b25 → 0x19e8): tile→0x44 (0x19f3) ·
 *   g_torch_mins=0x64 ASIGNADO (0x1a05) · "Borrowed!" 0x8de8 · glide
 *   GL(800→2000,1,50) (0x842e @0x1a21) — sin gate de dirección, sin karma.
 *   plato 0x9A (0x1a6a): gate dy==+1 → tile→0x95 + "Mmmmm...!" 0x8e04; si no,
 *   "Can't reach plate!" 0x8e10 · plato 0x9C (0x1aca): dx==±1 veta; dy=+1 deja
 *   0x9B, dy=−1 deja 0x9A (0x1adc-0x1b01) · trigo 0x2D (0x1a2a): tile→0x2C +
 *   "Crops picked!" 0x8df4 · comida: counter_add(+1, cap 0x270f) 0x1a44-0x1a50
 *   (0x7f94 = kernel 0x3f14) · karma−1 si ≠0 (0x1a58-0x1a62) · default
 *   "Nothing to get!" 0x8e64 (0x1b28).
 *
 * RNG: CERO en todas las ramas del fallback (calls de la rama torch: 0x8482
 * get_tile_ptr · 0x58d0 print · 0x842e pcspeaker_glide · 0x9990 viewport_redraw;
 * plato/trigo añaden 0x7f94 counter_add — ninguno toca g_rng; adjudicaciones en
 * citas-pool/absorcion-179/combat-spells). Asertos de stream con gemelo de semilla.
 * TURNO: la arena consume SIEMPRE (funnel descarta el retorno @0x05b0), también
 * en "Can't reach plate!" — el no-consumo del early-exit es sólo del overworld.
 *
 * POBLACIÓN (censo en crudo sobre combatmaps.json, guardado abajo): 24/128 mapas
 * con 0xB0/0xB1 (todos dungeon) y UNO con 0x9A (dungeon registro 111, en (8,5)).
 * ⚠ El plato real es INALCANZABLE en 1988: el getdir del kernel (0x35EC) sólo
 * acepta los códigos 1-4 = W/E/N/S (deltas 0x3650-0x3687; ESC/Space → "Pass",
 * SIN diagonales) y las cuatro celdas cardinales vecinas del plato son mesa
 * impasable (0x92/0x90/0x94/0x96). Las ramas de plato/trigo van calcadas por ser
 * el MISMO switch, ejercitadas aquí con tiles sembrados.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  type CombatMapData,
  type CombatEvent,
  type PartyCombatant,
} from "../src/core/combat/combat.js";
import { sfxForCombatEvent } from "../src/core/sfx.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

// Tiles EN CRUDO del asm (no importados del sujeto — el esperado no se deriva de él).
const RIGHT_SCONCE = 0xb0;
const LEFT_SCONCE = 0xb1;
const BRICK_FLOOR = 0x44;
const FOOD_TOP = 0x9a;
const FOOD_BOTH = 0x9c;
const FOOD_BOTTOM = 0x9b;
const TABLE_MIDDLE = 0x95;
const WHEAT = 0x2d;
const WHEAT_PICKED = 0x2c;
const TILE_CHEST = 0x01;
const TILE_BLOOD = 0x1f;

function defs(): EnemyDef[] {
  return buildEnemyDefs(data, additionalFlags);
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}

interface ArenaPriv {
  lootLayer: Map<string, number>;
  chestContents: Map<string, number>;
  lootPiles: Map<string, { id: number; qty: number; category: string }[]>;
  liveTiles: number[][];
}

/** Arena estándar (mismo arnés que combat-jspy-121): party + 1 araña, semilla fija. */
function arena(seed: number, map: CombatMapData = combatMaps[0]!): {
  c: Combat;
  state: GameState;
  priv: ArenaPriv;
  actor: NonNullable<Combat["currentUnit"]>;
  cell: { x: number; y: number };
} {
  const state = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  const spider = defs().find((e) => e.name === "Giant Spider")!;
  const c = new Combat({
    map,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: spider, count: 1 }],
    seed,
    state,
    defenseValues: data.defenseValues,
  });
  const actor = c.currentUnit!;
  expect(actor.kind).toBe("player");
  const priv = c as unknown as ArenaPriv;
  return { c, state, priv, actor, cell: { x: actor.x + 1, y: actor.y } };
}

function texts(ev: CombatEvent[]): string[] {
  return ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");
}
function tookTurn(ev: CombatEvent[]): boolean {
  return ev.some((e) => e.kind === "turn" || e.kind === "ended");
}
/** Semilla final de un gemelo que consume `draws` tiradas derivadas y hace Pass. */
function twinSeedAfter(seed: number, draws: [number, number][]): number {
  const { c } = arena(seed);
  for (const [lo, hi] of draws) c.rng.randRange(lo, hi);
  c.playerPass();
  return c.finalSeed;
}

const SEED = 0x1234;

describe("#375 antorcha de pared en la arena — fallback por tile de cmd_get (SJOG 0x19e8)", () => {
  it("0xB0: 'Borrowed!' + tile→0x44 + torchTurns=100, turno consumido, CERO rand", () => {
    const { c, state, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = RIGHT_SCONCE;
    state.torchTurns = 0;
    const ev = c.playerGet("east");
    expect(texts(ev)).toContain("Borrowed!"); // DS 0x8de8
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(BRICK_FLOOR); // 0x19f3
    expect(state.torchTurns).toBe(0x64); // 0x1a05
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, [])); // stream intacto
  });

  it("0xB1 y torchTurns=200 previo: ASIGNA 100 (0x1a05 es mov, no add ni max)", () => {
    const { c, state, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = LEFT_SCONCE;
    state.torchTurns = 200;
    const ev = c.playerGet("east");
    expect(texts(ev)).toContain("Borrowed!");
    expect(state.torchTurns).toBe(0x64); // ni 300 (add) ni 200 (max)
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(BRICK_FLOOR);
  });

  it("sin gate de dirección: la antorcha se descuelga también hacia el norte", () => {
    const { c, state, priv, actor } = arena(SEED);
    priv.liveTiles[actor.y - 1]![actor.x] = LEFT_SCONCE;
    state.torchTurns = 0;
    const ev = c.playerGet("north");
    expect(texts(ev)).toContain("Borrowed!"); // 0x19e8 no mira g_cmb_scratch
    expect(state.torchTurns).toBe(0x64);
  });

  it("sin karma ni comida: la antorcha no toca ninguno (salta directa al exit 0x1b2e)", () => {
    const { c, state, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = RIGHT_SCONCE;
    const karma0 = state.karma;
    const food0 = state.food;
    c.playerGet("east");
    expect(state.karma).toBe(karma0);
    expect(state.food).toBe(food0);
  });

  it("PILA de botín sobre la celda-antorcha: el barrido de objetos gana (0x193d antes de 0x19c0) — recoge la pieza, la antorcha queda", () => {
    const { c, state, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = RIGHT_SCONCE;
    priv.lootPiles.set(`${cell.x}:${cell.y}`, [{ id: 2, qty: 5, category: "gold" }]);
    state.torchTurns = 0;
    const ev = c.playerGet("east");
    expect(texts(ev).join("")).toContain("gold"); // la pieza, no la antorcha
    expect(texts(ev)).not.toContain("Borrowed!");
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(RIGHT_SCONCE); // intacta
    expect(state.torchTurns).toBe(0);
  });

  it("COFRE sobre la celda-antorcha: 'Open it first!' (0x1482) — el fallback no llega a correr", () => {
    const { c, state, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = RIGHT_SCONCE;
    priv.lootLayer.set(`${cell.x}:${cell.y}`, TILE_CHEST);
    priv.chestContents.set(`${cell.x}:${cell.y}`, 0x08);
    state.torchTurns = 0;
    const ev = c.playerGet("east");
    expect(texts(ev)).toContain("Open it first!");
    expect(state.torchTurns).toBe(0);
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(RIGHT_SCONCE);
  });

  it("DECORADO (#353) sobre suelo normal: sigue 'Nothing to get!' — el fallback lee el TERRENO bajo el decorado", () => {
    const { c, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = BRICK_FLOOR;
    priv.lootLayer.set(`${cell.x}:${cell.y}`, TILE_BLOOD); // mancha 0x1F: no casa el barrido
    const ev = c.playerGet("east");
    expect(texts(ev)).toContain("Nothing to get!"); // 0x1b28 — la guarda de cabos-353 no se mueve
    expect(tookTurn(ev)).toBe(true);
  });

  it("DECORADO sobre celda-antorcha: 'Borrowed!' — el decorado no corta el paso al tile (0x196a-0x197d no lo acepta)", () => {
    const { c, state, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = LEFT_SCONCE;
    priv.lootLayer.set(`${cell.x}:${cell.y}`, TILE_BLOOD);
    state.torchTurns = 0;
    const ev = c.playerGet("east");
    expect(texts(ev)).toContain("Borrowed!");
    expect(state.torchTurns).toBe(0x64);
  });

  it("cue: 'Borrowed!' → torch-borrowed (glide 0x842e incondicional en arena); control: 'Nothing to get!' → null", () => {
    expect(sfxForCombatEvent({ kind: "message", text: "Borrowed!" })).toEqual({ id: "torch-borrowed" });
    expect(sfxForCombatEvent({ kind: "message", text: "Nothing to get!" })).toBeNull();
  });
});

describe("#375 platos y trigo en la arena — mismas ramas del switch (0x1a2a/0x1a6a/0x1aca)", () => {
  it("plato 0x9A con dy=+1 (south): 'Mmmmm...!' + tile→0x95 + comida+1 + karma−1, CERO rand", () => {
    const { c, state, priv, actor } = arena(SEED);
    priv.liveTiles[actor.y + 1]![actor.x] = FOOD_TOP;
    const food0 = state.food;
    state.karma = 10;
    const ev = c.playerGet("south");
    expect(texts(ev)).toContain("Mmmmm...!"); // DS 0x8e04
    expect(priv.liveTiles[actor.y + 1]![actor.x]).toBe(TABLE_MIDDLE); // 0x1a7b
    expect(state.food).toBe(food0 + 1);
    expect(state.karma).toBe(9); // 0x1a62
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, []));
  });

  it("plato 0x9A de lado (dy=0): 'Can't reach plate!' — y el turno SE CONSUME (funnel 0x05b0), tile y comida intactos", () => {
    const { c, state, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = FOOD_TOP;
    const food0 = state.food;
    const ev = c.playerGet("east"); // dy=0: el gate 0x1a6a no casa
    expect(texts(ev)).toContain("Can't reach plate!"); // DS 0x8e10
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(FOOD_TOP);
    expect(state.food).toBe(food0);
    expect(tookTurn(ev)).toBe(true); // ≠ overworld: la arena consume igual
  });

  it("plato doble 0x9C: lateral vetado (dx=±1); dy=−1 se lleva la mitad baja y DEJA 0x9A (0x1af6-0x1b01)", () => {
    const { c, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = FOOD_BOTH;
    expect(texts(c.playerGet("east"))).toContain("Can't reach plate!"); // dx=1 (0x1aca)
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(FOOD_BOTH);
    // Segundo turno del MISMO combate: gira el turno hasta volver a un PJ.
    const again = arena(SEED);
    again.priv.liveTiles[again.actor.y - 1]![again.actor.x] = FOOD_BOTH;
    const ev = again.c.playerGet("north"); // dy=−1
    expect(texts(ev)).toContain("Mmmmm...!"); // DS 0x8e58
    expect(again.priv.liveTiles[again.actor.y - 1]![again.actor.x]).toBe(FOOD_TOP); // deja la ALTA
  });

  it("karma 0 se queda en 0 (gate 0x1a58 `jne`) y la comida clava el cap 9999 (0x270f)", () => {
    const { c, state, priv, actor } = arena(SEED);
    priv.liveTiles[actor.y + 1]![actor.x] = FOOD_TOP;
    state.karma = 0;
    state.food = 9999;
    c.playerGet("south");
    expect(state.karma).toBe(0);
    expect(state.food).toBe(9999); // counter_add con cap, no ++
  });

  it("trigo 0x2D: 'Crops picked!' + tile→0x2C (rama 0x1a2a, calcada por ser el mismo switch)", () => {
    const { c, state, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = WHEAT;
    const food0 = state.food;
    const ev = c.playerGet("east");
    expect(texts(ev)).toContain("Crops picked!"); // DS 0x8df4
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(WHEAT_PICKED); // 0x1a35
    expect(state.food).toBe(food0 + 1);
  });
});

describe("#375 población en crudo y testigo del dato real", () => {
  it("censo combatmaps.json: 24/128 mapas con 0xB0/0xB1 (todos dungeon) y UN 0x9A (dungeon registro 111 en (8,5))", () => {
    const withSconce: [string, number][] = [];
    const plates: [string, number, number, number][] = [];
    for (const m of combatMaps) {
      let n = 0;
      m.tiles.forEach((row, y) =>
        row.forEach((t, x) => {
          if (t === RIGHT_SCONCE || t === LEFT_SCONCE) n++;
          if (t === FOOD_TOP || t === FOOD_BOTTOM || t === FOOD_BOTH || t === WHEAT)
            plates.push([m.territory, m.index, x, y]);
        }),
      );
      if (n > 0) withSconce.push([m.territory, m.index]);
    }
    expect(combatMaps.length).toBe(128);
    expect(withSconce.length).toBe(24);
    expect(withSconce.every(([t]) => t === "dungeon")).toBe(true);
    expect(withSconce.map(([, i]) => i)).toEqual([
      3, 8, 9, 15, 32, 33, 34, 35, 36, 37, 40, 48, 49, 50, 53, 54, 55, 56, 57, 60, 63, 89, 90, 111,
    ]);
    expect(plates).toEqual([["dungeon", 111, 8, 5]]); // el ÚNICO plato; cero 0x9B/0x9C/0x2D
  });

  it("testigo real — dungeon registro 111: antorcha (2,2) descolgada desde el suelo (3,2)", () => {
    const room = combatMaps.find((m) => m.territory === "dungeon" && m.index === 111)!;
    // Dato en crudo del mapa (guarda del testigo): 0xB1 en (2,2), suelo en (3,2).
    expect(room.tiles[2]![2]).toBe(LEFT_SCONCE);
    expect(room.tiles[2]![3]).toBe(BRICK_FLOOR);

    const t1 = arena(SEED, room);
    t1.actor.x = 3;
    t1.actor.y = 2;
    t1.state.torchTurns = 0;
    expect(texts(t1.c.playerGet("west"))).toContain("Borrowed!");
    expect(t1.priv.liveTiles[2]![2]).toBe(BRICK_FLOOR);
    expect(t1.state.torchTurns).toBe(0x64);
  });

  it("el plato real de registro 111 es INALCANZABLE: getdir 0x35EC sólo da W/E/N/S y sus 4 vecinos cardinales son mesa impasable", () => {
    const room = combatMaps.find((m) => m.territory === "dungeon" && m.index === 111)!;
    expect(room.tiles[5]![8]).toBe(FOOD_TOP); // el plato existe (8,5)…
    // …pero (8,4)/(8,6)/(7,5)/(9,5) son los tiles de mesa del asm (impasables):
    expect(room.tiles[4]![8]).toBe(0x92);
    expect(room.tiles[6]![8]).toBe(0x90);
    expect(room.tiles[5]![7]).toBe(0x94);
    expect(room.tiles[5]![9]).toBe(0x96);
    // (0x35EC @0x3600-0x3616: sólo códigos 1-4; deltas 0x3650-0x3687 = puras
    // cardinales. Un Get diagonal NO existe en 1988 — el gate dy==+1 del plato
    // jamás se satisface desde una celda pisable de este mapa.)
  });
});
