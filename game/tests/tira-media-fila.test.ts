/**
 * LA TIRA DE MEDIA FILA — el criterio de F8, re-enunciado.
 *
 * F8 NO es «ninguna fila queda cortada»: eso es imposible (25 comandos no caben en 268 px, la
 * columna TIENE que scrollear) y además INDESEABLE (un borde a ras diría que la lista se
 * acaba ahí). F8 es **«la tira que asoma es inequívocamente parcial»**: el defecto no era el
 * resto, era su AMBIGÜEDAD — 18 px de un botón de 44 se leen como AVERÍA, media fila se lee
 * como HAY MÁS.
 *
 * La fórmula se prueba aquí en PURO. El que la tira mida lo que dice en un navegador de
 * verdad lo mide la sonda e2e, que dio 25 px = 57 % de fila en las 7 geometrías.
 */
import { describe, expect, it } from "vitest";
import { alturaDeMediaFila } from "../src/skin/portrait/deck-ancho.js";

const PASO = 50; // 44 de fila + 6 de gap, los valores vivos de `--u5cmd-fila/-gap`

/** Lo que ASOMA de la fila siguiente con un alto dado. */
const asoma = (alto: number, paso = PASO): number => alto % paso;

describe("la tira de media fila", () => {
  it("deja EXACTAMENTE media fila asomando, sea cual sea el alto disponible", () => {
    // Los cuatro altos disponibles MEDIDOS el 03-08, con sus restos originales 18/24/34/14.
    for (const disponible of [268, 224, 184, 164]) {
      const alto = alturaDeMediaFila(disponible, PASO);
      expect(asoma(alto), `disponible ${disponible}`).toBe(PASO / 2);
      expect(alto, `no puede crecer por encima de lo disponible (${disponible})`).toBeLessThanOrEqual(
        disponible,
      );
    }
  });

  it("★ barrido: para CUALQUIER alto ≥ una fila y media, la tira es media fila", () => {
    // El barrido es lo que impide que esto pase por casualidad en los cuatro casos medidos.
    for (let h = Math.ceil(PASO * 1.5); h <= 2000; h++) {
      expect(asoma(alturaDeMediaFila(h, PASO)), `alto ${h}`).toBe(PASO / 2);
    }
  });

  it("🔴 con menos de fila y media NO cuadra: recortar dejaría la lista sin un comando entero", () => {
    // El caso degenerado tiene que devolver lo disponible, no un valor menor que el paso:
    // preferimos el resto feo a una lista donde no cabe ni un botón completo.
    for (const h of [0, 10, 44, 50, 74]) {
      expect(alturaDeMediaFila(h, PASO), `alto ${h}`).toBe(h);
    }
  });

  it("no explota con paso 0 ni con alto negativo", () => {
    expect(alturaDeMediaFila(268, 0)).toBe(268);
    expect(alturaDeMediaFila(-5, PASO)).toBe(-5);
  });

  it("★ el PASO se lee de las variables, no se escribe: `50` no aparece en el sizer", () => {
    // Si alguien vuelve a escribir el paso a mano, la fórmula y la rejilla pueden divergir —
    // que es exactamente la enfermedad que le quitamos al suelo táctil el mismo día.
    // Se mira SÓLO el cuerpo del sizer, no los comentarios (que citan las cifras medidas).
    const src = readSizer();
    expect(src).toMatch(/--u5cmd-fila/);
    expect(src).toMatch(/--u5cmd-gap/);
    expect(src, "el sizer escribe un paso literal en vez de leerlo").not.toMatch(
      /const paso = \d/,
    );
  });
});

function readSizer(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { dirname, join } = require("node:path") as typeof import("node:path");
  const { fileURLToPath } = require("node:url") as typeof import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  const todo = readFileSync(
    join(here, "..", "src", "skin", "portrait", "deck-ancho.ts"),
    "utf8",
  );
  const ini = todo.indexOf("function instalaTiraDeMediaFila");
  return todo.slice(ini, todo.indexOf("\n}", ini));
}
