/**
 * Task #8 — Emboscada del bucle de sueño al acampar (CMDS.OVL 0x01ee-0x030c).
 *
 * Regla EXACTA del binario (re/notes/camp-ambush-spec.md): en el bucle de sueño de
 * `camp()`, por CADA cruce de límite de hora (0x0212), el binario tira
 * `rand(0,63)==0` (0x021d, ~1/64) ANTES del helper de curación. Para `hours=N` se
 * tira N−1 veces (la última hora == target_hour sale por 0x01f3 antes del check).
 * Al acertar: elige enemigo con `rand(0,7)` (0x0239) en la tabla DS 0x1734
 * (AMBUSH_TABLE), imprime "Ambushed!" (DS 0x41e0, 0x0247), monta combate REAL con la
 * arena dedicada CampFire (vía 0x6BC2, `flags=0x0004` ⇒ flag&2=0) y RETORNA TEMPRANO
 * (0x0306 ax=1) SIN curación/gate/aparición — el reloj queda a la hora del corte.
 *
 * Tests CONDUCTUALES (camp está EXCLUIDO del set seed-exacto; el stream interno del
 * bucle diverge por diseño, deliberate-divergences.md:580): cuentan rolls y observan
 * el resultado (emboscada ~1/64 por hora + tipo + arena + early-return), no el stream.
 * El rand se scripta reemplazando `liveRng.next` (precedente: prompts-troll.test.ts).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import {
  Game,
  type CombatResources,
  type GameData,
} from "../src/core/game.js";
import { AMBUSH_TABLE } from "../src/core/world/camp.js";
import {
  buildEnemyDefs,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import { CombatMapIndex, combatMapForTile } from "../src/core/combat/index.js";
import type { CombatMapData } from "../src/core/combat/combat.js";
import type { RandFn } from "../src/core/world/survival.js";
import type { WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>(
  "../src/core/data/AdditionalEnemyFlags.json",
);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

/** Tile del overworld bajo la party = GRASS (5) → bioma Glade (≠ CampFire): así el
 *  override de arena de la emboscada es discriminable. */
const GRASS_TILE = 5;

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 30,
    maxHp: 60,
    exp: 150, // floor(150/100)=1 → sigue nivel 2 (aísla del level-up de la aparición)
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    gold: 100,
    // hora 8: acampar 8 h llega a las 16 sin cruzar medianoche → advanceClock NO
    // consume rand (sin re-sorteo de Shadowlords), así los únicos rand del camp son
    // los rolls de emboscada + la curación final.
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

/** Overworld todo GRASS (5) bajo la party. */
function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => GRASS_TILE),
  );
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps,
  enemyDefs: buildEnemyDefs(data, additionalFlags),
  attackValues: [],
  attackRangeValues: [],
  defenseValues: data.defenseValues,
};

function makeGame(s: GameState = makeState()): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
    combatResources,
  });
}

/** Reemplaza el stream vivo por un rand scriptado (campo privado `liveRng`; mismo
 *  precedente que prompts-troll.test.ts). El `rand` de Game delega en liveRng.next. */
function patchRng(g: Game, fn: RandFn): void {
  (g as unknown as { liveRng: { next: RandFn } }).liveRng.next = fn;
}

const msgs = (evs: ReturnType<Game["camp"]>): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);

describe("camp-ambush — tabla de enemigos anclada a DATA.OVL (§2.1)", () => {
  const DATA_OVL = fileURLToPath(new URL("../../original/u5/ultima5/DATA.OVL", import.meta.url));

  it("AMBUSH_TABLE coincide byte a byte con DS 0x1734 (fileoff 0x1744)", () => {
    let bytes: Buffer;
    try {
      bytes = readFileSync(DATA_OVL);
    } catch {
      // DATA.OVL no disponible en este entorno → el anclaje se verifica en CI con el
      // binario presente. No inventamos un fallback (romper circularidad).
      return;
    }
    const real = Array.from(bytes.subarray(0x1744, 0x1744 + 8));
    expect([...AMBUSH_TABLE]).toEqual(real);
    // Ancla concreta: los 8 tipos (defIndex → enemyDefs[i].name): Troll·Giant Rat×2·Bat·
    // Slime·Giant Spider·Gremlin·Headless (Giant Rat doble ⇒ 25%). Ver camp-ambush-resolution.md §1.
    expect(real).toEqual([0x29, 0x14, 0x15, 0x18, 0x16, 0x19, 0x24, 0x14]);
  });
});

describe("camp-ambush — cadencia del roll (N−1 por acampada de N h)", () => {
  it("camp(8) tira el roll de emboscada 7 veces (N−1) y, sin acertar, descansa normal", () => {
    const g = makeGame();
    let rolls = 0;
    patchRng(g, (lo, hi) => {
      if (lo === 0 && hi === 63) {
        rolls++;
        return 1; // nunca 0 → sin emboscada
      }
      if (lo === 0 && hi === 99) return 50; // gate de la aparición: ≥25 → sin aparición
      return lo; // heal/otros: valor inocuo dentro de rango
    });
    const evs = g.camp(8, -1);
    expect(rolls).toBe(7); // N−1 = 8−1
    expect(g.state.time.hour).toBe(16); // 8 + 8 h completas (nadie emboscó)
    expect(msgs(evs)).toContain("Party rested!\n");
    expect(g.combat).toBeNull();
  });

  it("camp(1) no tira ningún roll (N−1 = 0) y descansa", () => {
    const g = makeGame();
    let rolls = 0;
    patchRng(g, (lo, hi) => {
      if (lo === 0 && hi === 63) rolls++;
      if (lo === 0 && hi === 99) return 50;
      return lo;
    });
    const evs = g.camp(1, -1);
    expect(rolls).toBe(0);
    expect(msgs(evs)).toContain("Party rested!\n");
  });
});

describe("camp-ambush — el acierto interrumpe la acampada (§2/§3)", () => {
  /** Fuerza emboscada en el PRIMER cruce con índice de tabla `idx`. */
  function forceAmbush(g: Game, idx: number): void {
    patchRng(g, (lo, hi) => {
      if (lo === 0 && hi === 63) return 0; // acierta el roll (0x021d)
      if (lo === 0 && hi === 7) return idx; // índice en AMBUSH_TABLE (0x0239)
      return 0;
    });
  }

  it("imprime 'Ambushed!', arranca combate y NO descansa (sin 'Party rested!'/aparición)", () => {
    const g = makeGame();
    forceAmbush(g, 3); // idx 3 → AMBUSH_TABLE[3] = 0x18 (Slime)
    const evs = g.camp(8, -1);
    const out = msgs(evs);
    expect(out).toContain("Ambushed!\n\n");
    expect(out).not.toContain("Party rested!\n");
    expect(out).not.toContain("An apparition!\n");
    expect(g.combat).not.toBeNull();
  });

  it("el reloj queda a la hora del corte (1er cruce): +1 h, NO las 8 completas", () => {
    const g = makeGame();
    forceAmbush(g, 3);
    g.camp(8, -1);
    expect(g.state.time.hour).toBe(9); // 8 + 1 h (el cruce ganador); resto NO dormido
    expect(g.state.time.minute).toBe(0);
  });

  it("el enemigo del combate es el tipo de AMBUSH_TABLE[rand(0,7)]", () => {
    for (const idx of [0, 1, 3, 6]) {
      const g = makeGame();
      forceAmbush(g, idx);
      g.camp(8, -1);
      const enemy = g.combat?.combatants.find((c) => c.kind === "enemy");
      expect(enemy?.enemyDef?.index).toBe(AMBUSH_TABLE[idx]);
    }
  });

  it("la arena es CampFire (0), NO el bioma del terreno (Glade), override de 0x6BC2", () => {
    // El override es load-bearing: sin él, la arena sería la del bioma bajo la party.
    expect(combatMapForTile(GRASS_TILE)).not.toBe(CombatMapIndex.CampFire);
    const g = makeGame();
    forceAmbush(g, 3);
    g.camp(8, -1);
    // `mapTiles` es ahora una COPIA mutable (los triggers de sala la mutan); comparamos
    // CONTENIDO, no identidad — sigue probando que la arena es CampFire, no el bioma.
    expect(g.combat?.mapTiles).toEqual(combatMaps[CombatMapIndex.CampFire]!.tiles);
  });

  it("la party NO se cura al ser emboscada (early-return salta el helper 0x0400)", () => {
    const g = makeGame(
      makeState({ characters: [makeChar({ currentHp: 10, maxHp: 60 })], partySize: 1 }),
    );
    forceAmbush(g, 3);
    g.camp(8, -1);
    expect(g.state.characters[0]!.currentHp).toBe(10); // sin heal parcial
  });
});
