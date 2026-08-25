/**
 * VISOR: la ilustración de una tarjeta, a tamaño grande, en un modal.
 *
 * UNO SOLO para las dos ilustraciones que puede tener una tarjeta — el minimapa y la
 * captura de pantalla. No son dos visores porque no hay nada distinto que hacer con
 * ellas: las dos son «una imagen que se quiere ver mayor». Lo que cambia es QUIÉN la
 * construye, y eso lo decide el llamante; aquí sólo se enmarca y se enseña.
 *
 * 🔴 `<dialog showModal()>` Y NO UN DIV, por la misma razón que `popover-replay.ts`: el
 * foco atrapado, el Escape que cierra, el `aria-modal` y el inerte del resto de la página
 * los da el navegador. Reimplementarlos a mano es donde se cuelan los fallos de
 * accesibilidad que nadie prueba, y serían míos y no del navegador.
 *
 * 🔴 UNA SOLA RUTA DE DESMONTAJE, heredada del rojo que costó descubrirla en el popover
 * de repetición: el Escape **no pasa por el botón de cerrar**, emite `close`
 * directamente. Con tres entradas (botón, fondo, Escape) y el desmontaje en una de
 * ellas, las otras dos se caen. Aquí las tres PIDEN cierre y el desmontaje vive en el
 * escuchador de `close`, que es el único sitio por el que pasan todas.
 *
 * 🔴 Y NO HAY UN SEGUNDO «CERRAR» DENTRO. También es lección del replay: allí había un ✕
 * del cromo y otro del contenido a un centímetro, haciendo cosas distintas. Aquí el
 * contenido es una imagen y no trae controles; el único cerrar es el del cromo.
 *
 * ── LO QUE ESTE MÓDULO **NO** HACE, y es deliberado ─────────────────────────────────
 * No sabe qué es un mapa ni qué es una captura, y por tanto **no importa `minimapa.ts`
 * ni nada que arrastre `TileData.json`**. Recibe un elemento ya hecho. Así este fichero
 * puede vivir en el bundle eager sin tocar el corte perezoso que vigila la sonda («la
 * tabla vive en UN chunk perezoso, no en ninguno ni en dos»): quien necesita los tiles
 * es el llamante, que ya los tenía cargados cuando pintó la tarjeta.
 */
import { txt } from "./idioma.js";
import { habilitaZoom } from "./zoom.js";

let dlg: HTMLDialogElement | null = null;

/** Pide el cierre. NO desmonta: sólo dispara `close`. Ver la cabecera. */
function cierra(): void {
  dlg?.close();
}

/** Desmontaje REAL, en el único sitio por el que pasan las tres vías de cierre. */
function desmonta(): void {
  if (!dlg) return;
  dlg.remove();
  dlg = null;
}

/**
 * Abre el visor con `contenido` dentro. `rotulo` es el nombre accesible del diálogo y
 * el título visible.
 *
 * `origen` (opcional) es el control que lo abrió: al cerrar, el foco vuelve ahí. El
 * `<dialog>` nativo ya devuelve el foco al elemento que tenía antes de `showModal()`,
 * así que esto es un cinturón para el caso en que ese elemento haya desaparecido del
 * DOM mientras el visor estaba abierto (un repintado por cambio de idioma, p. ej.).
 *
 * Idempotente en lo que importa: una segunda llamada desmonta la anterior, de modo que
 * nunca hay dos diálogos en el DOM.
 */
export function abreVisor(contenido: HTMLElement, rotulo: string, origen?: HTMLElement): void {
  desmonta();
  dlg = document.createElement("dialog");
  dlg.className = "visor";
  dlg.setAttribute("aria-label", rotulo);

  const barra = document.createElement("div");
  barra.className = "visor__barra";
  const titulo = document.createElement("strong");
  titulo.className = "visor__titulo";
  titulo.textContent = rotulo;
  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.className = "visor__cerrar";
  cerrar.textContent = txt("visorCerrar");
  cerrar.addEventListener("click", cierra);
  barra.append(titulo, cerrar);

  const marco = document.createElement("div");
  marco.className = "visor__marco";
  contenido.classList.add("visor__imagen");
  marco.appendChild(contenido);
  // Pellizco/rueda/doble clic. No hace falta soltarlo: el diálogo se REMUEVE al cerrar
  // (ver `desmonta`), y con él mueren nodo, escuchadores y estado del zoom — por eso la
  // próxima apertura empieza a escala 1 sin resetear nada a mano. Hay aserto de eso.
  habilitaZoom(marco, contenido);

  dlg.append(barra, marco);
  // Clic en el fondo (fuera del contenido) cierra, como el popover de repetición.
  dlg.addEventListener("click", (ev) => {
    if (ev.target === dlg) cierra();
  });
  dlg.addEventListener("close", () => {
    desmonta();
    if (origen?.isConnected) origen.focus();
  });
  document.body.appendChild(dlg);
  dlg.showModal();
  cerrar.focus();
}

/** ¿Hay visor abierto? Sólo para las sondas; la página no lo necesita. */
export function visorAbierto(): boolean {
  return dlg !== null;
}
