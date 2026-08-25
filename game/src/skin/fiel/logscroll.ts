/**
 * SCROLLBACK DE CONSOLA (carril log-scroll) — capa de SHELL/QoL opcional, como el
 * knob de aspecto o el overlay de ayuda. LA FIDELIDAD NO SE TOCA: por defecto la
 * consola pinta el ring de 12 líneas calcado del original; este módulo sólo aporta
 * el ESTADO del modo historial (offset de líneas hacia atrás) y los helpers puros
 * de mapeo de eventos (¿el puntero cae sobre el área de consola? ¿cuántas líneas
 * mueve una rueda / un arrastre?). El render de la ventana deslizante vive en
 * skin.ts (rama scrollback de la sección de consola de `paintFaithful`), y el
 * recorte del historial en console.ts (`scrollbackSlice`/`maxScrollOffset`).
 *
 * ENTRADA/SALIDA del modo (UX aprobada):
 *   · rueda del ratón / arrastre táctil SOBRE el área de consola → entra (offset>0).
 *   · scroll-a-fondo (offset vuelve a 0) o CUALQUIER tecla de juego → vuelve al vivo.
 * Ambas pieles lo comparten: la fiel escucha en su canvas; la shader (que envuelve
 * a la fiel y presenta su consola) escucha en el suyo y reenvía a la fiel.
 */
import { GLYPH_PX } from "./font.js";
import type { WindowRect } from "./textwindow.js";

/** Píxeles lógicos de rueda que mueven UNA línea (una celda de 8 px se queda corta:
 *  un notch de rueda clásico son ~100 px de deltaY → ~3 líneas, tacto de terminal). */
const WHEEL_PX_PER_LINE = 33;

/**
 * Estado del modo scrollback: `offset` = nº de líneas LÓGICAS retrocedidas desde el
 * presente (0 = vivo). El clamp superior (que depende del historial vivo) lo aporta
 * el caller en cada `scrollBy` — este objeto no lee el snapshot.
 */
export class ConsoleScrollback {
  private off = 0;

  get offset(): number {
    return this.off;
  }

  /** ¿Modo historial activo? (offset > 0; a fondo = vivo otra vez). */
  get active(): boolean {
    return this.off > 0;
  }

  /**
   * Mueve el offset `delta` líneas (positivo = hacia ATRÁS en el tiempo) acotado a
   * [0, maxOffset]. Devuelve true si el offset CAMBIÓ (el caller repinta sólo
   * entonces).
   */
  scrollBy(delta: number, maxOffset: number): boolean {
    const next = Math.max(0, Math.min(this.off + Math.trunc(delta), Math.max(0, maxOffset)));
    if (next === this.off) return false;
    this.off = next;
    return true;
  }

  /** Sale del modo historial (vuelta al vivo). Devuelve true si estaba activo. */
  toLive(): boolean {
    if (this.off === 0) return false;
    this.off = 0;
    return true;
  }
}

/**
 * ¿El punto de un evento (coords de cliente) cae DENTRO de un rect de CELDAS
 * (8 px) de la pantalla lógica 320×200? Mapea el punto al espacio lógico del
 * canvas (el mismo mapeo que el tap-tile de ambas pieles: getBoundingClientRect
 * + escala) y lo compara con el rect. Nació para el área de consola (de ahí el
 * nombre) y lo REUSA el scroll de listas del panel (carril panel-scroll,
 * ZTATS_LIST_RECT) — es un hit-test genérico de rect en celdas. Ninguna de esas
 * zonas es tap-to-walk (el handler de tap sólo actúa dentro del viewport 11×11),
 * así que capturar ahí la rueda/el arrastre no colisiona con nada.
 */
export function pointInConsole(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  rect: WindowRect,
  screenW: number,
  screenH: number,
): boolean {
  const box = canvas.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return false;
  const px = ((clientX - box.left) / box.width) * screenW;
  const py = ((clientY - box.top) / box.height) * screenH;
  return (
    px >= rect.leftCol * GLYPH_PX &&
    px < (rect.rightCol + 1) * GLYPH_PX &&
    py >= rect.topRow * GLYPH_PX &&
    py < (rect.botRow + 1) * GLYPH_PX
  );
}

/**
 * Líneas que mueve un evento de rueda: signo del deltaY (rueda hacia ARRIBA =
 * deltaY negativo = retroceder en el historial = offset POSITIVO) con magnitud
 * proporcional (mín. 1 línea por evento). `deltaMode` 1 (líneas) va 1:1.
 */
export function wheelLines(deltaY: number, deltaMode = 0): number {
  if (deltaY === 0) return 0;
  const mag =
    deltaMode === 1 // DOM_DELTA_LINE (Firefox rueda clásica)
      ? Math.max(1, Math.abs(Math.round(deltaY)))
      : Math.max(1, Math.round(Math.abs(deltaY) / WHEEL_PX_PER_LINE));
  return deltaY < 0 ? mag : -mag;
}

/**
 * Líneas que mueve un ARRASTRE vertical acumulado de `dragPx` píxeles de CLIENTE
 * sobre un canvas presentado a `cssRowPx` píxeles por fila de texto (alto CSS del
 * canvas / 25 filas). Arrastrar hacia ABAJO (dy>0, "tirar del papel") revela lo
 * VIEJO de arriba = offset positivo. Devuelve líneas ENTERAS (el caller conserva
 * el resto acumulado para el siguiente move).
 */
export function dragLines(dragPx: number, cssRowPx: number): number {
  if (cssRowPx <= 0) return 0;
  return Math.trunc(dragPx / cssRowPx);
}
