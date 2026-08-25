/**
 * La geometría que elige el búfer nativo de la captura.
 *
 * 🔴 ESTE FICHERO EXISTE PORQUE UN MUTANTE SOBREVIVIÓ. La sonda de navegador
 * (`verify-boot-save-replay.mjs`) asevera que la captura sale a 320×200 y no a 960×600, y
 * eso caza que se elija el canvas equivocado. Pero al retirar la guarda `fx === fy` —la
 * que impide que los cuatro canvas de 8×8 del marco entren como candidatos— la sonda
 * siguió **TODA VERDE**: en la página real los candidatos se ordenan por área descendente
 * y el 320×200 llega antes que cualquier 8×8, así que el orden TAPA el fallo.
 *
 * ★★ Una guarda cuyo fallo no cambia el resultado observable no está verificada, está
 *    decorando. Y la topología que la instancia no existe en la página — así que se
 *    construye aquí, que es donde sí puede existir.
 *
 * Se prueba con objetos `{width, height}` planos y el predicado de contenido inyectado:
 * lo que se mide es la GEOMETRÍA, y no hace falta un canvas de verdad para medirla.
 */
import { describe, expect, it } from "vitest";
import { buferNativo } from "../src/ui/screenshot.js";

type C = { width: number; height: number; id?: string };
const hay = () => true;

describe("buferNativo", () => {
  it("elige el búfer nativo y no el visible (la topología real del juego)", () => {
    const nat: C = { width: 320, height: 200, id: "nativo" };
    const vis: C = { width: 960, height: 600, id: "visible" };
    const brk: C[] = [1, 2, 3, 4].map(() => ({ width: 8, height: 8, id: "brk" }));
    expect(buferNativo([...brk, nat, vis], vis, hay)?.id).toBe("nativo");
  });

  // 🔴 EL CASO QUE MATA AL MUTANTE, y que la página no puede producir: el 8×8 como ÚNICO
  // candidato. 960/8 = 120 y 600/8 = 75 son los DOS enteros, así que una guarda que sólo
  // mirase la divisibilidad de cada lado por su cuenta lo aceptaría y la captura saldría
  // de ocho píxeles del ornamento del marco.
  it("NO acepta un 8x8 aunque los dos lados dividan: el factor debe ser el MISMO", () => {
    const vis: C = { width: 960, height: 600, id: "visible" };
    const brk: C = { width: 8, height: 8, id: "brk" };
    expect(buferNativo([brk, vis], vis, hay)).toBe(null);
  });

  // 🔴 LA PIEL SIN REESCALADO: un solo canvas, que ES el visible. No hay búfer nativo que
  // buscar y no debe inventarse uno — el llamador captura el visible, que aquí ya ESTÁ a
  // resolución nativa. Es el caso degenerado de la topología, y el que rompería un
  // `buferNativo` que devolviera «el más pequeño» en vez de «el que cumple la escala».
  it("con UNA sola resolución (piel sin reescalado) devuelve null y se captura el visible", () => {
    const solo: C = { width: 640, height: 400, id: "unico" };
    expect(buferNativo([solo], solo, hay)).toBe(null);
  });

  it("y sin candidato válido devuelve null, para que el llamador caiga al visible", () => {
    const vis: C = { width: 960, height: 600, id: "visible" };
    const raro: C = { width: 700, height: 100, id: "raro" };
    expect(buferNativo([raro, vis], vis, hay)).toBe(null);
  });

  // Una piel que renderice nativo a 640×400 debe capturarse a 640×400, no a 320×200.
  it("con dos búferes válidos gana el MAYOR", () => {
    const vis: C = { width: 1280, height: 800, id: "visible" };
    const a: C = { width: 320, height: 200, id: "x4" };
    const b: C = { width: 640, height: 400, id: "x2" };
    expect(buferNativo([a, b, vis], vis, hay)?.id).toBe("x2");
  });

  // ★★ El control del OTRO filtro: sin contenido no es candidato aunque la geometría
  // cuadre. Sin este caso, `conContenido` podría borrarse y todo seguiría verde.
  it("un búfer VACÍO no es candidato aunque la escala sea exacta", () => {
    const nat: C = { width: 320, height: 200, id: "nativo" };
    const vis: C = { width: 960, height: 600, id: "visible" };
    expect(buferNativo([nat, vis], vis, () => false)).toBe(null);
  });
});
