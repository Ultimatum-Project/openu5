/**
 * POPOVER de repetición: el juego embebido reproduciendo, sin salir de `/byo`.
 *
 * 🔴 `<dialog showModal()>` Y NO UN DIV: el foco atrapado, el Escape que cierra, el
 * `aria-modal` y el inerte del resto de la página los da el navegador. Reimplementar
 * una trampa de foco a mano es donde se cuelan los fallos de accesibilidad que nadie
 * prueba — y aquí serían MÍOS, no del navegador.
 *
 * 🔴 CERRAR MATA EL IFRAME. `remove()` destruye el documento y con él el juego; medido
 * (1 → 0). Sin esto quedaría una partida corriendo detrás de un panel cerrado,
 * gastando CPU de alguien que cree haber salido.
 *
 * 🔴 Y ABRE CON ESTADO «CARGANDO», que no es cortesía: el arranque en frío está MEDIDO
 * en **1604 ms** (250 peticiones, 11,17 MB en dev). El número que casi uso —418 ms— era
 * de un iframe creado desde una página que YA tenía el juego caliente, y quien llega a
 * /byo llega frío. Diseñar para esa cifra habría dado segundo y medio de caja en blanco.
 *
 * ── LA BARRITA SE APARTA: EL POPOVER ES PARA VER LA PARTIDA, NO EL MARCO ────────────────
 * Petición del usuario, y la misma que ya se aplicó a la barra de transporte de dentro del
 * iframe (`replay-ui.ts:79-100`, clase `u5-replay-bar--limpia`): aquí se viene a mirar la
 * pantalla del juego. El título y el «Cerrar» arrancan visibles un instante —para que se
 * sepa que están—, se apagan solos y vuelven al mover el ratón o al tocar.
 *
 * 🔴 Y VA POR ENCIMA DEL JUEGO (`position:absolute`), no en el flujo. Con la barra en flujo y
 * sólo `opacity:0` quedaría una FRANJA VACÍA permanente encima de la partida, con su borde
 * inferior: apagar el texto pero dejar su hueco no es limpiar, es dejar un hueco.
 *
 * 🔴 EL RATÓN SOBRE EL IFRAME NO EMITE NADA AQUÍ, y esto no es un fallo sino la razón de que
 * el régimen funcione: los eventos de puntero del documento del iframe NO cruzan al padre.
 * O sea que mientras miras la partida no llega ni un `pointermove` y la barra se queda
 * apagada —que es exactamente lo que se pide—, y en cuanto subes hacia el borde superior el
 * puntero pisa el cromo del diálogo, ahí sí llegan eventos, y aparece. Quien intente
 * «arreglar» esto escuchando dentro del iframe estará quitando la propiedad, no un defecto.
 *
 * 🔴 ESCAPE SIGUE CERRANDO, y aquí no se toca NADA que pudiera romperlo: el `<dialog>` modal
 * lo trae de fábrica mientras el foco esté dentro, y este módulo no pone ningún escuchador de
 * `keydown` (ni uno que llame a `preventDefault`, ni uno que pare la propagación). El foco
 * inicial va al PROPIO diálogo y no al botón de cerrar — si fuera al botón, `:focus-within`
 * dejaría la barra encendida hasta que el visitante pinchara en el juego, y el popover
 * abriría con el cromo puesto justo cuando se quiere lo contrario. Tabular desde el diálogo
 * llega al botón en un paso, y el foco lo revela.
 */
import { txt } from "./idioma.js";

let dlg: HTMLDialogElement | null = null;

/**
 * Cuánto sigue visible la barrita tras el último gesto. 2,2 s es el mismo orden que un
 * reproductor de vídeo: suficiente para leer el título y llegar al botón, corto para que no
 * estorbe. No es una cifra medida y no pretende serlo — es una decisión de presentación.
 */
const APAGADO_MS = 2200;

/**
 * Pide el cierre. NO desmonta nada: sólo dispara `close`, y el desmontaje vive en su
 * escuchador.
 *
 * 🔴 UNA SOLA RUTA DE DESMONTAJE, y costó un rojo descubrirlo. La primera versión
 * desmontaba AQUÍ, y el Escape del navegador **no pasa por aquí**: emite `close`
 * directamente. Resultado medido: el modal se cerraba visualmente y el `<dialog>` se
 * quedaba en el DOM. Con tres entradas (botón, fondo, Escape) y el desmontaje en una
 * de ellas, las otras dos se caen — así que las tres piden cierre y el desmontaje
 * ocurre en el único sitio por el que pasan todas.
 */
function cierra(): void {
  dlg?.close();
}

/** Temporizador de apagado de la barrita. Vive fuera para que `desmonta` pueda cancelarlo. */
let apagado: ReturnType<typeof setTimeout> | null = null;

/** Desmontaje REAL: mata el iframe (y con él el juego) y saca el diálogo del DOM. */
function desmonta(): void {
  if (apagado !== null) {
    // 🔴 El temporizador se cancela AQUÍ y no en el escuchador del botón, por la misma razón
    // que el desmontaje: hay tres formas de cerrar y sólo esta función las ve todas. Un
    // `setTimeout` vivo sobre un nodo ya retirado no da error —toca una barra huérfana— pero
    // deja trabajo pendiente de un diálogo que el visitante cree cerrado.
    clearTimeout(apagado);
    apagado = null;
  }
  if (!dlg) return;
  dlg.querySelector("iframe")?.remove(); // primero el juego, luego el marco
  dlg.remove();
  dlg = null;
}

/**
 * Abre la repetición `id` embebida. `label` es el rótulo que ve el usuario.
 * Idempotente: una segunda llamada cierra la anterior antes de abrir.
 */
export function abreReplay(id: string, label: string): void {
  desmonta(); // una segunda llamada reemplaza a la anterior, sin dejarla en el DOM
  dlg = document.createElement("dialog");
  dlg.className = "replay-modal";
  dlg.setAttribute("aria-label", label);

  const barra = document.createElement("div");
  // La clase `--limpia` es la que APAGA; sin ella la barra sería la de siempre. Se pone
  // aquí y no en el CSS de `.replay-modal__barra` a propósito: el régimen es una decisión
  // de ESTE modal, y la clase base la comparte con el visor de ilustraciones.
  barra.className = "replay-modal__barra replay-modal__barra--limpia";
  const titulo = document.createElement("strong");
  titulo.textContent = label;
  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.className = "replay-modal__cerrar";
  cerrar.textContent = txt("replayCerrar");
  cerrar.addEventListener("click", cierra);
  barra.append(titulo, cerrar);

  // Estado de carga: se retira cuando el iframe dice `load`.
  const cargando = document.createElement("p");
  cargando.className = "replay-modal__cargando";
  cargando.textContent = txt("replayCargando");

  const marco = document.createElement("iframe");
  marco.className = "replay-modal__juego";
  marco.title = label;
  marco.src = `/play.html?embed=1&nointro&replay=${encodeURIComponent(id)}`;
  marco.addEventListener("load", () => cargando.remove());

  dlg.append(barra, cargando, marco);
  // Clic en el fondo (fuera del contenido) cierra, como el panel de estados.
  dlg.addEventListener("click", (ev) => {
    if (ev.target === dlg) cierra();
  });
  // El ÚNICO sitio donde se desmonta: aquí llegan el botón, el fondo y el Escape.
  dlg.addEventListener("close", desmonta);

  // ── EL RÉGIMEN LIMPIO ────────────────────────────────────────────────────────────────
  // `revela()` enciende y programa el apagado. El CSS resuelve solo el caso del TECLADO
  // (`:focus-within`), que es el que no puede depender de un temporizador: quien llega
  // tabulando tiene que ver el botón mientras lo tenga enfocado, dure lo que dure.
  const revela = (): void => {
    barra.classList.add("mostrada");
    if (apagado !== null) clearTimeout(apagado);
    apagado = setTimeout(() => barra.classList.remove("mostrada"), APAGADO_MS);
  };
  // `pointermove` cubre ratón Y lápiz; `pointerdown` cubre el DEDO, que no genera
  // movimiento (mismo reparto que la barra de dentro del iframe). Van en el diálogo y no en
  // `window` porque un gesto en el resto de la página no debe encender nada: el diálogo es
  // modal y ahí fuera no se puede tocar nada.
  dlg.addEventListener("pointermove", revela);
  dlg.addEventListener("pointerdown", revela);

  document.body.appendChild(dlg);
  dlg.showModal();
  // 🔴 EL FOCO VA AL DIÁLOGO, NO AL BOTÓN — ver la cabecera. Escape sigue cerrando (el
  // navegador lo resuelve con el foco en cualquier punto del modal) y la primera tabulación
  // llega al «Cerrar», que al enfocarse se revela solo.
  dlg.tabIndex = -1;
  dlg.focus();
  revela(); // se enseña al abrir y se apaga sola: si no, nadie sabría que la barra existe
}
