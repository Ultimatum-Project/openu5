/**
 * PASE DE STATUS POR TURNO — kernel 0x6794 (carril fix-invis; cabo declarado en
 * re/notes/muertos-combate-entrada-356.md §5, derivación en
 * re/notes/invisibilidad-pase-turno-6794.md).
 *
 * Cadena derivada (dispatch_table.py, base SJOG 0xbf80; control positivo: 0x68ae/0x6800
 * sí tienen callers cross-overlay): COMBAT:0x0b85 (cola del turno de actor de party) y
 * COMBAT:0x067c (turno auto-pasado del PJ no-activo bajo Set Active Player) → stub
 * 0x7d16 → SJOG:0x2012 (`push g_cmb_actor; call 0x6794`); tercer caller: el placer
 * 0x6936 @0x6b68 (montaje).
 *
 * Cuerpo 0x6794: gate 67aa flag 0x80 (jugador) · gate 67b0 flags 0x28 (ni dormido ni
 * caído) · 67bf anillo roster == 0x2a → tile de render ← 0x1d (67d1) + flag invisible
 * (67d8) · 67ee anillo == 0x2c → call 0x400c (regen: por miembro roster no-'D' con
 * anillo 44, rand(0,7)==7 → +1 HP cap maxHp). El pase sólo AÑADE: la rama sin anillo
 * no limpia nada (censo cerrado de escritores del bit 0x10 en los 28 .asm).
 *
 * Y el CLEAR fiel del flag en cambio de equipo: unequip_item 0x6e60 @0x6ecd sólo apaga
 * el 0x10 si lo retirado fue el anillo 42 (@0x6eeb), y NO restaura el tile de render.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  createNewGame,
  type ExtractedInitialState,
  type GameState,
} from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  type CombatMapData,
  type PartyCombatant,
} from "../src/core/combat/combat.js";
import { OriginalRng } from "../src/core/rng-original.js";

const RING_INVIS = 0x2a; // 42 — cmp 0x67bf
const RING_PROT = 0x2b; // 43 — EXENTO (ningún cmp del pase lo nombra)
const RING_REGEN = 0x2c; // 44 — cmp 0x67ee
const TILE_INVIS = 0x1d; // 67d1 mov [obj+1],0x1d
const NOTHING = 0xff;

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function byName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}
function freshState(): GameState {
  const s = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  for (const c of s.characters) {
    c.maxHp = 99;
    c.currentHp = 50; // lejos del cap: el +1 del regen es observable
  }
  return s;
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
function makeCombat(state: GameState): Combat {
  return new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: byName("Giant Spider"), count: 1 }],
    seed: 777,
    state,
    defenseValues: data.defenseValues,
  });
}
function playerOf(combat: Combat, charIdx: number) {
  const c = combat.combatants.find((u) => u.kind === "player" && u.charIdx === charIdx);
  if (!c) throw new Error(`charIdx ${charIdx} no está en la arena`);
  return c;
}
/** Avanza hasta que el turno sea del PJ charIdx (pasando los demás). */
function advanceToChar(combat: Combat, charIdx: number, guard = 400) {
  let g = 0;
  while (!combat.over && g++ < guard) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind === "player" && cur.charIdx === charIdx) return cur;
    if (cur.kind === "player") combat.playerPass();
    else combat.tickEnemyTurns();
  }
  throw new Error(`no llegó el turno del charIdx ${charIdx}`);
}

describe("0x6794 — pase de status por turno del PJ", () => {
  it("montaje (0x6936 @0x6b68): el portador del anillo 42 entra invisible con tile 0x1d", () => {
    const state = freshState();
    state.characters[0]!.ring = RING_INVIS;
    const combat = makeCombat(state);
    const c = playerOf(combat, 0);
    expect(c.invisible).toBe(true); // 67d8 or [rec+2],0x10
    expect(c.renderTile).toBe(TILE_INVIS); // 67d1 mov [obj+1],0x1d
    expect(playerOf(combat, 1).invisible).toBe(false);
  });

  it("re-aplicación al CERRAR el turno (COMBAT:0x0b85 → SJOG:0x2012): un clear externo se re-oculta", () => {
    const state = freshState();
    state.characters[0]!.ring = RING_INVIS;
    const combat = makeCombat(state);
    advanceToChar(combat, 0);
    const c = playerOf(combat, 0);
    // Simula la pérdida del flag a mitad de combate (p. ej. un escritor externo):
    c.invisible = false;
    c.renderTile = undefined;
    combat.playerPass(); // su turno termina → 0x0b85 → 0x6794 re-aplica
    expect(c.invisible).toBe(true);
    expect(c.renderTile).toBe(TILE_INVIS);
  });

  it("el pase sólo AÑADE: invisibilidad sin anillo (Sanct Lor) sobrevive al turno", () => {
    const state = freshState();
    state.characters[0]!.ring = NOTHING;
    const combat = makeCombat(state);
    advanceToChar(combat, 0);
    const c = playerOf(combat, 0);
    c.invisible = true; // Sanct Lor CAST:0x0b17 — mismo bit 0x10
    combat.playerPass();
    expect(c.invisible).toBe(true); // la rama sin-anillo de 0x6794 no limpia nada
  });

  it("anillo 43 (Protección) NO entra al pase: ni flag ni RNG (dos cmp explícitos, ninguno 0x2b)", () => {
    const state = freshState();
    state.characters[0]!.ring = RING_PROT;
    const combat = makeCombat(state);
    advanceToChar(combat, 0);
    const c = playerOf(combat, 0);
    const s0 = combat.rngSeed;
    combat.playerPass();
    expect(c.invisible).toBe(false);
    expect(c.renderTile).toBeUndefined();
    expect(combat.rngSeed).toBe(s0); // control positivo del aserto de seed del test 44
  });

  it("anillo 44: el barrido 0x400c corre al CERRAR el turno del portador — exactamente un rand(0,7), +1 HP sólo con ==7", () => {
    const state = freshState();
    state.characters[0]!.ring = RING_REGEN;
    const combat = makeCombat(state);
    advanceToChar(combat, 0);
    const c = playerOf(combat, 0);
    const s0 = combat.rngSeed;
    const hp0 = c.hp;
    const roster0 = state.characters[0]!.currentHp;
    combat.playerPass();
    // Oráculo independiente: replay del stream desde s0 (rng-original, kernel 0x2092).
    const replay = new OriginalRng(s0);
    const roll = replay.next(0, 7); // 0x403f push 7 / 0x4043 call 0x2092
    expect(combat.rngSeed).toBe(replay.getSeed()); // UN rand y ninguno más
    const esperado = roll === 7 ? 1 : 0; // 0x4046 cmp ax,7 → +1 (add_with_cap 0x3f14)
    expect(c.hp).toBe(hp0 + esperado);
    expect(state.characters[0]!.currentHp).toBe(roster0 + esperado); // 0x400c escribe el ROSTER (0x55b8)
  });

  it("Set Active Player (COMBAT:0x067c): el turno auto-pasado del no-activo ES el pase — re-aplica el anillo 42", () => {
    const state = freshState();
    state.characters[0]!.ring = RING_INVIS;
    state.activeCharacter = 1; // char0 queda no-activo: sus turnos se auto-pasan
    const combat = makeCombat(state);
    const c0 = playerOf(combat, 0);
    c0.invisible = false;
    c0.renderTile = undefined;
    // Deja girar el barrido: char0 nunca recibe turno interpelado, pero su countdown
    // dispara el auto-pase 0x067c en cada vuelta.
    let g = 0;
    while (!combat.over && g++ < 20) {
      const cur = combat.currentUnit;
      if (!cur) break;
      expect(!(cur.kind === "player" && cur.charIdx === 0)).toBe(true); // jamás interpelado
      if (cur.kind === "player") combat.playerPass();
      else combat.tickEnemyTurns();
      if (c0.invisible) break;
    }
    expect(c0.invisible).toBe(true);
    expect(c0.renderTile).toBe(TILE_INVIS);
  });

  it("gate 67b0 (flags 0x28): el DORMIDO no recibe el pase; despierto sí (control)", () => {
    const state = freshState();
    state.characters[0]!.ring = RING_INVIS;
    const combat = makeCombat(state);
    const c = playerOf(combat, 0);
    c.invisible = false;
    c.renderTile = undefined;
    c.sleeping = true;
    (combat as unknown as { perTurnStatusPass(x: unknown): void }).perTurnStatusPass(c);
    expect(c.invisible).toBe(false); // test [rec+2],0x28 → jne fin
    c.sleeping = false;
    (combat as unknown as { perTurnStatusPass(x: unknown): void }).perTurnStatusPass(c);
    expect(c.invisible).toBe(true); // control positivo del gate
  });
});

describe("syncPlayerEquip — el clear fiel de 0x6e60 (@0x6ecd-0x6eeb)", () => {
  const weapons = [{ id: 3, attack: 10, range: 1 }];

  it("retirar el anillo 42 apaga el flag y NO restaura el tile (0x6eeb no toca +1)", () => {
    const state = freshState();
    state.characters[0]!.ring = RING_INVIS;
    const combat = makeCombat(state);
    const c = playerOf(combat, 0);
    expect(c.invisible).toBe(true);
    state.characters[0]!.ring = NOTHING; // toggle-off ya aplicado en el roster
    combat.syncPlayerEquip(0, weapons, RING_INVIS); // removedItemId = [bp+4] de 0x6e60
    expect(c.invisible).toBe(false); // and [rec+2],0xef
    expect(c.renderTile).toBe(TILE_INVIS); // la silueta se QUEDA: nadie copia +0→+1
  });

  it("cambiar OTRO equipo no borra una invisibilidad de Sanct Lor (el predicado es QUÉ se retiró)", () => {
    const state = freshState();
    state.characters[0]!.ring = NOTHING;
    const combat = makeCombat(state);
    const c = playerOf(combat, 0);
    c.invisible = true; // Sanct Lor
    combat.syncPlayerEquip(0, weapons); // equipar un arma: nada retirado
    expect(c.invisible).toBe(true); // 0x6ecd cmp [bp+4],0x2a — sólo el 42 apaga
    combat.syncPlayerEquip(0, weapons, 3); // retirar un arma (id≠0x2a)
    expect(c.invisible).toBe(true);
  });

  it("equipar el anillo 42 a mitad de turno NO enciende el flag: lo hace el pase al cerrar el turno", () => {
    const state = freshState();
    state.characters[0]!.ring = NOTHING;
    const combat = makeCombat(state);
    advanceToChar(combat, 0);
    const c = playerOf(combat, 0);
    state.characters[0]!.ring = RING_INVIS; // Ready dentro del turno
    combat.syncPlayerEquip(0, weapons); // el sync NO enciende (ningún escritor lo hace aquí)
    expect(c.invisible).toBe(false);
    combat.playerPass(); // R consume el turno → 0x0b85 → 0x6794
    expect(c.invisible).toBe(true);
    expect(c.renderTile).toBe(TILE_INVIS);
  });
});
