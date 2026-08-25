/**
 * TRANSPARENCIA DE ACTORES DEL ENDGAME (#367) — asertos del modelo PURO del paso
 * (2d-bis) de la piel shader (`endgame-transp.ts`): predicado de fase, ventana de
 * suelo utilizable y elección del vecino dominante. Esperados EN CRUDO (celdas y
 * tiles literales), verificados ROJOS contra el árbol pre-fix.
 *
 * La sala de prueba calca la forma del ROOM de `endgame-frame.test.ts`: marco de
 * muro 0x4d, interior de ladrillo 0x44, esquina (0,0) transparente 0xff.
 */
import { describe, expect, it } from "vitest";
import {
  ENDGAME_GATE_CELL,
  endgameActorFloor,
  endgameActorUnderOverlay,
  endgameFloorWindow,
  endgameTranspActive,
} from "../src/skin/shader/endgame-transp.js";
import { isFloorUnderlayCandidate } from "../src/skin/shader/contour-transp.js";
import type { EndgameSceneView } from "../src/skin/api.js";

const N = 11;
const ROOM: number[][] = Array.from({ length: N }, (_, r) =>
  Array.from({ length: N }, (_, c) =>
    r === 0 || r === N - 1 || c === 0 || c === N - 1 ? (r === 0 && c === 0 ? 0xff : 0x4d) : 0x44,
  ),
);

/** Escena base: fase de sala con LB en su celda del guión (LB_THRONE (5,3), tile 0x17c). */
const scene = (over: Partial<EndgameSceneView> = {}): EndgameSceneView => ({
  phase: "dialogue",
  room: ROOM,
  actors: [{ tile: 0x17c, col: 5, row: 3 }],
  ...over,
});

describe("endgameTranspActive — predicado de fase del paso (2d-bis)", () => {
  it("activa en las 4 fases de SALA (los actores llegan horneados con su cuadrado)", () => {
    for (const p of ["greenScene", "dialogue", "orbMoongate", "terminalPrison"] as const) {
      expect(endgameTranspActive(scene({ phase: p }))).toBe(true);
    }
  });

  it("declina en dissolve y en las fases de pantalla completa (el dissolve viaja en el recorte pleno)", () => {
    for (const p of ["dissolve", "storyHouse", "storyDream", "scroll", "terminalFreeze"] as const) {
      expect(endgameTranspActive(scene({ phase: p }))).toBe(false);
    }
  });

  it("no-op sin actores (así viaja la fase dissolve: actors=[]) y sin sala montada", () => {
    expect(endgameTranspActive(scene({ actors: [] }))).toBe(false);
    expect(endgameTranspActive(scene({ actors: undefined }))).toBe(false);
    expect(endgameTranspActive(scene({ room: null }))).toBe(false);
  });
});

describe("endgameFloorWindow — ventana de suelo utilizable de la sala", () => {
  it("esquina 0xff → -1; muro conserva su tile (lo excluye isFloorUnderlayCandidate); suelo intacto", () => {
    const tw = endgameFloorWindow(scene(), N);
    expect(tw[0]).toBe(-1); // esquina (0,0) transparente
    expect(tw[1]).toBe(0x4d); // muro: se queda con su tile…
    expect(isFloorUnderlayCandidate(0x4d)).toBe(false); // …y lo veta el filtro de suelo
    expect(isFloorUnderlayCandidate(0x44)).toBe(true); // control positivo: el ladrillo sí es suelo
    expect(tw[1 * N + 1]).toBe(0x44); // interior
  });

  it("la celda de CADA actor queda vetada (-1): sus píxeles renderizados son sprite, no suelo", () => {
    const eg = scene({
      actors: [
        { tile: 0x17c, col: 5, row: 3 },
        { tile: 0x148, col: 4, row: 6 },
      ],
    });
    const tw = endgameFloorWindow(eg, N);
    expect(tw[3 * N + 5]).toBe(-1);
    expect(tw[6 * N + 4]).toBe(-1);
  });

  it("gate (5,4) vetado SÓLO con la puerta brotada (moongate>0); orb vetado en su celda", () => {
    expect(ENDGAME_GATE_CELL).toEqual({ col: 5, row: 4 }); // la misma celda que paintEndgameOverlays
    expect(endgameFloorWindow(scene({ moongate: null }), N)[4 * N + 5]).toBe(0x44);
    expect(endgameFloorWindow(scene({ moongate: 0 }), N)[4 * N + 5]).toBe(0x44);
    const tw = endgameFloorWindow(scene({ moongate: 8, orb: { col: 5, row: 6 } }), N);
    expect(tw[4 * N + 5]).toBe(-1); // gate brotado: el overlay rojo no es suelo
    expect(tw[6 * N + 5]).toBe(-1); // orb: estallido rojo encima del suelo
  });
});

describe("endgameActorFloor — vecino de suelo dominante bajo el actor", () => {
  it("LB en (5,3) rodeado de ladrillo: suelo 0x44, celda fuente (col 6, row 3) — en crudo", () => {
    const tw = endgameFloorWindow(scene(), N);
    // Los 4 ortogonales son 0x44; la celda fuente es la ÚLTIMA contada del tile
    // dominante en orden N,S,O,E → E = (row 3, col 6).
    expect(endgameActorFloor(tw, N, 3, 5)).toEqual({ tile: 0x44, row: 3, col: 6 });
  });

  it("actor pegado al muro (1,1): el muro no cuenta; gana el ladrillo, fuente E (row 1, col 2)", () => {
    const eg = scene({ actors: [{ tile: 0x148, col: 1, row: 1 }] });
    const tw = endgameFloorWindow(eg, N);
    // N=(0,1) y O=(1,0) son muro 0x4d (vetado por el filtro); S=(2,1) y E=(1,2) son
    // 0x44 → dominante 0x44, última fuente contada = E.
    expect(endgameActorFloor(tw, N, 1, 1)).toEqual({ tile: 0x44, row: 1, col: 2 });
  });

  it("formación: dos actores adyacentes no se toman el uno al otro como suelo", () => {
    const eg = scene({
      actors: [
        { tile: 0x148, col: 4, row: 5 },
        { tile: 0x14c, col: 5, row: 5 },
      ],
    });
    const tw = endgameFloorWindow(eg, N);
    const fA = endgameActorFloor(tw, N, 5, 4)!;
    const fB = endgameActorFloor(tw, N, 5, 5)!;
    for (const f of [fA, fB]) {
      expect(f.tile).toBe(0x44);
      expect(f.col === 4 && f.row === 5).toBe(false);
      expect(f.col === 5 && f.row === 5).toBe(false);
    }
  });

  it("orbMoongate: la celda del gate brotado jamás es el «suelo» del actor que pasa al lado", () => {
    const eg = scene({ phase: "orbMoongate", moongate: 16, actors: [{ tile: 0x148, col: 5, row: 5 }] });
    const f = endgameActorFloor(endgameFloorWindow(eg, N), N, 5, 5)!;
    expect(f.tile).toBe(0x44);
    expect(f.col === ENDGAME_GATE_CELL.col && f.row === ENDGAME_GATE_CELL.row).toBe(false);
  });

  it("actor ENTRANDO al gate brotado (frame en (5,4) del timeline): bajo overlay → celda intacta", () => {
    const eg = scene({ phase: "orbMoongate", moongate: 16, actors: [{ tile: 0x17c, col: 5, row: 4 }] });
    expect(endgameActorUnderOverlay(eg, 5, 4)).toBe(true); // el gate rojo lo tapa en 1988
    expect(endgameActorUnderOverlay(eg, 5, 5)).toBe(false); // el vecino sí se recompone
    // Sin puerta brotada (aún null / etapa 0) la celda (5,4) es una celda normal.
    expect(endgameActorUnderOverlay(scene({ moongate: null }), 5, 4)).toBe(false);
    expect(endgameActorUnderOverlay(scene({ moongate: 0 }), 5, 4)).toBe(false);
    // Orb encima: mismo régimen.
    expect(endgameActorUnderOverlay(scene({ orb: { col: 5, row: 4 } }), 5, 4)).toBe(true);
  });

  it("actor rodeado de muro y compañeros → null (celda intacta: nunca pared ni negro a ciegas)", () => {
    const eg = scene({
      actors: [
        { tile: 0x148, col: 1, row: 1 },
        { tile: 0x14c, col: 2, row: 1 },
        { tile: 0x150, col: 1, row: 2 },
      ],
    });
    const tw = endgameFloorWindow(eg, N);
    expect(endgameActorFloor(tw, N, 1, 1)).toBeNull();
  });
});
