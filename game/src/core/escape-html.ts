/**
 * ESCAPE DE HTML — la ÚNICA copia del repo (ficha #235).
 *
 * Había tres, y divergentes: `ui/savepanel.ts` escapaba `[&<>"']` (con apóstrofe),
 * `debug/teleportPicker.ts` y `web/panel-consentimiento.ts` sólo `[&<>"]`. Tres copias de
 * una primitiva de SEGURIDAD y la que se había endurecido no era la que se copiaba — el
 * defecto no es que una esté mal hoy, es que la próxima que alguien copie será una de las
 * flojas.
 *
 * 🔴 EL APÓSTROFE NO ES DECORACIÓN. `&#39;` es lo que separa esta función de un agujero
 * cuando el valor se interpola dentro de un ATRIBUTO delimitado por comillas simples
 * (`<span title='…'>`): sin él, un `'` cierra el atributo y lo que siga es marcado. La
 * exposición viva medida por la auditoría #230 era BAJA (los innerHTML con dato de usuario
 * van por `textContent` o por la copia completa), así que esto no cerraba un XSS vivo; cierra
 * el camino por el que llegaría — p. ej. el nombre de una partida IMPORTADA, que viaja entre
 * dispositivos en un `.u5gam` (#229) y no lo escribió necesariamente quien lo carga.
 *
 * 🔴 Este módulo NO IMPORTA NADA, y así se queda. Lo usa `web/panel-consentimiento.ts`, que
 * vive en el bundle de la landing: un import aquí arrastraría a la landing todo el grafo de
 * lo que importásemos (mismo motivo que `core/save-keys.ts`).
 */

/** Tabla de sustitución. Es la fuente de la que sale el regex, para que no puedan divergir. */
const ENTIDADES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const A_ESCAPAR = new RegExp(`[${Object.keys(ENTIDADES).join("")}]`, "g");

/**
 * Escapa los cinco caracteres que dan significado a HTML, para interpolar texto en
 * `innerHTML` — incluidos los atributos con comillas simples.
 *
 * El `&` va en la tabla y se sustituye en la MISMA pasada que el resto: escapar en dos
 * recorridos (primero `&`, luego los demás) es correcto, pero al revés produce doble escape
 * (`<` → `&lt;` → `&amp;lt;`). Con un solo `replace` sobre la clase de caracteres el orden
 * deja de ser una trampa que alguien pueda reintroducir.
 */
export function escapeHtml(s: string): string {
  return s.replace(A_ESCAPAR, (ch) => ENTIDADES[ch] ?? ch);
}
