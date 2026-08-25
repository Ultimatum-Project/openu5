/**
 * RE-CAPTURA DE MINIATURAS VIEJAS AL CARGAR UNA PARTIDA (ficha #153, punto 3).
 *
 * POR QUÉ EXISTE Y POR QUÉ NO ES UNA MIGRACIÓN. El parque de miniaturas persistidas es
 * heterogéneo por historia: hay jpeg 200×125 de antes del 08-08, PNG 320×200 buenos, y —el
 * defecto que cierra #153— PNG del TELÉFONO ENTERO (1170×1696 / 1700×1020) tomados desde los
 * layouts táctiles. Una migración tendría que RE-RENDERIZAR cada partida para volver a
 * fotografiarla, que es justo lo que el juego hace solo cuando el jugador la carga. Así que
 * no hay migración: la foto se rehace EN LA CARGA, y el parque converge sin barrido.
 *
 * 🔴 LA GUARDA QUE DECIDE ES `declarado`, NO LA DIMENSIÓN. El criterio ingenuo («si no es
 * 320×200, re-captura») está INVERTIDO en el peor caso: una piel sin declaración en un móvil
 * partido produce hoy 1170×1696, así que ese criterio pisaría una miniatura BUENA de 320×200
 * con el teléfono entero — exactamente el defecto, ahora en dirección contraria y sobre datos
 * que ya estaban bien. Sólo se re-captura cuando la captura de ahora viene de una piel que
 * DECLARA su búfer (`tamanoCaptura().declarado`): eso es lo que acredita que la nueva foto es
 * mejor que la vieja, y no sólo distinta.
 *
 * 🔴 Y EL 320×200 NO SE CABLEA AQUÍ. La comparación es contra lo que la piel produzca ahora,
 * no contra una constante: una piel que declare un nativo de 640×400 debe converger a
 * 640×400. Una constante en este fichero sería una segunda fuente de verdad de la geometría
 * de la pantalla, y la primera ya vive en `skin/fiel/frame.ts`.
 *
 * BUCLES. Dos frenos, y hacen falta los dos: (a) el registro de ids ya intentados en ESTA
 * sesión —una carga fallida no se reintenta en cada re-render—, y (b) el propio predicado, que
 * tras una re-captura buena deja de dispararse porque las dimensiones ya coinciden. Sin (a),
 * una escritura que falle por cuota reintentaría en cada carga del mismo slot; sin (b), (a)
 * sólo aguantaría hasta recargar la página.
 */
import { readSaveShot, writeSaveShot } from "../core/save-keys.js";
import { medirPng } from "../core/png-dims.js";
import { captureScreenshot, tamanoCaptura } from "./screenshot.js";

/** Dimensiones que tendría la captura de ahora mismo, y si vienen de una declaración. */
export interface Objetivo {
  width: number;
  height: number;
  declarado: boolean;
}

/**
 * 🔴 `medirPng` YA NO VIVE AQUÍ: se movió a `core/png-dims.ts` para que `/byo` pueda usarlo
 * sin arrastrar el grafo de este módulo (`core/save-keys` + `ui/screenshot`) a su bundle.
 * Se RE-EXPORTA porque los tests de este fichero y sus lectores la citan por esta ruta, y
 * una función que cambia de sitio sin dejar rastro rompe a quien la importaba sin decir por
 * qué. El cuerpo es el mismo, byte a byte — esto es un movimiento, no una reescritura.
 */
export { medirPng } from "../core/png-dims.js";

/**
 * ¿Merece la pena rehacer la miniatura persistida?
 *
 * Puro y exportado para poder instanciar los cuatro casos que importan sin navegador: sin
 * foto, foto jpeg vieja, foto del teléfono entero, y foto ya correcta.
 */
export function debeRecapturar(guardada: string | null, objetivo: Objetivo | null): boolean {
  // Sin canvas todavía, o piel sin declaración: no hay nada mejor que ofrecer.
  if (!objetivo || !objetivo.declarado) return false;
  if (guardada === null) return true;
  const dims = medirPng(guardada);
  if (!dims) return true; // jpeg antiguo o dataURL ilegible
  return dims.width !== objetivo.width || dims.height !== objetivo.height;
}

/** Costuras del entorno, para que el test no necesite navegador ni localStorage. */
export interface DepsRefresco {
  leer?: (id: string) => string | null;
  escribir?: (id: string, shot: string) => boolean;
  capturar?: (parent: ParentNode) => string | null;
  medir?: (parent: ParentNode) => Objetivo | null;
  /** Espera al primer frame ESTABLE. Por defecto, dos `requestAnimationFrame`. */
  esperarFrame?: () => Promise<void>;
  /** Registro de ids ya intentados (inyectable para que los tests no se contaminen). */
  intentados?: Set<string>;
}

/**
 * 🔴 DOS `requestAnimationFrame`, Y ESTÁ MEDIDO EN OTRO SITIO DE ESTE MISMO REPO: el camino
 * `?shot=` de `main.ts` capturaba NEGRO sin esta espera (913 B de rectángulo liso que su autor
 * dio por bueno hasta abrir el fichero). Aquí la exposición es la misma: `applyLoadedState`
 * pide el re-render y el canvas todavía lleva el frame anterior —o ninguno— cuando vuelve.
 * Dos rAF = «después del siguiente pintado», que es la condición que hace falta.
 */
function dosFrames(): Promise<void> {
  return new Promise<void>((r) => {
    if (typeof requestAnimationFrame !== "function") {
      r();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => r()));
  });
}

const YA_INTENTADOS = new Set<string>();

/**
 * Re-captura y re-persiste la miniatura de `id` si la persistida no está a la altura.
 *
 * Devuelve si llegó a escribir. Nunca lanza: como la captura misma, esto es adorno — una
 * partida se carga igual con la foto vieja, con una foto mala o sin foto.
 */
export async function refrescarMiniatura(
  id: string,
  parent: ParentNode = document,
  deps: DepsRefresco = {},
): Promise<boolean> {
  const {
    leer = readSaveShot,
    escribir = writeSaveShot,
    capturar = captureScreenshot,
    medir = tamanoCaptura,
    esperarFrame = dosFrames,
    intentados = YA_INTENTADOS,
  } = deps;
  // El registro se marca ANTES de la espera: dos cargas del mismo slot encadenadas no pueden
  // dejar dos re-capturas en vuelo.
  if (intentados.has(id)) return false;
  intentados.add(id);
  try {
    await esperarFrame();
    if (!debeRecapturar(leer(id), medir(parent))) return false;
    const png = capturar(parent);
    return png !== null && escribir(id, png);
  } catch {
    return false;
  }
}
