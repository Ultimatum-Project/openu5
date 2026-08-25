// @vitest-environment jsdom
/**
 * EL DUEÑO DE LA RESERVA APAISADA, CAREADO (ficha #127, ítem 4).
 *
 * ── QUÉ DEFECTO SELLA ──────────────────────────────────────────────────────────────────
 * En el layout de DOS RAÍLES la reserva del mapa la hace `layoutApaisadoCss`
 * (`skin/portrait/deck-ancho.ts:1115`, que lo dice por escrito), y `ui/touch.ts` NO debe
 * escribir `--u5-touch-reserve-x`: ahí `.touch-controls` ya no es la columna lateral sino
 * un MARCO transparente a sangre de pantalla, así que medir su caja daba la reserva =
 * VIEWPORT (844 px en un iPhone apaisado) y el panel de Partidas salía de 56 px con sus
 * controles fuera de pantalla. La geometría viva la guarda `mobile-panels.spec.ts:237`.
 *
 * ── QUÉ GUARDA ESTE FICHERO, QUE AQUÉL NO PUEDE ────────────────────────────────────────
 * El gate de `touch.ts` pregunta por una CLASE, y esa cadena está escrita DOS VECES: como
 * `UI_CLASS` en `deck-ancho.ts` (que la pone en el `<html>` y scopea con ella todas sus
 * reglas) y como `RAILS_UI_CLASS` en `touch.ts` (que la lee). No se importa una de otra
 * porque el grafo ya va en sentido contrario —`deck-ancho` → `deck-dom` → `touch`— e
 * importarla cerraría el ciclo. Repetida y sin carear, el día que alguien renombre la
 * clase el gate deja de disparar EN SILENCIO: el CSS seguiría mandando, `touch.ts`
 * volvería a escribir 844, y la suite móvil no lo vería hasta la siguiente rotación.
 * Una cita al lado de la cifra no comprueba la cifra; esto sí la carea.
 */
import { describe, it, expect } from "vitest";
import { UI_CLASS, layoutApaisadoCss } from "../src/skin/portrait/deck-ancho.js";
import { RAILS_UI_CLASS } from "../src/ui/touch.js";

describe("la reserva apaisada tiene UN dueño y el gate pregunta por ÉL", () => {
  it("las dos copias de la clase de régimen son la misma cadena", () => {
    expect(RAILS_UI_CLASS).toBe(UI_CLASS);
  });

  it("y es la clase con la que el dueño scopea sus reglas de reserva", () => {
    // No basta con que las dos constantes coincidan: podrían coincidir en un valor que el
    // CSS ya no use. El sujeto es la HOJA — que las reglas de `#app` (la reserva de los
    // dos raíles) estén efectivamente bajo esa clase.
    const css = layoutApaisadoCss();
    const reglasApp = css
      .split("\n")
      .filter((l) => l.includes("#app") && l.includes("{"))
      .map((l) => l.trim());
    expect(reglasApp.length, "reglas de reserva de #app en layoutApaisadoCss").toBeGreaterThan(0);
    for (const regla of reglasApp) {
      expect(regla, `la reserva de #app no está bajo .${UI_CLASS}`).toContain(`.${UI_CLASS}`);
    }
  });
});
