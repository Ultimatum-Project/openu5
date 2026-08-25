/**
 * DISPOSICIÓN de las partidas guardadas en `localStorage` — y NADA MÁS.
 *
 * 🔴 POR QUÉ ESTE MÓDULO EXISTE Y NO ES `persistence.ts`: la pantalla `/byo` tiene que
 * LISTAR las partidas y BORRARLAS, y vive en el mismo origen que el juego (el
 * ensamblador deja la landing en `/byo.html` y el juego en `/play.html`, ambos en la
 * raíz del sitio). Pero `persistence.ts` importa `state.js` y `saveNative.js` — el
 * modelo entero del juego — para (de)serializar. Importarlo desde la landing metería
 * ese árbol en un bundle cuyo trabajo es leer una carpeta y arrancar.
 *
 * La alternativa era copiar `"u5clone:saves"` en la landing, y ésa es exactamente la
 * clase de duplicado que se queda rancio en silencio: el día que el prefijo cambiara,
 * la lista de `/byo` no daría error — daría **cero partidas**, que se lee igual que
 * «no has jugado». Un fallo mudo y con pinta de dato.
 *
 * Así que aquí viven las claves y la LECTURA del índice, sin una sola importación; y
 * `persistence.ts` las consume en vez de declararlas. Un único sitio donde la clave se
 * escribe, dos consumidores.
 */

/** Índice ligero: la lista de cabeceras, sin los estados. */
export const SAVES_INDEX_KEY = "u5clone:saves";
/** Cada partida completa vive en `<prefijo><id>`. */
export const SAVE_SLOT_PREFIX = "u5clone:save:";
/**
 * Miniatura de la pantalla al guardar (dataURL jpeg ~200 px), en clave APARTE.
 *
 * 🔴 NO va dentro del índice ni del meta, y la razón es el motivo por el que el índice
 * existe: es la lista LIGERA que se lee para pintar los slots sin deserializar los
 * estados. Una captura son ~12 KB medidos; con diez partidas, el índice pasaría de
 * unos cientos de bytes a 120 KB que hay que parsear entero cada vez que alguien mira
 * la lista — incluida la del propio juego. La clave derivada del id da lo mismo con
 * lectura perezosa: quien quiera la miniatura la pide, y quien sólo lista no la paga.
 */
export const SAVE_SHOT_PREFIX = "u5clone:shot:";
/** Puntero rotatorio del autoguardado (`autosave-1/2/3`). */
export const AUTOSAVE_PTR_KEY = "u5clone:autosavePtr";

/** Cabecera de una partida guardada: lo que basta para listarla sin deserializarla. */
export interface SaveMeta {
  id: string;
  name: string;
  /** Epoch ms del guardado. */
  timestamp: number;
  /** turnsSinceStart en el momento de guardar. */
  turns: number;
  locationName: string;
  /**
   * De dónde salió la partida. AUSENTE = la guardó el jugador jugando, que es el caso
   * normal y el de todas las partidas anteriores a los momentos legendarios: por eso es
   * opcional y no un `'jugador' | 'momento'` obligatorio — un índice ya escrito no se
   * migra, y un campo que falta tiene que significar exactamente lo que significaba.
   *
   * `'momento'` = la sembró la galería de `/byo`
   * (`docs/superpowers/specs/2026-08-08-momentos-legendarios-design.md`). La tarjeta lo
   * enseña con una insignia: quien vuelve dentro de un mes tiene que poder distinguir la
   * partida que jugó de la que se le puso ahí.
   */
  provenance?: "momento";
  /**
   * Id del momento que la sembró (`momento-01`…). Es también el `id` del slot —el mismo
   * momento SIEMPRE ocupa el mismo, que es lo que hace idempotente el «añadir» (upsert, no
   * duplica)—, y viaja además aquí para que la tarjeta sepa CUÁL es sin parsear el id.
   */
  momentoId?: string;
}

/**
 * El índice, tal cual está en disco. Sin ordenar y sin filtrar: quien lista decide.
 * Un índice ausente o corrupto da `[]` — nunca lanza, porque los dos llamantes
 * (el arranque del juego y la landing) tienen que seguir funcionando sin partidas.
 */
export function readSaveIndex(storage: Storage = localStorage): SaveMeta[] {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVES_INDEX_KEY);
  } catch {
    return []; // almacenamiento bloqueado (modo privado, cookies de terceros)
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SaveMeta[]) : [];
  } catch {
    return [];
  }
}

/**
 * Borra TODAS las partidas y devuelve cuántas ranuras se fueron.
 *
 * 🔴 Barre por PREFIJO, no por el índice. Si el índice se perdió (cuota, escritura a
 * medias, una pestaña vieja), sus ranuras seguirían ocupando el almacenamiento y un
 * borrado guiado por el índice las dejaría ahí — con el botón diciendo «borrado». La
 * promesa de `/byo` es que no queda nada, así que se mira lo que HAY, no lo que el
 * índice dice que hay.
 */
export function clearAllSaves(storage: Storage = localStorage): number {
  let claves: string[];
  try {
    claves = Object.keys(storage);
  } catch {
    return 0;
  }
  let n = 0;
  for (const k of claves) {
    // Las MINIATURAS se barren en la misma pasada. Si se olvidaran, «no queda nada de
    // tu copia» sería falso y encima de la forma más visible: quedarían fotogramas
    // de la partida de alguien en el almacenamiento tras pulsar «borrar».
    if (k.startsWith(SAVE_SHOT_PREFIX)) {
      storage.removeItem(k);
      continue;
    }
    if (!k.startsWith(SAVE_SLOT_PREFIX)) continue;
    storage.removeItem(k);
    n++; // cuenta PARTIDAS, no miniaturas: es lo que se le enseña al usuario
  }
  storage.removeItem(SAVES_INDEX_KEY);
  storage.removeItem(AUTOSAVE_PTR_KEY);
  return n;
}

/** La miniatura de una partida, o `null` si no la tiene (partida anterior a #2d-bis). */
export function readSaveShot(id: string, storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(SAVE_SHOT_PREFIX + id);
  } catch {
    return null;
  }
}

/**
 * Escribe SÓLO la miniatura de una partida ya existente. Devuelve si se pudo.
 *
 * ── POR QUÉ EXISTE, Y POR QUÉ AQUÍ ──────────────────────────────────────────────────────
 * Los momentos legendarios se siembran sin captura (nadie los ha jugado) y el fotograma se
 * genera DESPUÉS, arrancando el juego sobre ese save en un iframe oculto. Ese camino
 * necesita escribir la foto de un slot que ya está puesto, sin volver a serializar el
 * estado — `putSave` reescribiría la ranura entera y el índice.
 *
 * Vive junto a `readSaveShot` y no en `main.ts` por la razón de la cabecera de este módulo:
 * **un solo sitio donde la clave se escribe**. Un `setItem("u5clone:shot:" + id, …)` en la
 * cáscara sería la segunda copia del prefijo, y el día que cambiara daría cero fotos en
 * silencio — que se lee igual que «este save no tiene foto».
 *
 * 🔴 NO CREA LA PARTIDA. Escribir la foto de un id inexistente dejaría una miniatura
 * huérfana que nadie borra (el barrido de `clearAllSaves` la limpia, pero la lista nunca la
 * enseñaría). Por eso exige que la ranura EXISTA y devuelve `false` si no.
 */
export function writeSaveShot(
  id: string,
  shot: string,
  storage: Storage = localStorage,
): boolean {
  try {
    if (storage.getItem(SAVE_SLOT_PREFIX + id) === null) return false;
    storage.setItem(SAVE_SHOT_PREFIX + id, shot);
    return true;
  } catch {
    // Cuota o almacenamiento bloqueado. Es un ADORNO: la tarjeta cae al minimapa o al
    // nombre del lugar, que es el respaldo que ya existe. Nunca lanza.
    return false;
  }
}
