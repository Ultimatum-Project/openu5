/**
 * Unit del planificador puro de descenso (e2e/grandtour/descent-planner.ts) y su paquete
 * OPT-IN fields/sceptreKey/crossRooms (carril f2b-resto; derivación canónica en
 * re/notes/wrong-campos-pasabilidad.md).
 *
 * Contrato clave: con las opciones APAGADAS el comportamiento es idéntico al planificador
 * histórico (campo 0x8 = muro, bomba = muro, sala no-goal = muro) — los capítulos ya
 * sellados planean byte-idéntico. Con el paquete: semántica FIEL del binario
 * (DUNGEON:0x05FF pisa campos sub≠3 y bombas; 0x83 rebota 0x0470/0x05d7 y el Cetro lo
 * disuelve CAST 0x1966; las salas son pasajes que se cruzan — flee-cross game.ts:5689).
 */
import { describe, expect, it } from "vitest";
import { planDungeonDescent, type DCell } from "../e2e/grandtour/descent-planner";

const W: DCell = { type: 0xb, sub: 0 }; // muro
const O: DCell = { type: 0, sub: 0 };   // pasillo

/** Planta 8×8 toda muro; se abren celdas con `open`. */
function floor(open: Array<[number, number, DCell]>): DCell[][] {
  const g: DCell[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ ...W })));
  for (const [x, y, c] of open) g[y]![x]! = { ...c };
  return g;
}
/** Mazmorra de una sola planta útil (resto muro). */
function grid(f0: DCell[][]): DCell[][][] {
  return [f0, ...Array.from({ length: 7 }, () => floor([]))];
}
const goalAt = (gx: number, gy: number) => (f: number, x: number, y: number) => f === 0 && x === gx && y === gy;

// Pasillo y0: (0,0)..(3,0) con un obstáculo en (2,0) según el caso; objetivo (3,0).
const corridorWith = (cell: DCell): DCell[][][] =>
  grid(floor([[0, 0, O], [1, 0, O], [2, 0, cell], [3, 0, O]]));

describe("descent-planner — paridad DEFAULT-OFF (modelo conservador histórico)", () => {
  it("campo 0x8 (cualquier sub) bloquea sin `fields`", () => {
    for (const sub of [0, 1, 2, 3]) {
      const p = planDungeonDescent(corridorWith({ type: 8, sub }), 0, 0, 0, goalAt(3, 0));
      expect(p, `campo sub=${sub} = muro por defecto`).toBeNull();
    }
  });
  it("bomba (trap sub&7==2) bloquea sin `fields`", () => {
    expect(planDungeonDescent(corridorWith({ type: 6, sub: 2 }), 0, 0, 0, goalAt(3, 0))).toBeNull();
  });
  it("sala 0xF no-goal bloquea sin `crossRooms`", () => {
    expect(planDungeonDescent(corridorWith({ type: 0xf, sub: 5 }), 0, 0, 0, goalAt(3, 0))).toBeNull();
  });
  it("sala 0xF GOAL sí es entrable (step-room) — comportamiento histórico intacto", () => {
    const p = planDungeonDescent(corridorWith(O), 0, 0, 0, goalAt(3, 0));
    expect(p?.map((n) => n.how)).toEqual(["step", "step", "step"]);
  });
});

describe("descent-planner — `fields` (pasabilidad FIEL, DUNGEON:0x05FF)", () => {
  it("campo sub≠3 (sueño/veneno/fuego) se PISA como step", () => {
    for (const sub of [0, 1, 2]) {
      const p = planDungeonDescent(corridorWith({ type: 8, sub }), 0, 0, 0, goalAt(3, 0), { fields: true });
      expect(p?.map((n) => n.how), `campo sub=${sub} pisable`).toEqual(["step", "step", "step"]);
    }
  });
  it("campo 0x83 EXACTO (sub 3, Energy) sigue rebotando sin sceptreKey", () => {
    expect(planDungeonDescent(corridorWith({ type: 8, sub: 3 }), 0, 0, 0, goalAt(3, 0), { fields: true })).toBeNull();
  });
  it("bomba pisable FIEL (detona y limpia) bajo el opt-in", () => {
    const p = planDungeonDescent(corridorWith({ type: 6, sub: 2 }), 0, 0, 0, goalAt(3, 0), { fields: true });
    expect(p?.map((n) => n.how)).toEqual(["step", "step", "step"]);
  });
  it("prefiere el pasillo limpio al hazard (peso 2)", () => {
    // Dos rutas a (3,1): por y0 cruzando un campo-veneno, o por y1 limpia y de igual largo.
    const g = grid(floor([[0, 0, O], [1, 0, { type: 8, sub: 1 }], [2, 0, O], [3, 0, O], [3, 1, O],
      [0, 1, O], [1, 1, O], [2, 1, O]]));
    const p = planDungeonDescent(g, 0, 0, 0, goalAt(3, 1), { fields: true });
    expect(p?.map((n) => `${n.x},${n.y}`)).toEqual(["0,1", "1,1", "2,1", "3,1"]); // ruta limpia
  });
});

describe("descent-planner — `sceptreKey` (0x83 disoluble, CAST 0x1966)", () => {
  it("0x83 se modela como transición 'sceptre' (encarar + (U)se + pisar)", () => {
    const p = planDungeonDescent(corridorWith({ type: 8, sub: 3 }), 0, 0, 0, goalAt(3, 0), { fields: true, sceptreKey: true });
    expect(p?.map((n) => n.how)).toEqual(["step", "sceptre", "step"]);
  });
  it("sin `fields` el sceptreKey NO abre nada (paquete coherente)", () => {
    expect(planDungeonDescent(corridorWith({ type: 8, sub: 3 }), 0, 0, 0, goalAt(3, 0), { sceptreKey: true })).toBeNull();
  });
  it("prefiere rodear antes que gastar cetro (peso 6)", () => {
    const g = grid(floor([[0, 0, O], [1, 0, { type: 8, sub: 3 }], [2, 0, O], [3, 0, O],
      [0, 1, O], [1, 1, O], [2, 1, O]]));
    const p = planDungeonDescent(g, 0, 0, 0, goalAt(3, 0), { fields: true, sceptreKey: true });
    expect(p?.some((n) => n.how === "sceptre")).toBe(false); // rodeó por y1
  });
});

describe("descent-planner — `crossRooms` (salas como pasajes, flee-cross fiel)", () => {
  it("sala 0xF no-goal se cruza como 'step-room-cross'", () => {
    const p = planDungeonDescent(corridorWith({ type: 0xf, sub: 5 }), 0, 0, 0, goalAt(3, 0), { crossRooms: true });
    expect(p?.map((n) => n.how)).toEqual(["step", "step-room-cross", "step"]);
  });
  it("prefiere el pasillo a cruzar sala (peso 8)", () => {
    const g = grid(floor([[0, 0, O], [1, 0, { type: 0xf, sub: 5 }], [2, 0, O], [3, 0, O],
      [0, 1, O], [1, 1, O], [2, 1, O]]));
    const p = planDungeonDescent(g, 0, 0, 0, goalAt(3, 0), { crossRooms: true });
    expect(p?.some((n) => n.how === "step-room-cross")).toBe(false);
  });
  it("la sala GOAL sigue siendo 'step-room' (no cross) con el paquete activo", () => {
    const g = grid(floor([[0, 0, O], [1, 0, O], [2, 0, { type: 0xf, sub: 5 }]]));
    const p = planDungeonDescent(g, 0, 0, 0, goalAt(2, 0), { crossRooms: true });
    expect(p?.map((n) => n.how)).toEqual(["step", "step-room"]);
  });
});
