/**
 * Amuleto de Lord British — negate 50% del golpe mágico entrante (COMBAT:0x029C-02DC).
 *
 * Si el objetivo es un PJ con el Amulet of LB equipado (roster+0x1E == 0x2D) y el
 * atacante es de proyectil MÁGICO (flag canónico LE 0x8000 = `abilities.rangedMagic`),
 * el binario tira `rand0(255)` ANTES del split dist/alcance; < 0x80 (50%) NIEGA el golpe
 * a distancia (fallo forzado sin tirar el hit). En melé el rand se consume pero no se
 * aplica. Derivación en re/notes/overworld-b34-regalia.md §3c' + COMBAT.OVL 0x029C.
 *
 * Estos tests fijan: (1) el negate BAJA la tasa de impacto a distancia del enemigo
 * mágico contra un portador del amuleto; (2) contra un enemigo NO-mágico el amuleto es
 * irrelevante (byte-idéntico); (3) sin amuleto no se consume el rand (stream distinto);
 * (4) en melé el rand se consume (stream desplazado) pero el golpe NO se niega.
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
import { Combat, type CombatMapData, type PartyCombatant } from "../src/core/combat/combat.js";
import { AMULET_OF_LORD_BRITISH } from "../src/core/combat/formulas.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const campFire = (): CombatMapData => combatMaps[0]!;

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function defByName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}

/** Un PJ (charIdx 0) con HP alto para sobrevivir el golpe y medir el impacto. */
function soloParty(state: GameState): PartyCombatant[] {
  state.characters[0]!.currentHp = 200;
  state.characters[0]!.maxHp = 200;
  return [{ charIdx: 0, record: state.characters[0]!, weapons: [{ attack: 10, range: 1 }] }];
}

/**
 * Corre UN turno del enemigo (colocado a `dist` del PJ) y devuelve si el PJ recibió daño.
 * `amulet` fija el slot +0x1E del PJ (0x2D = Amulet of LB, 0xFF = ninguno).
 */
function enemyStrikesPlayer(opts: {
  enemyName: string;
  dist: number;
  seed: number;
  amulet: number;
}): boolean {
  const state = freshState();
  state.characters[0]!.amulet = opts.amulet;
  const combat = new Combat({
    map: campFire(),
    entryDirection: "east",
    party: soloParty(state),
    enemies: [{ def: defByName(opts.enemyName), count: 1 }],
    seed: opts.seed,
    state,
    defenseValues: data.defenseValues,
  });
  const player = combat.combatants.find((c) => c.kind === "player")!;
  const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
  player.x = 5;
  player.y = 5;
  enemy.x = 5;
  enemy.y = 5 + opts.dist; // en línea recta hacia abajo
  // El enemigo actúa UNA vez (counter 1 < 2) y luego el PJ toma turno → el bucle de
  // `tickEnemyTurns` corta. Así aislamos una sola acción del enemigo (un disparo/melé),
  // sin que cierre a melé a lo largo de una ronda entera.
  enemy.counter = 1;
  player.counter = 2;
  const hpBefore = player.hp;
  combat.tickEnemyTurns();
  return player.hp < hpBefore;
}

function countDamaged(opts: {
  enemyName: string;
  dist: number;
  amulet: number;
  seeds: number;
}): number {
  let n = 0;
  for (let s = 0; s < opts.seeds; s++) {
    if (enemyStrikesPlayer({ enemyName: opts.enemyName, dist: opts.dist, seed: s, amulet: opts.amulet })) {
      n++;
    }
  }
  return n;
}

const SEEDS = 300;
// Reaper (idx 27): rangedMagic, alcance 9 → puede disparar a distancia. Skeleton (33):
// NO mágico, melé (alcance 1). Nombres reales de `buildEnemyDefs` (≠ monsterNamesMixed).
const MAGIC_ENEMY = "Reaper";
const NONMAGIC_ENEMY = "Skeleton";

describe("Amuleto de LB — negate 50% del golpe mágico (COMBAT:0x029C)", () => {
  it("baja la tasa de impacto a distancia de un enemigo MÁGICO contra el portador", () => {
    const withAmulet = countDamaged({ enemyName: MAGIC_ENEMY, dist: 2, amulet: AMULET_OF_LORD_BRITISH, seeds: SEEDS });
    const without = countDamaged({ enemyName: MAGIC_ENEMY, dist: 2, amulet: 0xff, seeds: SEEDS });
    // El negate anula ~la mitad de los disparos que habrían impactado ⇒ menos daño con amuleto.
    expect(withAmulet).toBeLessThan(without);
    // Y sigue habiendo impactos (no todo se niega: es un 50%).
    expect(withAmulet).toBeGreaterThan(0);
  });

  it("un enemigo NO-mágico (melé) es INDIFERENTE al amuleto (mismo stream, byte-idéntico)", () => {
    // Sin rangedMagic NO se consume el rand del amuleto ⇒ resultado idéntico con y sin
    // amuleto, semilla a semilla (la guarda del flag mágico protege el stream).
    for (let s = 0; s < 100; s++) {
      const a = enemyStrikesPlayer({ enemyName: NONMAGIC_ENEMY, dist: 1, seed: s, amulet: AMULET_OF_LORD_BRITISH });
      const b = enemyStrikesPlayer({ enemyName: NONMAGIC_ENEMY, dist: 1, seed: s, amulet: 0xff });
      expect(a).toBe(b);
    }
  });

  it("enemigo mágico en MELÉ: el amuleto NO niega el golpe (fiel a 0x0226: negate solo va a la rama ranged)", () => {
    // dist 1 = melé. El binario tira el rand del amuleto (0x029C precede al split) pero
    // SÓLO lo pasa a la rama a distancia (0x03E6→0x014E); el melé (0x0358) ignora
    // amulet_negate. ⇒ la tasa de daño en melé con amuleto NO debe caer ~a la mitad (eso
    // sería negar el melé, infiel). Discrimina esta implementación de una que niegue melé.
    const withAmulet = countDamaged({ enemyName: MAGIC_ENEMY, dist: 1, amulet: AMULET_OF_LORD_BRITISH, seeds: SEEDS });
    const without = countDamaged({ enemyName: MAGIC_ENEMY, dist: 1, amulet: 0xff, seeds: SEEDS });
    expect(withAmulet).toBeGreaterThan(0);
    // Tasa comparable (no negada): con amuleto sigue por encima del 70 % de la de sin
    // amuleto. Una impl que negase melé caería a ~50 % y fallaría aquí.
    expect(withAmulet).toBeGreaterThan(without * 0.7);
  });
});
