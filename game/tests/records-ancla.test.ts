/**
 * EL ANCLA: la huella canónica y la propiedad de la que depende la verificación entre pares.
 *
 * Sujeto: `demo-byo/src/records-ancla.ts`.
 *
 * ── LA PROPIEDAD QUE HAY QUE MEDIR, Y NO DAR POR SUPUESTA ───────────────────────────────
 * Un récord no lleva su estado inicial —no puede, ver `records-formato.ts`—: lleva la HUELLA
 * y el id del momento del que arranca, y quien verifica compone ese momento desde SU copia.
 * Todo eso descansa en una sola propiedad:
 *
 *     componer el mismo momento desde la misma extracción da SIEMPRE la misma huella.
 *
 * Si fuera falsa —si la composición metiera un reloj, un id aleatorio o un orden de claves
 * inestable—, dos visitantes honestos con la misma copia obtendrían huellas distintas y la
 * tabla diría «tu copia compone otro arranque» siempre. Aquí se mide, no se supone.
 *
 * ⚠ ALCANCE: se mide la COMPOSICIÓN (parche + copia → bytes → estado), que es lo que hace el
 * navegador de quien verifica. Lo que NO se mide aquí es que el ancla que graba el jugador
 * al pulsar «grabar» sea idéntica a esa composición: eso depende de lo que el juego haga
 * entre cargar la partida y empezar a grabar, y sólo se puede medir con el juego corriendo.
 * Es el cabo declarado del carril.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonizaJSON, huellaDeEstado } from "../../demo-byo/src/records-ancla.js";
import { horneaMomento, importaMomento } from "../src/momentos/compone.js";
import { momentosDisponibles } from "../src/momentos/defs.js";
import type { ExtractedInitialState } from "../src/core/state.js";

describe("forma canónica", () => {
  it("el orden de construcción de las claves NO cambia la huella", () => {
    const a = { z: 1, a: { y: 2, b: [3, 1, 2] } };
    const b = { a: { b: [3, 1, 2], y: 2 }, z: 1 };
    expect(canonizaJSON(a)).toBe(canonizaJSON(b));
  });

  it("el orden de un ARRAY sí cambia la huella: ahí el orden es dato", () => {
    expect(canonizaJSON({ v: [1, 2] })).not.toBe(canonizaJSON({ v: [2, 1] }));
  });

  it("`undefined` desaparece, como en JSON.stringify, y `null` no", () => {
    expect(canonizaJSON({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("dos estados iguales escritos al revés dan la MISMA huella", async () => {
    const uno = JSON.stringify({ gold: 100, karma: 50, position: { x: 1, y: 2 } });
    const otro = JSON.stringify({ position: { y: 2, x: 1 }, karma: 50, gold: 100 });
    expect(await huellaDeEstado(uno)).toBe(await huellaDeEstado(otro));
    // Y un estado DISTINTO da otra: la huella discrimina (control del aserto de arriba,
    // que si no pasaría igual con una función que devolviera siempre lo mismo).
    expect(await huellaDeEstado(uno)).not.toBe(
      await huellaDeEstado(JSON.stringify({ gold: 101, karma: 50, position: { x: 1, y: 2 } })),
    );
  });
});

/**
 * La composición necesita la copia del visitante (`game/assets`), que es material de EA y no
 * está en el repositorio. Sin ella el bloque se salta declarándolo — no se finge verde.
 */
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../assets");
const HAY_COPIA =
  existsSync(path.join(ASSETS, "init.gam")) && existsSync(path.join(ASSETS, "initial-state.json"));

describe.skipIf(!HAY_COPIA)("composición del ancla desde la copia del visitante", () => {
  function base(): { init: ExtractedInitialState; plantilla: Uint8Array } {
    return {
      init: JSON.parse(readFileSync(path.join(ASSETS, "initial-state.json"), "utf8")) as ExtractedInitialState,
      plantilla: new Uint8Array(readFileSync(path.join(ASSETS, "init.gam"))),
    };
  }

  it("🔴 componer el mismo momento dos veces da la MISMA huella", async () => {
    const def = momentosDisponibles()[0]!;
    const b = base();
    const uno = JSON.stringify(importaMomento(horneaMomento(def, b.init, b.plantilla)));
    // Segunda composición desde una lectura NUEVA de los ficheros: si algo dependiera del
    // objeto en memoria (una referencia compartida, una mutación in situ), aquí se vería.
    const c = base();
    const dos = JSON.stringify(importaMomento(horneaMomento(def, c.init, c.plantilla)));
    expect(await huellaDeEstado(uno)).toBe(await huellaDeEstado(dos));
  });

  it("y la huella depende del MOMENTO: dos momentos distintos no la comparten", async () => {
    const defs = momentosDisponibles();
    if (defs.length < 2) return; // hoy sólo hay uno disponible; el aserto espera al segundo
    const b = base();
    const h = await Promise.all(
      defs
        .slice(0, 2)
        .map(async (d) => huellaDeEstado(JSON.stringify(importaMomento(horneaMomento(d, b.init, b.plantilla))))),
    );
    expect(h[0]).not.toBe(h[1]);
  });
});
