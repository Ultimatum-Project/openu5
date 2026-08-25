/**
 * #77 — AN TYM APAGA LA INTERFERENCIA DEL TIRADOR (COMSUBS.OVL:0x09FC).
 *
 * `adjacent_attacker_interferes` (cuerpo entero, 108 B, `ret 2`) encadena SEIS guardas,
 * todas con salida 0 (= no interfiere). La quinta es el hechizo de tiempo:
 * ```
 * 0a2f  cmp byte ptr [g_time_spell], 0x54   ; 'T' = An Tym
 * 0a34  je 0xa5e                            ; → sub ax,ax (no interfiere)
 * ```
 * El clon implementaba 1, 2/3, 4 y 6 y **le faltaba la 5**. Importa porque la vía de
 * interferencia retorna ANTES de `attackWith`, o sea antes de `rollWeaponHit`: bajo An
 * Tym el clon cancelaba un disparo que el original deja volar ⇒ **una tirada menos**.
 * (`consumeAmmo` no tira dados — es aritmética de inventario con el wrap de #18.)
 *
 * ★ LOS TRES TESTS, y por qué son tres. El (a) por sí solo es SATISFACIBLE POR EL
 * ARREGLO EQUIVOCADO: un `rangedInterference` que devuelva siempre `false` lo pasa y
 * rompe la mecánica entera en silencio. Por eso el (b) es control POSITIVO y tiene su
 * propio mutante. El (c) acredita la VENTANA que la nota §4 no acotaba.
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
  type PartyCombatant,
} from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));

/** Arco (0x1a): uno de los cinco ids que el binario chequea en 0x0a6f. Literal del asm. */
const BOW = 0x1a;
/** Arma de alcance 1 y id FUERA del set — discriminante de la guarda de arma. */
const DAGGER_LIKE = 0x00;

/**
 * Escena mínima: UN tirador con arco y UN enemigo PEGADO (distancia 1) que acaba de
 * golpearle (`lastAttacker`). Es la única configuración en la que las seis guardas
 * pasan, así que cualquier verde aquí es de la guarda 5 y no de otra.
 */
function scene(state: GameState, weaponId = BOW) {
  const party: PartyCombatant[] = state.characters
    .filter((c) => c.partyStatus === 0)
    .slice(0, 1)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ id: weaponId, attack: 10, range: 3 }] }));
  const combat = new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party,
    enemies: [{ def: defs().find((d) => d.attackRange === 1)!, count: 1 }],
    seed: 555,
    state,
    defenseValues: data.defenseValues,
  });
  const shooter = combat.combatants.find((c) => c.kind === "player")!;
  const foe = combat.combatants.find((c) => c.kind === "enemy")!;
  shooter.x = 5; shooter.y = 5;
  foe.x = 6; foe.y = 5;              // adyacente: distancia euclídea 1 (guarda 6)
  shooter.lastAttacker = foe.id;      // guarda 1: te golpeó el último
  shooter.counter = 1;                // le toca al tirador
  foe.counter = 300;
  return { combat, shooter, foe };
}

const interfered = (events: { kind: string; text?: string }[]): boolean =>
  events.some((e) => e.kind === "message" && (e.text ?? "").includes("interferes!"));

describe("#77 · An Tym apaga la interferencia del tirador (COMSUBS 0x09FC guarda 5)", () => {
  it("(b) CONTROL POSITIVO — SIN hechizo la interferencia SÍ dispara", () => {
    // Sin esto, «bajo An Tym no interfiere» lo pasaría un rangedInterference roto que
    // devolviera siempre false. Este test es el que impide ese arreglo equivocado.
    const state = freshState(); // timeSpell undefined
    const { combat, shooter } = scene(state);
    expect(interfered(combat.playerAttack(shooter.x + 3, shooter.y))).toBe(true);
  });

  it("(a) bajo 'T' (An Tym) NO interfiere — 0x0a2f/0x0a34", () => {
    const state = freshState();
    state.timeSpell = "T"; // g_time_spell = 0x54
    const { combat, shooter } = scene(state);
    expect(interfered(combat.playerAttack(shooter.x + 3, shooter.y))).toBe(false);
  });

  it("(a-bis) la guarda es del valor 0x54, no de «hay hechizo»: con 'Q' SÍ interfiere", () => {
    // El binario compara contra 0x54 EXACTO. Rel Tym ('Q', 0x51) no apaga nada.
    const state = freshState();
    state.timeSpell = "Q";
    const { combat, shooter } = scene(state);
    expect(interfered(combat.playerAttack(shooter.x + 3, shooter.y))).toBe(true);
  });

  it("(c) LA VENTANA: tras cerrar su turno el actor pierde `lastAttacker` y la guarda es inerte", () => {
    // Medido en el clon: `lastAttacker` sólo lo ESCRIBEN las dos ramas de melee de
    // `enemyTurn`, y `enemyTurn` abre con `return []` bajo 'T' ⇒ con el hechizo puesto
    // nadie lo re-escribe; y `advanceTurn` lo BORRA por actor. ⇒ la divergencia sólo
    // vivía para quien fue golpeado ANTES del hechizo y aún no había cerrado turno.
    const state = freshState();
    const { combat, shooter } = scene(state);
    combat.playerAttack(shooter.x + 3, shooter.y); // consume su turno → advanceTurn
    expect(shooter.lastAttacker).toBeNull();
    // Y con el campo ya nulo, la guarda 1 corta ANTES: mismo resultado con y sin hechizo.
    shooter.counter = 1;
    const sinHechizo = interfered(combat.playerAttack(shooter.x + 3, shooter.y));
    expect(sinHechizo).toBe(false);
  });

  it("discriminante de ARMA: un id fuera del set de 0x0a6f no interfiere ni sin hechizo", () => {
    const state = freshState();
    const { combat, shooter } = scene(state, DAGGER_LIKE);
    expect(interfered(combat.playerAttack(shooter.x + 3, shooter.y))).toBe(false);
  });
});
