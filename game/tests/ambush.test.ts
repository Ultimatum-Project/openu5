/**
 * Unit de la lógica PURA de EMBOSCADA de pasillo (e2e/grandtour/descent-planner.ts): el
 * detector `isCorridorAmbush` (por TERRITORIO de la arena) y la decisión del caminante
 * `nextWalkAction`. El errante 3D (DUNGEON 0x0B7E) abre combate a mitad de la navegación
 * (arena procedural, territory "dungeon-corridor"); los helpers de nav lo resuelven y
 * RE-PLANIFICAN desde la posición real. Un combate de SALA (territory "dungeon", .CBT) NO es
 * emboscada — lo maneja conquerRoom. Ver re/notes/dungeon-wanderer.md.
 */
import { describe, expect, it } from "vitest";
import { isCorridorAmbush, nextWalkAction } from "../e2e/grandtour/descent-planner";

describe("isCorridorAmbush — detector por TERRITORIO de la arena", () => {
  it("combate en arena de PASILLO (territory dungeon-corridor) = emboscada", () => {
    expect(isCorridorAmbush({ inCombat: true, territory: "dungeon-corridor" })).toBe(true);
  });
  it("combate de SALA (.CBT, territory dungeon) NO es emboscada — lo maneja conquerRoom", () => {
    expect(isCorridorAmbush({ inCombat: true, territory: "dungeon" })).toBe(false);
  });
  it("combate de OVERWORLD (territory britannia) NO es emboscada de pasillo", () => {
    expect(isCorridorAmbush({ inCombat: true, territory: "britannia" })).toBe(false);
  });
  it("sin combate = no emboscada (territory null)", () => {
    expect(isCorridorAmbush({ inCombat: false, territory: null })).toBe(false);
  });
});

describe("isCorridorAmbush — modo LEGACY (pass-1: inCombat && inDungeon)", () => {
  it("combate de SALA DENTRO de mazmorra SÍ es emboscada en legacy (se resuelve in-situ, stream pass-1)", () => {
    expect(isCorridorAmbush({ inCombat: true, territory: "dungeon", inDungeon: true }, "legacy")).toBe(true);
  });
  it("emboscada de pasillo DENTRO de mazmorra = emboscada en legacy", () => {
    expect(isCorridorAmbush({ inCombat: true, territory: "dungeon-corridor", inDungeon: true }, "legacy")).toBe(true);
  });
  it("combate de OVERWORLD (fuera de mazmorra) NO es emboscada en legacy", () => {
    expect(isCorridorAmbush({ inCombat: true, territory: "britannia", inDungeon: false }, "legacy")).toBe(false);
  });
  it("sin combate = no emboscada en legacy", () => {
    expect(isCorridorAmbush({ inCombat: false, territory: null, inDungeon: true }, "legacy")).toBe(false);
  });
  it("DIVERGENCIA de modos: un combate de SALA es emboscada en legacy pero NO en territory", () => {
    const salaEnMazmorra = { inCombat: true, territory: "dungeon", inDungeon: true };
    expect(isCorridorAmbush(salaEnMazmorra, "legacy")).toBe(true);
    expect(isCorridorAmbush(salaEnMazmorra, "territory")).toBe(false);
  });
});

describe("nextWalkAction — decisión del caminante ambush-aware", () => {
  // `plan` de juguete: pasillo recto en x hacia el goal (un paso hacia gx a la vez).
  const straightPlan = (sx: number, sy: number, gx: number, gy: number): Array<[number, number]> | null => {
    if (sx === gx && sy === gy) return [];
    const step: [number, number] = [sx + Math.sign(gx - sx), sy];
    return [step, [gx, gy]];
  };
  const noPlan = () => null;

  it("EMBOSCADA (dungeon-corridor) tiene PRIORIDAD: resolverla antes que nada (aunque esté en el goal)", () => {
    const a = nextWalkAction({ inCombat: true, territory: "dungeon-corridor", cur: { x: 3, y: 0 }, goal: { x: 3, y: 0 } }, straightPlan);
    expect(a).toEqual({ kind: "resolveAmbush" });
  });

  it("un combate de SALA (dungeon) NO se trata como emboscada: el caminante sigue su decisión normal", () => {
    // cur en el goal → arrived (no resolveAmbush), aunque haya combate de SALA abierto.
    const a = nextWalkAction({ inCombat: true, territory: "dungeon", cur: { x: 3, y: 0 }, goal: { x: 3, y: 0 } }, straightPlan);
    expect(a).toEqual({ kind: "arrived" });
  });

  it("sin combate y EN el goal = arrived", () => {
    const a = nextWalkAction({ inCombat: false, territory: null, cur: { x: 3, y: 0 }, goal: { x: 3, y: 0 } }, straightPlan);
    expect(a).toEqual({ kind: "arrived" });
  });

  it("sin combate y con ruta = UN paso (route[0]) — re-planifica desde la posición REAL", () => {
    // Simula el post-emboscada: la party quedó en (1,0) (paso lateral 58a0), no donde iba.
    const a = nextWalkAction({ inCombat: false, territory: null, cur: { x: 1, y: 0 }, goal: { x: 3, y: 0 } }, straightPlan);
    expect(a).toEqual({ kind: "step", to: [2, 0] });
  });

  it("sin ruta (bloqueado) = noRoute", () => {
    const a = nextWalkAction({ inCombat: false, territory: null, cur: { x: 0, y: 0 }, goal: { x: 3, y: 0 } }, noPlan);
    expect(a).toEqual({ kind: "noRoute" });
  });
});
