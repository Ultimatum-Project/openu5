/**
 * ALMACÉN LOCAL de registros — IndexedDB, y NADA MÁS.
 *
 * 🔴 En esta entrega no se envía nada a ningún sitio: ni una petición de red. Este
 * módulo no importa `fetch` ni conoce ninguna URL, y su test lo comprueba leyendo el
 * fichero (una guarda por AUSENCIA que se pone roja el día que alguien añada la subida
 * aquí en vez de en su propia capa, con su propio consentimiento).
 *
 * Se elige IndexedDB y no localStorage porque el ancla de un registro es el GameState
 * serializado (~18 KB) y localStorage tiene un techo de ~5 MB para TODO el origen,
 * compartido con los saves del juego.
 *
 * ── LAS MINIATURAS SON MATERIAL DE EA Y NO SALEN DE AQUÍ ────────────────────────────
 * 🔴 Una miniatura son PÍXELES RENDERIZADOS del juego = material derivado de EA. Vive
 * en el almacén `thumbs` de esta misma base, o sea en el navegador del visitante, y en
 * ningún otro sitio: ni en un fichero del repo, ni en el formato de récord (cuyo
 * validador es default-deny y rechazaría el campo por nombre — `records-formato.ts`
 * §validaRecord), ni en el `.u5gam`, que sólo transporta PARTIDAS y ni siquiera lleva
 * la captura de ésas. Quien añada aquí una subida estará sacando fotogramas de EA del
 * navegador de alguien, y ése es el invariante que este módulo existe para sostener.
 */
import { utf8Bytes } from "./codec.js";
import type { ReplayLog, ReplayMeta } from "./types.js";

const DB_NAME = "u5-replay";
const DB_VERSION = 2;
const STORE = "logs";
/**
 * MINIATURAS, en almacén APARTE — y la razón es la misma por la que `save-keys.ts`
 * saca la captura de una partida fuera del índice (allí está escrita entera):
 *
 * 🔴 SI LA MINIATURA VIVIERA DENTRO DEL `ReplayLog`, `ReplayMeta.bytes` LA CONTARÍA.
 * Ese campo se documenta a sí mismo como «tamaño en BYTES UTF-8 del registro
 * serializado (medida, no estimación)» y la lista del juego lo ENSEÑA. Un fotograma
 * son 13,4 KB medidos y una repetición corta ronda los 11 KB: la cifra que el
 * visitante lee como «lo que cuesta guardar tu partida» se DUPLICARÍA, y seguiría
 * siendo literalmente cierta — que es la peor clase de cifra falsa. La miniatura es
 * un ADORNO y no debe entrar en la contabilidad de lo que cuesta un registro.
 *
 * Y de paso da la lectura PEREZOSA: `listLogs()` no arrastra un fotograma por fila.
 */
const THUMBS = "thumbs";

/** Una miniatura guardada: el dataURL PNG del último fotograma de la grabación. */
interface ThumbRow {
  id: string;
  png: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // Se comprueba almacén por almacén y NO por número de versión: quien venga de la v1
    // tiene `logs` y le falta `thumbs`, quien llega nuevo no tiene ninguno, y los dos
    // caminos pasan por aquí. Un `if (ev.oldVersion < 2)` diría lo mismo hoy y sería
    // frágil el día que haya una v3.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(THUMBS)) {
        db.createObjectStore(THUMBS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB.open falló"));
  });
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB: petición fallida"));
  });
}

/** ¿Hay IndexedDB en este entorno? (Un navegador en modo privado puede no darlo.) */
export function storeAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function saveLog(log: ReplayLog): Promise<void> {
  const db = await openDb();
  try {
    await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(log));
  } finally {
    db.close();
  }
}

export async function getLog(id: string): Promise<ReplayLog | null> {
  const db = await openDb();
  try {
    return (await done(db.transaction(STORE, "readonly").objectStore(STORE).get(id))) ?? null;
  } finally {
    db.close();
  }
}

/** Cabeceras, más reciente primero. Incluye el tamaño MEDIDO de cada registro. */
export async function listLogs(): Promise<ReplayMeta[]> {
  const db = await openDb();
  try {
    const all: ReplayLog[] = await done(
      db.transaction(STORE, "readonly").objectStore(STORE).getAll(),
    );
    return all
      .map((l) => ({
        id: l.id,
        label: l.label,
        createdAt: l.createdAt,
        count: l.count,
        lastTurn: l.lastTurn,
        bytes: utf8Bytes(JSON.stringify(l)),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

/**
 * Guarda la miniatura de una grabación. Nunca lanza: es un ADORNO, y el registro —que
 * es lo que de verdad se está guardando— tiene que llegar a disco pase lo que pase.
 * Devuelve si se pudo, para que quien lo llame pueda decirlo si le importa.
 *
 * 🔴 NO EXIGE QUE EL REGISTRO EXISTA, al revés que `writeSaveShot`. Aquí el orden es el
 * contrario: la miniatura se captura del canvas ANTES de que `saveLog` haya terminado
 * (el fotograma bueno es el del instante de parar; medio segundo después el jugador ya
 * ha movido). Exigir el registro obligaría a serializar las dos escrituras y a perder
 * la foto si la primera tarda. La huérfana que esto permite la barren `deleteLog` y
 * `clearAllLogs`, y sin registro que la enseñe no la ve nadie.
 */
export async function saveThumb(id: string, png: string): Promise<boolean> {
  try {
    const db = await openDb();
    try {
      const fila: ThumbRow = { id, png };
      await done(db.transaction(THUMBS, "readwrite").objectStore(THUMBS).put(fila));
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false; // cuota, modo privado, base bloqueada: la lista caerá al hueco con rótulo
  }
}

/**
 * Las miniaturas de estos ids, como mapa `id → dataURL`. Los que no tengan (toda
 * grabación anterior a esta entrega) NO aparecen en el mapa — la lista los pinta con su
 * hueco rotulado, que es la degradación declarada.
 *
 * Se piden en LOTE y no una por fila porque cada `openDb()` es una conexión: N filas
 * serían N aperturas de la base para pintar una lista.
 */
export async function getThumbs(ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(THUMBS, "readonly").objectStore(THUMBS);
      // Las peticiones se lanzan TODAS antes del primer `await`: una transacción de
      // IndexedDB se auto-confirma en cuanto el bucle de eventos vuelve sin peticiones
      // pendientes, así que pedirlas dentro de un bucle con `await` en medio dejaría la
      // transacción cerrada a mitad de lista (la misma trampa que documenta `clearAllLogs`).
      const pend = ids.map((id) => done<ThumbRow | undefined>(tx.get(id)));
      for (const fila of await Promise.all(pend)) {
        if (fila) out.set(fila.id, fila.png);
      }
      return out;
    } finally {
      db.close();
    }
  } catch {
    return out; // sin miniaturas la lista se pinta igual; es lo que promete la degradación
  }
}

/** Extensión y tipo del fichero de repetición exportado. Un JSON con el `ReplayLog` crudo. */
export const REPLAY_FILE_EXT = ".u5replay.json";

/**
 * EXPORTAR una repetición a un fichero (ficha #154, ítem 5).
 *
 * Hasta ahora una grabación no podía salir de este navegador POR NINGUNA SUPERFICIE: ni
 * desde el juego ni desde `/byo`. Quien cambiaba de portátil las perdía todas, y quien
 * quería enseñar una partida no tenía cómo. Las PARTIDAS sí se exportan desde hace tiempo
 * (`core/persistence.ts` exportSave / downloadNativeSave); esto cierra la simetría.
 *
 * 🔴 LA MINIATURA NO VIAJA, Y NO ES UN OLVIDO — es el invariante de la cabecera de este
 * módulo puesto por escrito en el único sitio nuevo por donde podía escaparse. Un fotograma
 * son PÍXELES RENDERIZADOS DEL JUEGO = material derivado de EA, y este almacén existe para
 * que no salga del navegador del visitante. La foto vive en el almacén `thumbs`, no dentro
 * del `ReplayLog`, así que serializar el log NO la arrastra: la separación que se hizo por
 * la contabilidad de `ReplayMeta.bytes` resulta ser también la que hace segura la
 * exportación. Se dice aquí porque el día que alguien «mejore» el export metiendo la foto
 * para que el fichero se vea bonito, este párrafo es lo que se lo impide.
 *
 * Lo que SÍ va es el ancla (estado serializado + semilla) y las teclas — que es lo que hace
 * a la repetición reproducible, y todo ello generado por el port.
 *
 * Devuelve `null` si el id no existe; el llamador decide qué decir.
 */
export async function exportLogFile(id: string): Promise<{ nombre: string; json: string } | null> {
  const log = await getLog(id);
  if (!log) return null;
  // Nombre legible pero seguro de sistema de ficheros: el rótulo lo escribe el jugador y
  // puede llevar barras, dos puntos o comillas (el default es «<sitio> · turno N», que ya
  // trae un carácter no-ASCII). Se conserva lo alfanumérico y se colapsa el resto.
  const base =
    log.label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "replay";
  return { nombre: `${base}${REPLAY_FILE_EXT}`, json: JSON.stringify(log) };
}

export async function deleteLog(id: string): Promise<void> {
  const db = await openDb();
  try {
    // Las DOS en la MISMA transacción y sin `await` entre medias: borrar el registro y
    // dejar su fotograma en la base sería incumplir el «no queda nada» por la puerta de
    // atrás, y con dos transacciones separadas la segunda puede no llegar a correr.
    const tx = db.transaction([STORE, THUMBS], "readwrite");
    const ido = done(tx.objectStore(STORE).delete(id));
    const foto = done(tx.objectStore(THUMBS).delete(id));
    await Promise.all([ido, foto]);
  } finally {
    db.close();
  }
}

/**
 * Borra TODAS las grabaciones y devuelve cuántas había. Lo usa el botón «borrar mis
 * datos» de `/byo`, que promete que no queda nada de tu paso por aquí.
 *
 * 🔴 Se vacía el ALMACÉN, no se borra la base. `indexedDB.deleteDatabase` se queda
 * BLOQUEADO mientras alguna pestaña tenga la base abierta y su promesa nunca resuelve:
 * el borrado se quedaría colgado sin error, que es la peor forma de fallar para un
 * botón cuyo mensaje final dice «borrado». `clear()` sobre la transacción cierra
 * siempre, y deja la base vacía — que es lo que se prometió.
 *
 * 🔴 Y son DOS transacciones, no una con dos peticiones: una transacción de IndexedDB
 * se auto-confirma en cuanto el bucle de eventos vuelve sin peticiones pendientes, así
 * que encadenar `count()` y `clear()` a través de un `await` depende de que la
 * continuación caiga en el mismo turno de microtareas. Funciona, hasta que un día no.
 */
export async function clearAllLogs(): Promise<number> {
  const db = await openDb();
  try {
    const n = await done(db.transaction(STORE, "readonly").objectStore(STORE).count());
    // 🔴 Las MINIATURAS entran en el mismo barrido, y por la misma razón por la que
    // `clearAllSaves` barre las capturas de las partidas: si se olvidaran, «este
    // navegador ya no guarda nada de tu paso por aquí» sería falso de la peor forma
    // posible — quedarían FOTOGRAMAS DE LA PARTIDA de alguien tras pulsar «borrar».
    // Van en la misma transacción y sin `await` entre medias (ver `deleteLog`).
    const tx = db.transaction([STORE, THUMBS], "readwrite");
    await Promise.all([
      done(tx.objectStore(STORE).clear()),
      done(tx.objectStore(THUMBS).clear()),
    ]);
    // Se devuelven las GRABACIONES, no las miniaturas: es lo que se le enseña al
    // usuario, y una foto no es una repetición (mismo criterio que `clearAllSaves`).
    return n;
  } finally {
    db.close();
  }
}
