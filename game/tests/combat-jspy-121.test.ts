/**
 * #121 — (J)immy/(S)earch/(P)ush/(Y)ell EN LA ARENA.
 *
 * El motor de la arena IGNORABA en silencio cuatro comandos que el binario SÍ acepta.
 * Derivación (re/notes/combat-commands.md §J/S/P/Y): COMBAT.OVL @0x097a/0x09ac/0x0994/
 * 0x09c0 — J/S por el funnel combat_cmd 0x0544 (codes 1/4 → SJOG:0x0d4a cmd_jimmy /
 * SJOG:0x095c cmd_search), P/Y por call directo (thunks resueltos con
 * dispatch_table.stubs(): CS 0x7d0a → CMDS:0x161a cmd_push · CS 0x7d6a → CMDS:0x1418
 * cmd_yell). Los CUATRO consumen la acción SIEMPRE (funnel descarta el retorno
 * @0x05b0; P/Y jmp 0x7ba sin tocar [bp-2]; [bp-4]=1 @0x083e).
 *
 * ESPERADOS EN CRUDO (cadenas DATA.OVL y tiles del asm, no derivados del sujeto):
 *   "No Keys!\n" 0x8ad0 · "Unlocked!\n" 0x8ae6 · "Key broke!\n" 0x8ada/0x8af2/0x8b10/
 *   0x8a58/0x8a6e · "Unlocked\n" 0x8b48 (SIN '!') · "Success!\n" 0x8a64 · "No lock!\n"
 *   0x8b52 · "\nThou dost find\n" 0x892c · "no trap!\n" 0x864a · "a complex trap!\n"
 *   0x8664 · "a hidden door!\n" 0x8a48 · "nothing of note.\n" 0x86cc · "Won't budge!\n"
 *   0x4559 · "Won't budge\n" 0x4567 (SIN '!') · "Pushed!\n" 0x4547 · "Pulled!\n" 0x4550 ·
 *   "Nothing\n" 0x4531 · "\nNo effect!\n" 0x453a.
 *
 * RNG (censo #353 §6): Jimmy puerta/cepo = 1×rand(0,29); Jimmy cofre trampeado =
 * 1×rand(1,30) (cofre SIN trampa = CERO, gate 0x0bc7); Search con cofre = 1×rand(1,30)
 * (sin cofre = CERO); Push y Yell = CERO. Los asertos de stream usan un COMBATE GEMELO
 * con la misma semilla: el gemelo consume la tirada DERIVADA DEL ASM y hace Pass — si
 * las semillas finales coinciden, el sujeto tiró exactamente eso y en ese orden. El
 * control negativo (semilla ≠ la de un Pass pelado) mata al mutante que quita la tirada.
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

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

const TILE_CHEST = 0x01;
const TILE_CHEST_TRAP = 0x81;
const FLOOR = 0x44; // suelo del fill del push (CMDS 0x16e8)

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
  liveTiles: number[][];
  triggers: { sprite: number; at: { x: number; y: number }; pos1: { x: number; y: number }; pos2: { x: number; y: number } }[];
}

/** Arena estándar: party + 1 araña, semilla fija. El PJ ACTIVO del turno actúa hacia
 *  el ESTE; `actor` es SU combatiente (la iniciativa no siempre elige a characters[0])
 *  y `member` SU ficha — los stats de las tiradas se editan ahí (kernel 0x4988 rama
 *  arena: charIdx del actor de turno). */
function arena(seed: number, opts?: { roomCombat?: boolean }): {
  c: Combat;
  state: GameState;
  priv: ArenaPriv;
  actor: NonNullable<Combat["currentUnit"]>;
  member: GameState["characters"][number];
  cur: { x: number; y: number };
  cell: { x: number; y: number };
} {
  const state = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  const spider = defs().find((e) => e.name === "Giant Spider")!;
  const c = new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: spider, count: 1 }],
    seed,
    state,
    defenseValues: data.defenseValues,
    ...(opts?.roomCombat ? { roomCombat: true } : {}),
  });
  const actor = c.currentUnit!;
  expect(actor.kind).toBe("player");
  const member = state.characters[actor.charIdx!]!;
  const priv = c as unknown as ArenaPriv;
  return { c, state, priv, actor, member, cur: { x: actor.x, y: actor.y }, cell: { x: actor.x + 1, y: actor.y } };
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

describe("#121 (J)immy en la arena — SJOG:0x0d4a vía funnel code 1", () => {
  it("sin llaves: 'No Keys!' ANTES del getdir, turno consumido, CERO rand", () => {
    const { c, state } = arena(SEED);
    state.keys = 0;
    const ev = c.playerJimmy(null); // la piel no llega a pedir dirección
    expect(texts(ev)).toContain("No Keys!\n"); // DS 0x8ad0
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, [])); // stream intacto
  });

  it("puerta trabada 0xB9 con DEX 31 (> tirada máx 29): 'Unlocked!' y tile 0xB8, llave INTACTA, 1×rand(0,29)", () => {
    const { c, state, priv, member, cell } = arena(SEED);
    state.keys = 2;
    member.dexterity = 31; // dex > roll SIEMPRE (0x0de5-0x0ded)
    priv.liveTiles[cell.y]![cell.x] = 0xb9;
    const ev = c.playerJimmy("east");
    expect(texts(ev)).toContain("Unlocked!\n"); // DS 0x8ae6
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(0xb8); // tile−1 (0x0e0c-0x0e0e)
    expect(state.keys).toBe(2); // el éxito NO gasta llave
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, [[0, 29]])); // exactamente la tirada del asm
    expect(c.finalSeed).not.toBe(twinSeedAfter(SEED, [])); // control: la tirada EXISTE
  });

  it("puerta trabada con DEX 0: 'Key broke!' + llave gastada, tile intacto", () => {
    const { c, state, priv, member, cell } = arena(SEED);
    state.keys = 2;
    member.dexterity = 0; // dex > roll NUNCA
    priv.liveTiles[cell.y]![cell.x] = 0xbb;
    const ev = c.playerJimmy("east");
    expect(texts(ev)).toContain("Key broke!\n"); // DS 0x8ada
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(0xbb);
    expect(state.keys).toBe(1);
    expect(tookTurn(ev)).toBe(true);
  });

  it("cerradura mágica 0x97: SIEMPRE 'Key broke!' + llave, SIN tirada", () => {
    const { c, state, priv, member, cell } = arena(SEED);
    state.keys = 1;
    member.dexterity = 31;
    priv.liveTiles[cell.y]![cell.x] = 0x97;
    const ev = c.playerJimmy("east");
    expect(texts(ev)).toContain("Key broke!\n"); // DS 0x8af2
    expect(state.keys).toBe(0);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, [])); // 0x0e1c NO pasa por 0x6112
  });

  it("cepo 0x84 con DEX 31: tile → 0x44 y 'Unlocked' SIN '!' (DS 0x8b48, rama loc≥0x7f)", () => {
    const { c, state, priv, member, cell } = arena(SEED);
    state.keys = 1;
    member.dexterity = 31;
    priv.liveTiles[cell.y]![cell.x] = 0x84;
    const ev = c.playerJimmy("east");
    const msgs = texts(ev);
    expect(msgs).toContain("Unlocked\n"); // sin '!' — no es la 0x8ae6 de la puerta
    expect(msgs).not.toContain("Unlocked!\n");
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(0x44); // 0x0eef
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, [[0, 29]])); // 0x0e54
  });

  it("cofre SIN trampa: 'Key broke!' + llave, CERO rand (gate 0x0bc7)", () => {
    const { c, state, priv, cell } = arena(SEED);
    state.keys = 1;
    priv.lootLayer.set(`${cell.x}:${cell.y}`, TILE_CHEST);
    priv.chestContents.set(`${cell.x}:${cell.y}`, 0x08); // bit 0x80 LIMPIO
    const ev = c.playerJimmy("east");
    expect(texts(ev)).toContain("Key broke!\n"); // DS 0x8a58
    expect(state.keys).toBe(0);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, []));
  });

  it("cofre TRAMPEADO con DEX 62 (umbral 0): 'Success!' desarma — capa a cofre limpio, llave intacta, 1×rand(1,30)", () => {
    const { c, state, priv, member, cell } = arena(SEED);
    state.keys = 1;
    member.dexterity = 62; // ((0x20−62+30)&0xffff)>>1 = 0 → roll≥1 gana
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, TILE_CHEST_TRAP);
    priv.chestContents.set(key, 0x20);
    const ev = c.playerJimmy("east");
    expect(texts(ev)).toContain("Success!\n"); // DS 0x8a64
    expect(priv.lootLayer.get(key)).toBe(TILE_CHEST); // 0x0c13 and 0x7f
    expect(priv.chestContents.get(key)).toBe(0x20);
    expect(state.keys).toBe(1);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, [[1, 30]])); // 0x0bf9
  });

  it("cofre TRAMPEADO con DEX 0 y contenido 0x7f (umbral 78 > roll máx 30): 'Key broke!' + llave, trampa VIVA", () => {
    const { c, state, priv, member, cell } = arena(SEED);
    state.keys = 1;
    member.dexterity = 0;
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, TILE_CHEST_TRAP);
    priv.chestContents.set(key, 0x7f);
    const ev = c.playerJimmy("east");
    expect(texts(ev)).toContain("Key broke!\n"); // DS 0x8a6e
    expect(priv.lootLayer.get(key)).toBe(TILE_CHEST_TRAP);
    expect(state.keys).toBe(0);
  });

  it("celda pelada: 'No lock!' sin llave gastada y CERO rand — y el turno se consume igual", () => {
    const { c, state, priv, cur } = arena(SEED);
    state.keys = 3;
    priv.liveTiles[cur.y]![cur.x + 1] = FLOOR;
    const ev = c.playerJimmy("east");
    expect(texts(ev)).toContain("No lock!\n"); // 0x0f16, DS 0x8b52
    expect(state.keys).toBe(3);
    expect(tookTurn(ev)).toBe(true); // funnel 0x05b0 descarta el retorno
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, []));
  });
});

describe("#121 (S)earch en la arena — SJOG:0x095c vía funnel code 4", () => {
  it("cofre TRAMPEADO (0x20, complejo) con INT 62: '\\nThou dost find\\n' + 'a complex trap!' — reporta, NO desarma; 1×rand(1,30)", () => {
    const { c, state, priv, member, cell } = arena(SEED);
    member.intelligence = 62; // umbral 0 → success; 0x20>0x14 → complex
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, TILE_CHEST_TRAP);
    priv.chestContents.set(key, 0x20);
    const ev = c.playerSearch("east");
    expect(texts(ev)).toContain("\nThou dost find\na complex trap!"); // DS 0x892c + 0x8664
    expect(priv.lootLayer.get(key)).toBe(TILE_CHEST_TRAP); // 0x02ea no escribe el pool
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, [[1, 30]])); // 0x033d
    expect(c.finalSeed).not.toBe(twinSeedAfter(SEED, []));
  });

  it("cofre SIN trampa con INT 31 (umbral 0): 'no trap!' — y la tirada se consume IGUAL", () => {
    const { c, state, priv, member, cell } = arena(SEED);
    // ⚠ INT=30 exacto, no más: el umbral no-trampeado es (30−INT)&0xffff>>1 y con
    // INT>30 la resta WRAPEA a umbral enorme (fallo siempre) — trapThreshold calca
    // el 16-bit del asm. Con 30 el umbral es 0 → roll≥1 acierta SIEMPRE.
    member.intelligence = 30;
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, TILE_CHEST);
    priv.chestContents.set(key, 0x08);
    const ev = c.playerSearch("east");
    expect(texts(ev)).toContain("\nThou dost find\nno trap!"); // DS 0x864a
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, [[1, 30]]));
  });

  it("muro con puerta oculta 0x4E (planta 0): revela 0xB9 + 'a hidden door!'; CERO rand", () => {
    const { c, state, priv, cell } = arena(SEED);
    state.position.floor = 0;
    priv.liveTiles[cell.y]![cell.x] = 0x4e;
    const ev = c.playerSearch("east");
    expect(texts(ev)).toContain("\nThou dost find\na hidden door!\n"); // 0x8a34+0x8a38 + 0x8a48
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(0xb9); // 0x0b52 (g_floor < 0x80)
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, []));
  });

  it("puerta oculta con planta 0xFF (Underworld ≥ 0x80): revela 0xB8 (SJOG 0x0b40/0x0b63)", () => {
    const { c, state, priv, cell } = arena(SEED);
    state.position.floor = 0xff;
    priv.liveTiles[cell.y]![cell.x] = 0x4e;
    c.playerSearch("east");
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(0xb8);
  });

  // ─── Rama de RESTOS (sangre 0x1F): sonda 0x0a3e→kernel 0x3702 + SJOG:0x01f2 ───
  // Las semillas están CAZADAS con un gemelo (la rama que toma cada una); los
  // ESPERADOS (mensajes DS, tipo/qty del objeto, status 'P', nº y rangos de tiradas)
  // vienen del asm, no del sujeto. El aserto de semilla-final con el gemelo mata al
  // mutante que cambia el NÚMERO o el RANGO de las tiradas (p.ej. quien haga
  // pick=rand(0,3) plano en vez de la ANIDADA rand(0,rand(0,3)) de 0x0256/0x025a
  // acierta el mensaje con seed=2 pero le falta una tirada → semilla distinta).

  it("restos, rama sabor (seed=2: r0≠0, r1≠0x13, hi=1, pick=1): 'worms!', la sangre SE CONSUME, 4 tiradas", () => {
    const { c, priv, cell } = arena(2);
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, 0x1f); // sangre (TILE_BLOOD)
    const ev = c.playerSearch("east");
    expect(texts(ev)).toContain("\nThou dost find\nworms!"); // DS 0x893e + 0x861a
    expect(priv.lootLayer.has(key)).toBe(false); // 0x0212: pool_object_write con ceros
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(2, [[0, 7], [0, 0x1f], [0, 3], [0, 1]]));
  });

  it("restos, rama sabor (seed=1: hi=3, pick=3): 'a bloody pulp!'", () => {
    const { c, priv, cell } = arena(1);
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, 0x1f);
    expect(texts(c.playerSearch("east"))).toContain("\nThou dost find\na bloody pulp!"); // DS 0x862a
    expect(c.finalSeed).toBe(twinSeedAfter(1, [[0, 7], [0, 0x1f], [0, 3], [0, 3]]));
  });

  it("restos, PLAGA (seed=18: r1==0x13): 'Plague!' + status 'P' al BUSCADOR, 2 tiradas", () => {
    const { c, priv, member, cell } = arena(18);
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, 0x1f);
    const ev = c.playerSearch("east");
    expect(texts(ev)).toContain("\nThou dost find\nPlague!"); // DS 0x893e + 0x8606
    expect(member.status).toBe("P"); // 0x0241: record+0 (0x55b3) = 0x50
    expect(priv.lootLayer.has(key)).toBe(false);
    expect(c.finalSeed).toBe(twinSeedAfter(18, [[0, 7], [0, 0x1f]]));
  });

  it("restos, TRANSFORMA (seed=41: r0==0, kindRoll==0): 'food!' — pila con {id:0xf, qty:1}, 3 tiradas", () => {
    const { c, priv, cell } = arena(41);
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, 0x1f);
    const ev = c.playerSearch("east");
    expect(texts(ev)).toContain("\nThou dost find\nfood!"); // DS 0x863a, tipo 0xf @0x02aa
    expect(priv.lootLayer.has(key)).toBe(false);
    expect(c.lootPileAt(cell.x, cell.y)).toEqual([{ id: 0xf, qty: 1, category: "food" }]); // qty rand(1,3) @0x02c6
    expect(c.finalSeed).toBe(twinSeedAfter(41, [[0, 7], [0, 3], [1, 3]]));
  });

  it("restos, TRANSFORMA (seed=52: kindRoll≠0): 'gold!' — pila con {id:2, qty:1}", () => {
    const { c, priv, cell } = arena(52);
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, 0x1f);
    expect(texts(c.playerSearch("east"))).toContain("\nThou dost find\ngold!"); // DS 0x8642, tipo 2 @0x02bc
    expect(c.lootPileAt(cell.x, cell.y)).toEqual([{ id: 2, qty: 1, category: "gold" }]);
  });

  it("un CADÁVER (0x1E) NO es un resto: la sonda devuelve 0x1e ≠ 0x1f → switch de tile, CERO rand", () => {
    const { c, priv, cell } = arena(SEED);
    const key = `${cell.x}:${cell.y}`;
    priv.lootLayer.set(key, 0x1e); // TILE_CORPSE
    priv.liveTiles[cell.y]![cell.x] = FLOOR;
    const ev = c.playerSearch("east");
    expect(texts(ev)).toContain("\nThou dost find\nnothing of note.\n");
    expect(priv.lootLayer.get(key)).toBe(0x1e); // intacto
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, []));
  });

  it("celda sin nada: prosa + 'nothing of note.' y CERO rand — turno consumido", () => {
    const { c, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = FLOOR;
    const ev = c.playerSearch("east");
    expect(texts(ev)).toContain("\nThou dost find\nnothing of note.\n"); // DS 0x8a34/0x8a38 + 0x86cc
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, []));
  });
});

describe("#121 (P)ush en la arena — CMDS:0x161a por call directo", () => {
  it("cañón 0xB4 con 0x45 detrás: 'Pushed!', REORIENTADO al este (+1 → 0xB5), fuente ← 0x45, el actor AVANZA; CERO rand", () => {
    const { c, priv, actor, cur, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = 0xb4; // clase cañón → fill 0x45
    priv.liveTiles[cell.y]![cell.x + 1] = 0x45; // la celda de detrás ES el fill
    const ev = c.playerPush("east");
    expect(texts(ev)).toContain("Pushed!\n"); // DS 0x4547
    expect(priv.liveTiles[cell.y]![cell.x + 1]).toBe(0xb5); // 0x1504: E → +1
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(0x45); // fuente ← fill
    expect(actor.x).toBe(cell.x); // 0x178a/0x17b6: entra en la celda vaciada
    expect(actor.y).toBe(cell.y);
    expect(ev.some((e) => e.kind === "moved")).toBe(true);
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, [])); // push = 0 tiradas
  });

  it("mueble 0x5B con detrás bloqueado y el actor sobre 0x44: 'Pulled!' — el objeto pasa a la celda del actor SIN reorientar y ambos se intercambian", () => {
    const { c, priv, actor, cur, cell } = arena(SEED);
    priv.liveTiles[cur.y]![cur.x] = FLOOR; // el suelo del actor ES el fill
    priv.liveTiles[cell.y]![cell.x] = 0x5b;
    priv.liveTiles[cell.y]![cell.x + 1] = 0x7f; // detrás: no-fill
    const ev = c.playerPush("east");
    expect(texts(ev)).toContain("Pulled!\n"); // DS 0x4550
    expect(priv.liveTiles[cur.y]![cur.x]).toBe(0x5b); // clase ≠ 0x90/0xB4: tal cual
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(FLOOR);
    expect(actor.x).toBe(cell.x);
  });

  it("cañón tirado (pull): orientación XOR 2 — 0xB4 tirado al este queda 0xB7 (+1^2=3)", () => {
    const { c, priv, cur, cell } = arena(SEED);
    priv.liveTiles[cur.y]![cur.x] = 0x45; // fill de cañón bajo el actor
    priv.liveTiles[cell.y]![cell.x] = 0xb4;
    priv.liveTiles[cell.y]![cell.x + 1] = 0x7f;
    c.playerPush("east");
    expect(priv.liveTiles[cur.y]![cur.x]).toBe(0xb7); // 0x1536-0x153c
  });

  it("celda objetivo con OCUPANTE del pool (la araña): 'Won't budge!' CON '!' y nadie se mueve", () => {
    const { c, priv, actor, cur, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = 0xb4;
    const spider = c.combatants.find((cc) => cc.kind === "enemy")!;
    spider.x = cell.x;
    spider.y = cell.y;
    const ev = c.playerPush("east");
    expect(texts(ev)).toContain("Won't budge!\n"); // DS 0x4559
    expect(actor.x).toBe(cur.x);
    expect(tookTurn(ev)).toBe(true);
  });

  it("tile no empujable (suelo 0x44): 'Won't budge!' — clasificador 0x14ba", () => {
    const { c, priv, cell } = arena(SEED);
    priv.liveTiles[cell.y]![cell.x] = FLOOR;
    expect(texts(c.playerPush("east"))).toContain("Won't budge!\n");
  });

  it("ni desliza ni tira (detrás ≠ fill, actor ≠ fill): 'Won't budge' SIN '!' — DS 0x4567, NO la 0x4559", () => {
    const { c, priv, cur, cell } = arena(SEED);
    priv.liveTiles[cur.y]![cur.x] = 0x05; // el suelo del actor NO es el fill
    priv.liveTiles[cell.y]![cell.x] = 0x5b;
    priv.liveTiles[cell.y]![cell.x + 1] = 0x7f;
    const msgs = texts(c.playerPush("east"));
    expect(msgs).toContain("Won't budge\n");
    expect(msgs).not.toContain("Won't budge!\n");
  });

  it("cañón con SUELO 0x44 detrás (fill del cañón es 0x45): NO desliza — el fill es por CLASE, no genérico", () => {
    const { c, priv, cur, cell } = arena(SEED);
    priv.liveTiles[cur.y]![cur.x] = 0x05;
    priv.liveTiles[cell.y]![cell.x] = 0xb4;
    priv.liveTiles[cell.y]![cell.x + 1] = FLOOR; // 0x44 ≠ 0x45
    const msgs = texts(c.playerPush("east"));
    expect(msgs).toContain("Won't budge\n");
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(0xb4);
  });

  it("placa de sala VIVA en la celda objetivo: dispara el trigger EN SILENCIO y consume el turno (COMBAT:0x111a, 2º caller)", () => {
    const { c, priv, actor, cur, cell } = arena(SEED, { roomCombat: true });
    priv.liveTiles[cell.y]![cell.x] = 0xb4;
    const dest = { x: cell.x, y: cell.y === 0 ? 1 : cell.y - 1 };
    priv.triggers.push({ sprite: 0x8f, at: { x: cell.x, y: cell.y }, pos1: dest, pos2: { x: 0xff, y: 0xff } });
    const ev = c.playerPush("east");
    expect(texts(ev)).toEqual([]); // 0x169e→0x17e6: sin mensaje
    expect(priv.liveTiles[dest.y]![dest.x]).toBe(0x8f); // la placa sembró
    expect(priv.liveTiles[cell.y]![cell.x]).toBe(0xb4); // y el empuje NO ocurrió
    expect(actor.x).toBe(cur.x);
    expect(tookTurn(ev)).toBe(true);
  });
});

describe("#121 (Y)ell en la arena — CMDS:0x1418 por call directo", () => {
  it("con palabra: '\\nNo effect!\\n' (DS 0x453a) — la palabra da igual; turno y CERO rand", () => {
    const { c } = arena(SEED);
    const ev = c.playerYell("VERAMOCOR");
    expect(texts(ev)).toContain("\nNo effect!\n");
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, []));
  });

  it("vacío/ESC: 'Nothing' (DS 0x4531) — y el turno SE CONSUME igual (retorno ignorado)", () => {
    const { c } = arena(SEED);
    const ev = c.playerYell("");
    expect(texts(ev)).toContain("Nothing\n");
    expect(tookTurn(ev)).toBe(true);
  });
});

describe("#121 cancelación del getdir (kernel 0x35EC: ESC/Space → 'Pass' y la acción se consume)", () => {
  it("playerDirCancel consume el turno sin mensaje", () => {
    const { c } = arena(SEED);
    const ev = c.playerDirCancel();
    expect(texts(ev)).toEqual([]);
    expect(tookTurn(ev)).toBe(true);
    expect(c.finalSeed).toBe(twinSeedAfter(SEED, []));
  });
});
