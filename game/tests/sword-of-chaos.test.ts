/**
 * A3 — ESPADA DEL CAOS (Sword of Chaos, arma 0x23): posesión del portador.
 * COMBAT.OVL 0x0682-0x06c4: al comenzar el turno de un miembro de party que empuña 0x23
 * en mano izq (weapon) o dcha (shield) → flag 1 (charmed) + la IA lo conduce contra su
 * propio bando. Sin RNG. Ver re/notes/sword-of-chaos.md.
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
import { Combat, type CombatMapData, type PartyCombatant, type CombatEvent } from "../src/core/combat/combat.js";
import { WEAPON_CHAOS_SWORD } from "../src/core/combat/formulas.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function defs(): EnemyDef[] {
  return buildEnemyDefs(data, additionalFlags);
}
function byName(name: string): EnemyDef {
  const d = defs().find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}
function freshState(): GameState {
  const state = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  for (const c of state.characters) {
    c.currentHp = 999;
    c.maxHp = 999;
  }
  return state;
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
function makeCombat(state: GameState, enemy: EnemyDef): Combat {
  return new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: enemy, count: 1 }],
    seed: 777,
    state,
    defenseValues: data.defenseValues,
  });
}
function combatantFor(combat: Combat, charIdx: number) {
  return combat.combatants.find((c) => c.kind === "player" && c.charIdx === charIdx);
}
/** Conduce como la UI real: charmed/enemigos por IA (tickEnemyTurns), PJ normales pasan. */
function drive(combat: Combat, maxTurns: number): CombatEvent[] {
  const events: CombatEvent[] = [];
  let guard = 0;
  while (!combat.over && guard++ < maxTurns) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind === "enemy" || cur.charmed) events.push(...combat.tickEnemyTurns());
    else events.push(...combat.playerPass());
  }
  return events;
}

describe("Sword of Chaos — posesión del portador (charmed) al iniciar su turno", () => {
  it("empuñada en la mano IZQUIERDA (weapon=0x23) → el miembro queda charmed", () => {
    const state = freshState();
    state.characters[0]!.weapon = WEAPON_CHAOS_SWORD;
    const combat = makeCombat(state, byName("Giant Spider"));
    drive(combat, 30);
    expect(combatantFor(combat, 0)?.charmed).toBe(true);
  });

  it("empuñada en la mano DERECHA (shield=0x23) → el miembro queda charmed", () => {
    const state = freshState();
    state.characters[0]!.shield = WEAPON_CHAOS_SWORD;
    const combat = makeCombat(state, byName("Giant Spider"));
    drive(combat, 30);
    expect(combatantFor(combat, 0)?.charmed).toBe(true);
  });

  it("SIN la espada del caos → ningún PJ queda charmed (turno normal)", () => {
    const state = freshState();
    const combat = makeCombat(state, byName("Giant Spider"));
    drive(combat, 30);
    let jugadores = 0;
    for (const c of combat.combatants) {
      if (c.kind === "player") {
        jugadores++;
        expect(c.charmed).toBe(false);
      }
    }
    // ⚠ TESTIGO DE EXISTENCIA (auditoría ronda 2): el expect de arriba solo corre para
    // combatientes kind==='player'. Si makeCombat dejara de producirlos (regresión del
    // ARNÉS, no del código bajo prueba), este control NEGATIVO pasaría verde con cero
    // asertos ejecutados — y un control negativo que no puede fallar no controla nada.
    expect(jugadores).toBeGreaterThan(0);
  });

  it("el portador poseído ataca a su PROPIO bando (party), no a los enemigos", () => {
    const state = freshState();
    // Party ≥2: el poseído tiene a quién atacar de su antiguo bando.
    expect(party(state).length).toBeGreaterThanOrEqual(2);
    state.characters[0]!.weapon = WEAPON_CHAOS_SWORD;
    const combat = makeCombat(state, byName("Giant Spider"));
    const events = drive(combat, 120);
    const possessed = combatantFor(combat, 0)!;
    const partyIds = new Set(combat.combatants.filter((c) => c.kind === "player").map((c) => c.id));
    // Algún ataque del poseído contra un combatiente de la PARTY (amigo→enemigo).
    const friendlyFire = events.some(
      (e) => e.kind === "attacked" && e.actorId === possessed.id && e.targetId !== undefined && partyIds.has(e.targetId),
    );
    expect(friendlyFire).toBe(true);
  });

  it("una vez poseído, PERSISTE charmed en turnos sucesivos (el flag no se limpia)", () => {
    const state = freshState();
    state.characters[0]!.weapon = WEAPON_CHAOS_SWORD;
    const combat = makeCombat(state, byName("Giant Spider"));
    drive(combat, 20);
    expect(combatantFor(combat, 0)?.charmed).toBe(true);
    drive(combat, 40); // más rondas
    expect(combatantFor(combat, 0)?.charmed).toBe(true);
  });
});

describe("Regresión ch14b — el fin de combate se cuenta por BANDO (no por kind)", () => {
  it("un enemigo charmed (aliado) vacía el bando 'monsters' → VICTORIA latcheada (linger)", () => {
    const state = freshState();
    const combat = makeCombat(state, byName("Giant Spider"));
    // Charma al único enemigo → pasa al bando party; el bando 'monsters' queda vacío.
    combat.combatants.find((c) => c.kind === "enemy")!.charmed = true;
    // Avanza el bucle: al recontar por BANDO detecta el bando enemigo vacío con party viva
    // → latchea la victoria (g_cmb_victory_flag). NO cierra el combate (linger: 0x0cf6
    // fall-through); la party quedaría para salir por el borde.
    drive(combat, 4);
    expect(combat.victory).toBe(true); // el aliado charmed NO cuenta como monstruo
    expect(combat.over).toBe(false); // la victoria por sí sola NO cierra el combate
  });

  it("un PJ poseído solo (resto de party muerto) NO cuelga: se DESMAYA y vuelve al bando", () => {
    // 🔴 ESTE TEST DECÍA «CIERRA como derrota» y era la conducta DIVERGENTE (#349, 16-08).
    // El fix ch14b acertó el problema (la UI se colgaba pidiendo input a nadie, por contar
    // el fin por `kind` en vez de por BANDO) y erró el remedio: el binario no cierra, DERRIBA.
    // COMBAT:0x0cca llama a SJOG:0x21CE ANTES de imprimir la derrota — ver
    // `Combat.collapsePossessed` y possessed-passes-out-349.test.ts. Lo que este test
    // conserva es su propiedad ORIGINAL y sigue siendo cierta: el combate NO se cuelga.
    const state = freshState();
    state.characters[0]!.weapon = WEAPON_CHAOS_SWORD;
    const combat = makeCombat(state, byName("Giant Spider"));
    drive(combat, 30);
    const poseido = combatantFor(combat, 0)!;
    expect(poseido.charmed).toBe(true);
    // Simula que el poseído aniquiló a la party real: deja al último a un golpe de caer.
    const otros = combat.combatants.filter((c) => c.kind === "player" && !c.charmed);
    expect(otros.length).toBeGreaterThan(0); // testigo de existencia del arnés
    for (const c of otros) c.status = "dead";
    otros[0]!.status = "active";
    otros[0]!.hp = 1;
    // Se conduce turno a turno y se PARA en el desmayo: si se sigue, los enemigos golpean
    // al dormido y `wakeUp` (kernel 0x6800) le limpia el flag 8 — medir después mide otra cosa.
    for (let i = 0; i < 200 && !combat.over && poseido.charmed; i++) drive(combat, 1);
    // El bando 'party' se vació (el poseído luchaba para 'monsters') → 0x21CE lo derriba,
    // le quita la posesión y con ella VUELVE al bando party: ni cuelgue ni derrota.
    expect(poseido.charmed).toBe(false);
    expect(poseido.sleeping).toBe(true);
    expect(state.characters[0]!.weapon).toBe(0xff); // la espada se le cae (kernel 0x6e60)
    expect(combat.victory).toBe(false);
  });
});
