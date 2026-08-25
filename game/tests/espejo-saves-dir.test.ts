/**
 * Guarda de `e2e/espejo-tour/saves-dir.ts` — dónde escribe sus checkpoints la cadena.
 *
 * El aserto que importa es el 3º: **la env VACÍA cae al canónico**. Es el modo de fallo que
 * la función existe para evitar y el único que no se ve al leer el código: `U5_ESPEJO_SAVES_DIR=`
 * (así queda al "desactivarla" en un script) es `""`, no `undefined`, y `resolve("")` es el CWD
 * del proceso — el tour dejaría los checkpoints en `game/`, fuera de todo manifiesto y sin
 * decirlo. Los otros dos asertos son el par que hace legible al tercero: sin la env se usa el
 * canónico (control negativo) y con una ruta de verdad se usa esa (control positivo); sin ese
 * par, «cae al canónico» no distinguiría la guarda buena de una función que ignora la env.
 */
import { describe, it, expect } from "vitest";
import { resuelveSavesDir } from "../e2e/espejo-tour/saves-dir";

const CANONICO = "/repo/game/e2e/espejo-tour/saves";

describe("resuelveSavesDir", () => {
  it("sin la env usa el directorio canónico (control negativo)", () => {
    expect(resuelveSavesDir(undefined, CANONICO)).toBe(CANONICO);
  });

  it("con una ruta redirige a ella, absolutizada (control positivo)", () => {
    expect(resuelveSavesDir("/tmp/cadena-limpia/saves", CANONICO)).toBe("/tmp/cadena-limpia/saves");
    // relativa ⇒ absoluta contra el CWD, pero NUNCA el canónico: la redirección se honra
    const rel = resuelveSavesDir("saves-de-prueba", CANONICO);
    expect(rel).not.toBe(CANONICO);
    expect(rel.endsWith("/saves-de-prueba")).toBe(true);
  });

  it("★ la env VACÍA o en blanco cae al canónico, NO al CWD", () => {
    expect(resuelveSavesDir("", CANONICO)).toBe(CANONICO);
    expect(resuelveSavesDir("   ", CANONICO)).toBe(CANONICO);
    // y el testigo de que el fallo que se evita era REAL: sin el trim, `""` resolvería aquí
    expect(resuelveSavesDir("", CANONICO)).not.toBe(process.cwd());
  });
});
