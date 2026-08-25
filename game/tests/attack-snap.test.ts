/**
 * TOLERANCIA DEL TAP DE ATAQUE (auditoría UI/UX móvil 2026-07-25, TANDA C).
 *
 * La casilla mide 19,5 px CSS en un teléfono vertical: 10 px de error queman el turno.
 * `snapAttackCell` corrige la puntería SÓLO cuando la corrección es INEQUÍVOCA — con dos
 * candidatos no adivina, y sin candidatos deja pasar el fallo honesto del binario.
 */
import { describe, it, expect } from "vitest";
import { snapAttackCell } from "../src/ui/attack-snap.js";

describe("snapAttackCell (puntería del tap de ataque en combate)", () => {
  it("la celda tocada TIENE enemigo: no se toca nada", () => {
    const enemies = [{ x: 5, y: 5 }, { x: 8, y: 2 }];
    expect(snapAttackCell({ x: 5, y: 5 }, enemies)).toEqual({ x: 5, y: 5 });
  });

  it("EL DEFECTO: fallo de un píxel a un lado → ataca al único enemigo adyacente", () => {
    const enemies = [{ x: 5, y: 5 }];
    for (const tap of [
      { x: 4, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
      { x: 4, y: 4 }, // diagonal: el alcance melé del original son los 8 vecinos
      { x: 6, y: 6 },
    ]) {
      expect(snapAttackCell(tap, enemies), `tap en (${tap.x},${tap.y})`).toEqual({ x: 5, y: 5 });
    }
  });

  it("AMBIGUO (dos enemigos a un paso): NO adivina, va la celda tocada", () => {
    const enemies = [{ x: 4, y: 5 }, { x: 6, y: 5 }];
    expect(snapAttackCell({ x: 5, y: 5 }, enemies)).toEqual({ x: 5, y: 5 });
  });

  it("sin enemigos cerca: la celda tocada TAL CUAL (el «Nothing!» del binario intacto)", () => {
    expect(snapAttackCell({ x: 1, y: 1 }, [{ x: 9, y: 9 }])).toEqual({ x: 1, y: 1 });
    expect(snapAttackCell({ x: 1, y: 1 }, [])).toEqual({ x: 1, y: 1 });
  });

  it("a DOS casillas no hay ajuste (el radio es 1: no se teledirige el golpe)", () => {
    expect(snapAttackCell({ x: 5, y: 5 }, [{ x: 7, y: 5 }])).toEqual({ x: 5, y: 5 });
    expect(snapAttackCell({ x: 5, y: 5 }, [{ x: 5, y: 3 }])).toEqual({ x: 5, y: 5 });
  });

  it("la celda EXACTA gana siempre, aunque haya vecinos (cero ambigüedad)", () => {
    const enemies = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 6, y: 6 }];
    expect(snapAttackCell({ x: 5, y: 5 }, enemies)).toEqual({ x: 5, y: 5 });
  });

  it("no muta ni comparte referencia con la lista de objetivos", () => {
    const enemies = [{ x: 5, y: 5 }];
    const out = snapAttackCell({ x: 4, y: 5 }, enemies);
    expect(out).not.toBe(enemies[0]);
    out.x = 99;
    expect(enemies[0]).toEqual({ x: 5, y: 5 });
  });

  it("el radio es parametrizable (por si una piel quiere otra tolerancia)", () => {
    expect(snapAttackCell({ x: 5, y: 5 }, [{ x: 7, y: 5 }], 2)).toEqual({ x: 7, y: 5 });
  });

  it("radio 0 = IDENTIDAD — es como main.ts llama en ESCRITORIO (ratón exacto)", () => {
    const enemies = [{ x: 5, y: 5 }];
    expect(snapAttackCell({ x: 4, y: 5 }, enemies, 0)).toEqual({ x: 4, y: 5 });
    expect(snapAttackCell({ x: 5, y: 5 }, enemies, 0), "la celda exacta sigue valiendo").toEqual({
      x: 5,
      y: 5,
    });
  });
});
