/**
 * ENTRADA DE LA PORTADA (`docs/publicacion/web/home.html`).
 *
 * La portada es HTML estático que el ensamblado copia tal cual — no tiene bundler
 * propio. Este módulo se compila con el build de la demo BYO y se emite con nombre
 * FIJO (`/consentimiento.js`, ver `vite.config.ts`) para que la home pueda
 * referenciarlo con una ruta estable en vez de un nombre con hash que cambiaría en
 * cada build sin que nadie actualice el `<script>`.
 *
 * Comparte el MISMO módulo de consentimiento que /byo y que el juego: el compromiso
 * que la portada declara por escrito y el código que lo cumple son el mismo objeto.
 */
import { instalaConsentimiento } from "../../game/src/web/arranque.js";
import { EV } from "../../game/src/web/eventos.js";

// 🔴 `eventoLlegada` y no un `evento()` suelto debajo: MISMO defecto que tenía /byo y
// mismo arreglo. El suelto se emitía al cargar el módulo, o sea ANTES de que el
// visitante nuevo hubiera decidido nada, así que se descartaba — y quien luego aceptaba
// quedaba contado como consentimiento SIN visita de portada. Medido en navegador el
// 08-08-2026; la derivación completa está en `arranque.ts`.
const { panel } = instalaConsentimiento({ superficie: "portada", eventoLlegada: EV.PORTADA });

// La home tiene botón ES/EN y reescribe sus textos al vuelo. El panel trae los
// suyos, así que se repinta al cambiar de idioma — pero SÓLO si está abierto:
// reabrirlo tras haber decidido sería volver a preguntar.
window.addEventListener("openu5:lang", () => {
  if (panel.visible()) {
    panel.cierra();
    panel.abre();
  }
});
