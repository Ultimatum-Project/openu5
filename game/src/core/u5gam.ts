/**
 * EL FORMATO `.u5gam` — un SAVED.GAM de 1988 con el SOBRE del clon pegado detrás.
 *
 * ── POR QUÉ ESTE MÓDULO EXISTE, Y POR QUÉ EN `core/` ────────────────────────────────────
 * La disposición del fichero la escribió `demo-byo/src/exporta.ts` para la landing, y
 * durante meses fue el ÚNICO que la conocía. Pero el fichero lo abren DOS sitios distintos:
 * la landing (`/byo`, que lo instala en una ranura) y el PANEL DE GUARDADO DEL JUEGO
 * (`ui/savepanel.ts`, que lo carga en la partida en curso). Con la marca declarada sólo en
 * la landing, el panel del juego no podía reconocerlo — y no fallaba con un error del
 * formato: caía por la rama del JSON y moría con un «Import failed.» genérico (#229).
 *
 * 🔴 Y LA ALTERNATIVA ERA COPIAR `"U5PARTIDA1\n"` EN EL PANEL, que es exactamente la clase
 * de duplicado contra la que existe `save-keys.ts`: el día que la marca cambiara, el
 * segundo lector no daría error — daría «este fichero no lleva sobre», o sea una partida
 * SIN trama, SIN diario y SIN objetos del mundo, con pinta de buena. Un fallo mudo y con
 * forma de dato. Un único sitio donde el formato se escribe, dos consumidores.
 *
 * ── LA DISPOSICIÓN ──────────────────────────────────────────────────────────────────────
 *   [0x0000 .. 0x1060)    SAVED.GAM — 4192 B, byte a byte lo que emite `exportNativeSave`
 *   [0x1060 .. 0x1060+11) la marca `U5PARTIDA1\n`
 *   [ .. EOF)             el SOBRE, JSON UTF-8: cabecera de índice + SIDECAR
 *
 * El sobre no es un extra: es la mitad del formato. El SAVED.GAM de 1988 no tiene hueco
 * para la mayoría de `questFlags` ni de `worldObjects`, ni para el diario — la lista y sus
 * formas medidas están en la cabecera de `exporta.ts`. (El ejemplo que iba aquí —«los
 * Shadowlords muertos»— caducó con #238: esa capa de trama ya viaja en bytes nativos.)
 */
import { SAVED_GAM_SIZE, type SaveSidecar } from "./saveNative.js";
import type { SaveMeta } from "./save-keys.js";

/** Marca del SOBRE, justo detrás de los 4192 B del `.gam`. */
export const U5GAM_MARKER = "U5PARTIDA1\n";

/** Extensión del fichero que emite `nombreDeFichero` (`demo-byo/src/exporta.ts`). */
export const U5GAM_EXT = ".u5gam";

/**
 * El SOBRE: la cabecera del índice + el sidecar.
 *
 * La cabecera viaja porque el `.gam` **no sabe cómo se llama la partida**: el nombre que le
 * pusiste al guardar y el nombre del lugar son campos de `SaveMeta`, no bytes del formato de
 * 1988; sin ellos el otro dispositivo tendría que inventárselos —y el del lugar ni siquiera
 * podría, porque los nombres de sitio salen de la extracción del visitante—.
 */
export interface U5gamEnvelope {
  formato: "openu5-partida";
  version: 1;
  meta: Pick<SaveMeta, "name" | "locationName" | "turns" | "timestamp" | "provenance">;
  sidecar: SaveSidecar;
}

/**
 * ¿Es este NOMBRE de fichero un `.u5gam`?
 *
 * 🔴 EXISTE PORQUE `/\.gam$/i` NO CASA CON `.u5gam` y eso no se ve leyendo. El carácter
 * anterior a «gam» es un `5`, no un punto, así que el discriminante del panel de guardado
 * daba `false` sobre un fichero que el propio proyecto acababa de emitir — medido (#229).
 */
export function isU5gamName(name: string): boolean {
  return name.toLowerCase().endsWith(U5GAM_EXT);
}

/** Lo que se saca de mirar la cola de un fichero de partida. */
export type EnvelopeRead =
  /** No lleva marca: es un `.gam` pelado (del DOS, o de otra herramienta). */
  | { kind: "none" }
  /** Lleva marca pero el sobre no se puede usar: JSON roto, otra versión, o sidecar deforme. */
  | { kind: "bad" }
  | { kind: "ok"; envelope: U5gamEnvelope };

/**
 * ¿Tiene el sidecar la forma que `importNativeSave` da por supuesta? Las tres cosas que ese
 * códec toca sin preguntar: los dos sobres (`qol`, `gameState`) y el diario, que se asigna
 * entero (`state.journal = sidecar.qol.journal`). Lo de dentro de `gameState` se copia campo
 * a campo y sólo si existe, así que un campo suelto raro es inocuo; los tres de aquí no.
 *
 * 🔴 Y LA COMPROBACIÓN TIENE QUE ESTAR AQUÍ O NO ESTÁ: `assertValidState` —el validador del
 * camino no confiable— no mira NINGUNO de esos campos, así que un `"gameState": "hola"`
 * pasaría entero y dejaría `state.questFlags` en `undefined`.
 */
export function isSaneSidecar(s: unknown): s is SaveSidecar {
  const c = s as SaveSidecar | null;
  return (
    !!c &&
    typeof c === "object" &&
    !!c.qol &&
    typeof c.qol === "object" &&
    Array.isArray(c.qol.journal) &&
    !!c.gameState &&
    typeof c.gameState === "object"
  );
}

/**
 * Lee la cola del fichero y devuelve el sobre, distinguiendo «no lo lleva» de «lo lleva
 * roto». Los dos casos DEGRADAN (la partida entra con lo que el `.gam` sí guarda), pero se
 * le dicen al usuario con frases distintas, así que el lector tiene que poder separarlos.
 *
 * NUNCA LANZA: es la puerta del camino no confiable.
 */
export function readU5gamEnvelope(bytes: Uint8Array): EnvelopeRead {
  const tail = bytes.subarray(SAVED_GAM_SIZE);
  const marker = new TextDecoder().decode(tail.subarray(0, U5GAM_MARKER.length));
  if (marker !== U5GAM_MARKER) return { kind: "none" };
  let parsed: U5gamEnvelope;
  try {
    parsed = JSON.parse(new TextDecoder().decode(tail.subarray(U5GAM_MARKER.length))) as U5gamEnvelope;
  } catch {
    return { kind: "bad" };
  }
  // Se comprueba la FORMA de lo que llega, no sólo que el JSON parsee: un sobre de otra
  // versión futura, o un JSON de cualquier otra cosa con la marca delante, degrada al `.gam`
  // en vez de meter un sidecar que el códec no sabe leer.
  if (parsed?.formato !== "openu5-partida" || parsed.version !== 1 || !isSaneSidecar(parsed.sidecar)) {
    return { kind: "bad" };
  }
  return { kind: "ok", envelope: parsed };
}

/**
 * El sidecar VACÍO — el mismo que usa `importNativeSaveFiles` cuando no hay JSON
 * acompañante. Se comparte para que las tres puertas de importación coincidan en qué
 * significa «sin sobre» en vez de escribir cada una su literal.
 */
export function emptySidecar(): SaveSidecar {
  return { version: 1, qol: { journal: [] }, gameState: { transport: "foot", questFlags: {} } };
}
