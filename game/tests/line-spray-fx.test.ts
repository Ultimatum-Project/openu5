/**
 * ABANICO de hechizo de línea (carril fx-combate) — presentación del spray de
 * CAST.OVL 0x1f60→0x1c36→0x1bb0 (testigo: aulddragon Part 24, In Vas Grav Corp).
 *
 * Cubre: (a) el evento `lineSpray` que emite el core (castLineAoe) SIN tocar el
 * RNG; (b) la geometría del trazador de la piel (21 rayos, origen en el borde
 * del caster, rayo central recto, extremos a 45°, corte LOS en fila impar,
 * clip de viewport); (c) los colores EGA por modo (INTRO.OVL 0x09ee + el +8 de
 * 0x1c88).
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
import {
  traceSprayRays,
  sprayColorForMode,
  SPRAY_CURVE,
} from "../src/skin/fiel/combat.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const defs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);
const openMap = (): CombatMapData => ({
  index: -1,
  territory: "test",
  name: "test",
  tiles: Array.from({ length: 11 }, () => new Array(11).fill(5)),
  playerStarts: {
    east: [{ x: 2, y: 2 }],
    west: [{ x: 2, y: 2 }],
    north: [{ x: 2, y: 2 }],
    south: [{ x: 2, y: 2 }],
  },
  units: Array.from({ length: 16 }, (_, i) => ({ sprite: 0, x: i % 11, y: 8 + Math.floor(i / 11) })),
  triggers: [],
});
const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
const party = (state: GameState): PartyCombatant[] =>
  state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));

describe("Evento lineSpray del core (castLineAoe)", () => {
  function makeCombat(seed: number): Combat {
    const state = freshState();
    const combat = new Combat({
      map: openMap(),
      entryDirection: "east",
      party: party(state),
      enemies: [{ def: defs().find((d) => d.attackRange === 1)!, count: 1 }],
      seed,
      state,
      defenseValues: data.defenseValues,
      enemyDefs: defs(),
    });
    const caster = combat.combatants.find((c) => c.kind === "player")!;
    caster.x = 5; caster.y = 5;
    combat.combatants.forEach((c) => { c.counter = 300; });
    caster.counter = 1;
    expect(combat.currentUnit).toBe(caster);
    return combat;
  }

  it("emite lineSpray con dirección y modo ANTES de la mecánica", () => {
    const combat = makeCombat(77);
    const caster = combat.currentUnit!;
    const events = combat.playerCast(
      { kind: "lineAoe", mode: 4, len: 2 },
      { x: caster.x, y: caster.y - 1 }, // apunta al norte
    );
    const spray = events.find((e) => e.kind === "lineSpray");
    expect(spray).toBeDefined();
    expect(spray!.actorId).toBe(caster.id);
    expect(spray!.x).toBe(0);
    expect(spray!.y).toBe(-1);
    expect(spray!.mode).toBe(4);
  });

  it("NO altera el stream de RNG: mismos eventos mecánicos con y sin el evento (misma semilla)", () => {
    // Dos combates gemelos, misma semilla: los eventos mecánicos (sin lineSpray)
    // deben ser idénticos — el evento es un puro anuncio de presentación.
    const a = makeCombat(909);
    const b = makeCombat(909);
    const evA = a.playerCast({ kind: "lineAoe", mode: 4, len: 2 }, { x: 6, y: 5 });
    const evB = b.playerCast({ kind: "lineAoe", mode: 4, len: 2 }, { x: 6, y: 5 });
    expect(evA.filter((e) => e.kind !== "lineSpray")).toEqual(
      evB.filter((e) => e.kind !== "lineSpray"),
    );
    expect(evA[0]!.kind).toBe("lineSpray");
  });

  it("sin dirección (aim == celda del caster) no emite spray", () => {
    const combat = makeCombat(11);
    const caster = combat.currentUnit!;
    const events = combat.playerCast({ kind: "lineAoe", mode: 1, len: 2 }, { x: caster.x, y: caster.y });
    expect(events.some((e) => e.kind === "lineSpray")).toBe(false);
  });
});

describe("Trazador del abanico (traceSprayRays — calco 0x1c36)", () => {
  const open = () => false; // arena sin muros

  it("traza 21 rayos (la curva radial de 21 words de DATA.OVL 0x1d00)", () => {
    expect(SPRAY_CURVE).toHaveLength(21);
    const rays = traceSprayRays({ x: 5, y: 5 }, { x: 0, y: -1 }, open);
    expect(rays).toHaveLength(21);
  });

  it("norte: origen en el punto medio del borde superior del tile del caster", () => {
    const rays = traceSprayRays({ x: 5, y: 5 }, { x: 0, y: -1 }, open);
    // base tile (5,5) → px (80,80); norte: x+8 → (88,80) (0x1c84 + base 0x1c56)
    for (const ray of rays) {
      expect(ray[0]).toEqual({ x: 88, y: 80 });
    }
  });

  it("el rayo central (10, peso 2000) es RECTO; los extremos (0 y 20) son diagonales a 45°", () => {
    const rays = traceSprayRays({ x: 5, y: 5 }, { x: 0, y: -1 }, open);
    const central = rays[10]!;
    // Recto: x constante en todo el recorrido (2000/10 = 200 pasos > viewport).
    expect(new Set(central.map((p) => p.x)).size).toBe(1);
    // Llega al borde superior del viewport (y=0).
    expect(central[central.length - 1]!.y).toBe(0);
    // Extremo 0: peso 10 ⇒ paso perpendicular CADA paso de eje (45°, hacia x−).
    const r0 = rays[0]!;
    expect(r0[1]!.x - r0[0]!.x).toBe(-1);
    expect(r0[1]!.y - r0[0]!.y).toBe(-1);
    // Extremo 20: espejo (hacia x+).
    const r20 = rays[20]!;
    expect(r20[1]!.x - r20[0]!.x).toBe(1);
    expect(r20[1]!.y - r20[0]!.y).toBe(-1);
  });

  it("corte LOS: una celda opaca corta el rayo en una fila de y IMPAR (tras pintar su píxel)", () => {
    // Muro opaco en la celda (5,3) — el rayo central hacia el norte lo cruza.
    const rays = traceSprayRays(
      { x: 5, y: 5 },
      { x: 0, y: -1 },
      (cx, cy) => cx === 5 && cy === 3,
    );
    const central = rays[10]!;
    const last = central[central.length - 1]!;
    // Termina DENTRO de la celda (5,3): fila impar 63 (la primera impar al entrar
    // desde y=64 hacia arriba), píxel pintado y corte después (0x1bb0 1c03-1c2b).
    expect(last.y).toBe(63);
    expect(last.x >> 4).toBe(5);
    // Sin muro habría llegado a y=0.
    expect(central.some((p) => p.y < 48)).toBe(false);
  });

  it("clip de viewport: desde el borde, los rayos no salen de la arena (0..174)", () => {
    const rays = traceSprayRays({ x: 0, y: 0 }, { x: -1, y: 0 }, open);
    // Caster en (0,0) apuntando al oeste: origen x=0 → primer paso sale → rayos de ≤1 punto.
    for (const ray of rays) {
      expect(ray.length).toBeLessThanOrEqual(1);
      for (const p of ray) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(174);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(174);
      }
    }
  });

  it("simetría del abanico: rayos i y 20−i espejados respecto al eje (norte)", () => {
    const rays = traceSprayRays({ x: 5, y: 5 }, { x: 0, y: -1 }, open);
    const axisX = 88;
    for (let i = 0; i < 10; i++) {
      const a = rays[i]!;
      const b = rays[20 - i]!;
      expect(a.length).toBe(b.length);
      for (let k = 0; k < a.length; k++) {
        expect(a[k]!.y).toBe(b[k]!.y);
        expect(a[k]!.x - axisX + (b[k]!.x - axisX)).toBe(0);
      }
    }
  });
});

describe("Colores EGA por modo (INTRO.OVL 0x09ee + el +8 de CAST 0x1c88)", () => {
  it("In Zu=13 magenta-claro, In Nox Hur=10 verde-claro, In Flam Hur=12 rojo-claro, In Vas Grav Corp=9 azul-claro", () => {
    expect(sprayColorForMode(1)).toBe("#ff55ff");
    expect(sprayColorForMode(2)).toBe("#55ff55");
    expect(sprayColorForMode(3)).toBe("#ff5555");
    expect(sprayColorForMode(4)).toBe("#5555ff"); // el AZUL del testigo Part 24
  });
});
