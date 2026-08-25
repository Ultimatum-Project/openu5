/**
 * MUDANZAS DE DOM del deck en el PORTRAIT del prototipo — 4ª iteración del usuario
 * (27-07 noche), la parte que el CSS no puede hacer sola.
 *
 * «Mover ESC, ENTER y SPACE al pad de movimiento: ENT en el CENTRO de la cruceta, ESC en
 * la esquina ARRIBA-DERECHA del pad, SPC ARRIBA-IZQUIERDA. La primera columna queda con
 * ☰, teclado, num y sí/no.»
 *
 * POR QUÉ HACE FALTA JS. Las tres teclas viven en `.touch-util` y la cruceta es
 * `.touch-dpad`: son SUBÁRBOLES distintos del DOM que construye `ui/touch.ts`. Un
 * `grid-area` sólo coloca a los HIJOS de la rejilla, así que meterlas en las celdas de la
 * cruceta exige moverlas de padre. Es el mismo patrón (y la misma disciplina de
 * restaurar) que `deck-nativo.ts` usa para llevar ⛶/☰ al final de la columna.
 *
 * DÓNDE LAS COLOCA ES COSA DEL CSS, no de aquí: el layout PARTIDO las mete en las celdas
 * libres de la cruz 3×3 (esquinas superiores + centro) y el ORIGINAL las pone en una fila
 * horizontal ENCIMA del pad, formando un bloque con él. Este módulo sólo garantiza que
 * los siete botones sean hijos del MISMO contenedor.
 *
 * TRES INVARIANTES QUE SE RESPETAN:
 *   · SÓLO EN VERTICAL. En apaisado la cruceta tiene su propia geometría medida y sellada
 *     (rulings de la TANDA A): las teclas vuelven a la fila útil al rotar.
 *   · SEMÁNTICA TÁCTIL INTACTA. Estas tres son teclas de ACTIVACIÓN, no direccionales:
 *     conservan el `bindTap` de `ui/touch.ts` (dispara AL SOLTAR, con supresión de pan).
 *     La excepción de `pointerdown` + `HoldRepeat` es y sigue siendo SÓLO de las cuatro
 *     flechas — andar exige respuesta inmediata; confirmar, no.
 *   · REVERSIBLE. Se recuerda padre y hermano de cada botón, y `dispose()` (o una
 *     rotación) los devuelve exactamente a su sitio, con su rótulo largo.
 */
import { AZ_ACTIVATOR, ensureSheetActivator } from "../../ui/touch.js";
import { ts } from "../../i18n/shell.js";

/** Clase común de las tres teclas mudadas (el CSS las coloca por ella). */
export const PAD_KEY_CLASS = "u5padkey";

/** Clase por tecla: el CSS necesita distinguirlas para darle a cada una su celda. */
const PAD_KEY_SLOT: Record<string, string> = {
  Enter: "u5padkey-ent",
  Escape: "u5padkey-esc",
  " ": "u5padkey-spc",
};

/**
 * ⛶ — HISTORIA de la decisión (b) del usuario (01-08), porque este bloque la cambió DOS veces:
 * la primera resolución (celda (1,3) de la cruz en el partido) resultó INERTE — este módulo
 * corre ANTES de que `PortraitSkin.mount` publique `data-deck-ancho`, así que la guarda del
 * partido era siempre falsa y nada la reintentaba; su test era verde comprobando el TEXTO del
 * CSS de una clase que nadie ponía (acta mobile-fixes-0108, hallazgo 1). La resolución VIVA es
 * el ROTULADO: «⛶ Pantalla» con glifo a 18px en los tres layouts (index.html ::before), que
 * resuelve la queja literal («no lo veo») sin depender de esta carrera. Aquí solo queda el
 * movimiento del layout ORIGINAL (⛶ a `.touch-util`), que sí corre y hace falta: allí la barra
 * de modo desaparece con el barrido y el botón quedaría inalcanzable.
 */

interface Origen {
  el: HTMLElement;
  padre: Node;
  siguiente: Node | null;
}

/**
 * Instala las mudanzas y las mantiene al día con la ORIENTACIÓN. Idempotente y
 * tolerante a que el deck aún no exista (se reintenta un rato corto, como
 * `installLayoutToggleButton`). Devuelve el desmontaje.
 */
export function installPortraitDeckDom(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const origenes = new Map<HTMLElement, Origen>();
  let mudado = false;

  /** Recuerda dónde vivía un botón la PRIMERA vez que se le toca. */
  const recordar = (el: HTMLElement): void => {
    if (origenes.has(el) || !el.parentElement) return;
    origenes.set(el, { el, padre: el.parentElement, siguiente: el.nextSibling });
  };

  const teclasUtil = (): HTMLElement[] =>
    Array.from(
      document.querySelectorAll<HTMLElement>(".touch-controls [data-util-key]"),
    ).filter((el) => PAD_KEY_SLOT[el.dataset.utilKey!] !== undefined);

  /** Cambia la BASE del rótulo (larga ↔ corta) y re-aplica `ts()` sobre ella, para que un
   *  cambio de idioma posterior (relabel de touch.ts) traduzca la forma correcta. */
  const rotular = (el: HTMLElement, corta: boolean): void => {
    const base = corta ? el.dataset.utilPadLabel : el.dataset.utilLabel;
    if (!base) return;
    el.dataset.tsLabel = base;
    el.textContent = ts(base);
  };

  const mudar = (): void => {
    const dpad = document.querySelector<HTMLElement>(".touch-dpad");
    if (!dpad) return;
    for (const el of teclasUtil()) {
      recordar(el);
      el.classList.add(PAD_KEY_CLASS, PAD_KEY_SLOT[el.dataset.utilKey!]!);
      rotular(el, true);
      if (el.parentElement !== dpad) dpad.appendChild(el);
    }
    // ⛶ → `.touch-util` (todos los layouts; ver la HISTORIA de la decisión (b) arriba):
    // en el ORIGINAL la barra de modo desaparece con el barrido y sin esto el botón
    // quedaría inalcanzable; en el PARTIDO ya vive ahí y el rotulado lo hace visible.
    const fs = document.querySelector<HTMLElement>(".touch-fullscreen");
    if (fs) {
      const destino = document.querySelector<HTMLElement>(".touch-util");
      if (destino) {
        recordar(fs);
        if (fs.parentElement !== destino) destino.appendChild(fs);
      }
    }
    mudado = true;
  };

  const restaurar = (): void => {
    for (const el of teclasUtil()) {
      el.classList.remove(PAD_KEY_CLASS, ...Object.values(PAD_KEY_SLOT));
      rotular(el, false);
    }
    // El ⛶ no lleva clases de celda desde que la vía del pad se retiró (ver HISTORIA
    // arriba); su DOM lo devuelve el bucle de `origenes` de abajo, como a los demás.
    // AL REVÉS, y con red. Los tres botones eran hermanos, así que el «siguiente» que
    // cada uno recordó es OTRO de los mudados: devolverlos en orden de mudanza hace un
    // `insertBefore` contra un nodo que ya no es hijo del destino — y eso LANZA
    // (NotFoundError), dejando la restauración a medias. Medido al rotar: los rótulos
    // volvían a su forma larga y los botones se quedaban en el pad.
    // En orden inverso, cada referencia ya ha vuelto a su sitio cuando se la necesita; el
    // guardia cubre además el caso de que algo más haya movido el hermano entretanto.
    for (const o of Array.from(origenes.values()).reverse()) {
      const ref = o.siguiente && o.siguiente.parentNode === o.padre ? o.siguiente : null;
      o.padre.insertBefore(o.el, ref);
    }
    origenes.clear();
    mudado = false;
  };

  const aplicar = (): boolean => {
    const deck = document.querySelector(".touch-controls");
    if (!deck) return false;
    // El activador de la hoja A–Z: sólo tiene sentido con este prototipo montado (la
    // barra de modo, que es quien conmuta esa hoja en el deck canónico, desaparece en los
    // dos layouts del portrait). El CSS lo oculta donde sobra (layout partido: allí el
    // texto va por el teclado del sistema).
    ensureSheetActivator(AZ_ACTIVATOR.mode, AZ_ACTIVATOR.label, AZ_ACTIVATOR.title);
    // ★ EN LAS DOS ORIENTACIONES desde el rediseño apaisado (28-07, carril
    // `landscape-28`). Hasta entonces las teclas volvían a la fila útil al girar, y la
    // razón escrita era que «en apaisado la cruceta tiene su propia geometría medida y
    // sellada» — cierto en su día, y justo lo que el rediseño revisa: allí el deck ya no
    // es una banda con fila útil, sino dos raíles, y las tres teclas dentro de la cruz son
    // lo que le permite al raíl A ser un bloque único al alcance del pulgar. La colocación
    // sigue siendo del CSS (`layoutApaisadoCss`), como en los otros dos layouts; esto sólo
    // garantiza que los siete botones sean hijos del MISMO contenedor.
    mudar();
    return true;
  };

  // El deck se construye una sola vez y ANTES que esto en el boot, pero el instalador no
  // lo da por hecho (mismo reintento corto que el botón ▤).
  let timer = 0;
  if (!aplicar()) {
    let intentos = 0;
    timer = window.setInterval(() => {
      if (aplicar() || ++intentos > 40) window.clearInterval(timer);
    }, 250);
  }
  // La orientación la publica `ui/touch.ts` en `<html data-orient>`: se sigue el atributo
  // en vez de duplicar la detección (matchMedia) y arriesgar dos verdades distintas.
  const obs = new MutationObserver(() => aplicar());
  obs.observe(root, { attributes: true, attributeFilter: ["data-orient"] });

  return () => {
    if (timer) window.clearInterval(timer);
    obs.disconnect();
    restaurar();
  };
}
