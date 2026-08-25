/**
 * #182 D8 — el atacante CHARMED no tenía rama propia (COMBAT.OVL 0x0271 → 0x029C).
 *
 * `enemyAttack` (COMBAT:0x0226) es una sola rutina para todos los actores de IA, y su
 * PRIMERA bifurcación —antes de nada— es el bit de charmed del ATACANTE:
 *
 * ```
 * 026c: mov bx, word ptr [bp + 4] / d3e3 shl bx, cl      ← bx = idx_atacante << 3
 * 0271: test byte ptr [bx - 0x45ea], 1                   ← bit 0 = charmed
 * 0276: je 0x29c                                         ← NO charmed → flujo normal (lo citado)
 *   0278: push [bp+4] / push [bp-2] / 027e: call 0xffffdb2e   → COMSUBS.OVL:0x04D4 = distancia
 *   0281: cmp ax, 1
 *   0284: jne 0x256   → 0x256 `sub ax,ax` / `jmp 0x3ec` = RETORNA 0 sin atacar
 *   0286: mov byte ptr [g_cmb_weapon], 0x21                   ← arma FIJA (2H Sword)
 *   028b: push [bp+4] / push [bp-2] / push 0x21 / 0295: call 0xffffdb5e → COMSUBS.OVL:0x0BF8
 *   0298: jmp 0x35f   → `mov ax,1` = RETORNA 1, sin pasar por el robo de comida (0x0366)
 * ```
 *
 * ★ EL SITIO DE LA RAMA ES PARTE DEL DEFECTO: 0x0271 está ANTES de 0x029c, que es donde
 * vive el rand del amuleto de Lord British ⇒ un atacante charmed NO consume esa tirada.
 *
 * ★★ Y EL ALCANCE ES FIJO 1. `0281 cmp ax,1 / 0284 jne` ignora por completo el
 * `attackRange` del bicho: un enemigo encantado con alcance 3 NO dispara, se queda sin
 * atacar y el turno sigue al movimiento. Eso es exactamente lo que el port hacía mal —
 * `castCharm` (:2494) y los aliados invocados (:2567/:2588) conservaban su `attackRange`
 * y entraban en la vía a distancia CON su gate del 50 %, consumiendo rands que el binario
 * no tira.
 *
 * El bit ya vivía en el port (`Combatant.charmed`), y su identificación como bit 0 tiene
 * control positivo YA EN MAIN: `__parity__/combat-run.ts:289` hace `c.charmed = (rec.flags
 * & 1) !== 0`, y la Espada del Caos lo pone en 0x06b2 `or byte ptr [bx - 0x45ea], 1`.
 *
 * ⚠ ALCANCE REAL, declarado: para un PJ POSEÍDO el port ya coincidía por accidente (el
 * `reach` de un `kind:"player"` ya era 1). Lo que se arregla es el ENEMIGO encantado. Y el
 * arma 0x21 es INERTE para un atacante `kind:"enemy"` en el modelo del clon (`attackStat`
 * ignora el arma con atacante enemigo y `strike` usa su `attack` fijo) — se pasa igual
 * porque es lo derivado, y para un PJ poseído SÍ cambia el stat de acierto.
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
  type Combatant,
  type CombatEvent,
  type PartyCombatant,
} from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");

function byName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}

/** Arena 11×11 de hierba abierta con DOS slots de unidad. */
function openField(): CombatMapData {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 5));
  const s = { east: [{ x: 0, y: 5 }], west: [{ x: 0, y: 5 }], south: [{ x: 0, y: 5 }], north: [{ x: 0, y: 5 }] };
  return {
    index: 997, territory: "britannia", name: "SyntheticCharmField", tiles,
    playerStarts: s, units: [{ sprite: 0, x: 10, y: 5 }, { sprite: 0, x: 10, y: 9 }], triggers: [],
  };
}

/**
 * Dos enemigos «Mage» (alcance 7 en los defs YA CONSTRUIDOS — se comprueba en el test,
 * porque el índice crudo de `enemyAttackRange` NO casa con el nombre), para que el charmed tenga
 * a quién apuntar: un enemigo encantado lucha para la PARTY, así que su objetivo es el
 * OTRO enemigo. Sin ese segundo actor `selectTarget` devolvería null y el caso sería
 * degenerado (fuga por «sin objetivo»), no una prueba del gate.
 */
function makeCombat(seed = 7): { combat: Combat; a: Combatant; b: Combatant } {
  const state: GameState = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  const ranged = byName("Mage");
  const party: PartyCombatant[] = state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
  const combat = new Combat({
    map: openField(), entryDirection: "east", party,
    enemies: [{ def: ranged, count: 2 }],
    seed, state, defenseValues: data.defenseValues,
  });
  const es = combat.combatants.filter((c) => c.kind === "enemy");
  return { combat, a: es[0]!, b: es[1]! };
}

/** `enemyAttack` es privado: se invoca por reflexión para AISLAR la rama (sin el pacer). */
function attack(combat: Combat, actor: Combatant): CombatEvent[] | null {
  return (combat as unknown as { enemyAttack(c: Combatant): CombatEvent[] | null }).enemyAttack(actor);
}

describe("#182 D8 · atacante CHARMED (COMBAT.OVL 0x0271-0x0298)", () => {
  it("★ charmed a DISTANCIA 3 con alcance 3: NO ataca y NO consume ni una tirada (0x0284)", () => {
    const { combat, a, b } = makeCombat();
    expect(a.attackRange).toBeGreaterThanOrEqual(3); // el arnés mide lo que cree medir
    a.charmed = true;
    a.x = 2; a.y = 5;
    b.x = 5; b.y = 5; // distancia 3
    const seed = combat.rngSeed;

    expect(attack(combat, a)).toBeNull(); // 0x0284 `jne 0x256` ⇒ devuelve 0
    expect(combat.rngSeed).toBe(seed); // el gate del 50 % (0x016e) ni se roza
  });

  it("★ el MISMO actor SIN charmed a distancia 3 sí entra en la vía a distancia (control)", () => {
    // Aísla UNA guarda: idéntico tablero, idéntico alcance, sólo cambia el bit 0.
    const { combat, a, b } = makeCombat();
    a.charmed = false;
    a.x = 2; a.y = 5;
    b.x = 5; b.y = 5;
    const seed = combat.rngSeed;

    attack(combat, a);
    expect(combat.rngSeed).not.toBe(seed); // consume al menos el rand del 50 %
  });

  it("charmed a DISTANCIA 1 sí ataca (0x0295 → COMSUBS 0x0BF8)", () => {
    const { combat, a, b } = makeCombat();
    a.charmed = true;
    a.x = 4; a.y = 5;
    b.x = 5; b.y = 5; // adyacente
    expect(attack(combat, a)).not.toBeNull();
  });

  it("charmed a distancia 2 tampoco: el gate es `== 1`, no `<= reach` (0x0281)", () => {
    const { combat, a, b } = makeCombat();
    a.charmed = true;
    a.x = 3; a.y = 5;
    b.x = 5; b.y = 5;
    expect(attack(combat, a)).toBeNull();
  });

  it("control POSITIVO del instrumento: contra un PJ, la vía NORMAL sí gasta rands", () => {
    // Sin este par, el «no consume ni una tirada» del primer test podría ser verde por
    // mirar un contador que no se mueve nunca (firma de control-positivo-degenerado).
    // ⚠ Lo que NO prueba: que el charmed se salte el rand del AMULETO de 0x029C. Ese
    // caso es INALCANZABLE en el arnés — un atacante charmed lucha para la party y
    // `selectTarget` nunca le da un PJ como objetivo. La ordenación 0x0271 < 0x029c
    // queda sostenida por la LECTURA del asm, no por este fichero. Declarado.
    const { combat, a } = makeCombat();
    const player = combat.combatants.find((c) => c.kind === "player")!;
    a.charmed = false;
    const seedNormal = combat.rngSeed;
    a.x = player.x + 3; a.y = player.y;
    attack(combat, a);
    expect(combat.rngSeed).not.toBe(seedNormal);
  });
});
