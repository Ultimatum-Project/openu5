/**
 * Guardado libre (QoL, no fiel al original: U5 tenía un único SAVED.GAM).
 *
 * DECISIÓN: usamos `localStorage` en vez de OPFS. OPFS sería más limpio para
 * blobs grandes, pero su API es asíncrona y aún desigual entre navegadores;
 * `localStorage` es síncrono, universal y de sobra para un GameState serializado
 * (decenas de KB). Guardamos un índice ligero en `u5clone:saves` y cada partida
 * completa en `u5clone:save:<id>`, de modo que listar slots no obliga a
 * deserializar todos los estados.
 */
import type { GameState } from "./state.js";
import { serialize, deserialize } from "./state.js";
import {
  exportNativeSave,
  importNativeSave,
  buildNativeOol,
  SAVED_GAM_SIZE,
  type SaveSidecar,
} from "./saveNative.js";
import { emptySidecar, readU5gamEnvelope } from "./u5gam.js";
// 🔴 Las claves y la forma de la cabecera viven en `save-keys.ts`, no aquí. La pantalla
// `/byo` (mismo origen: la landing es `/byo.html` y el juego `/play.html`) lista y borra
// estas partidas, y necesita la disposición SIN arrastrar el modelo del juego. Un módulo
// sin importaciones es lo que permite que haya un solo sitio donde la clave se escribe.
import {
  AUTOSAVE_PTR_KEY,
  SAVES_INDEX_KEY as INDEX_KEY,
  SAVE_SHOT_PREFIX as SHOT_PREFIX,
  SAVE_SLOT_PREFIX as SLOT_PREFIX,
  readSaveIndex,
  type SaveMeta,
} from "./save-keys.js";

const AUTOSAVE_SLOTS = 3;

export type { SaveMeta };

/**
 * Resultado de una escritura de partida. Nunca lanzamos por cuota llena: el
 * hallazgo del soak (docs/superpowers/specs/2026-07-11-soak-findings.md, Tramo 2)
 * mostró que un `QuotaExceededError` sin capturar en el autosave del arranque
 * dejaba el juego medio inicializado ("boot zombie"). El llamante decide qué
 * hacer con el fallo (mensaje al usuario en el save manual, silencio+log en el
 * autosave).
 */
export type SaveResult =
  | { ok: true; meta: SaveMeta }
  | { ok: false; reason: "quota" | "unknown" };

/** ¿Es un fallo de cuota de almacenamiento (localStorage lleno)? */
function isQuotaError(err: unknown): boolean {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return (
      err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22 ||
      err.code === 1014
    );
  }
  const e = err as { name?: string; code?: number } | null;
  return e?.name === "QuotaExceededError" || e?.code === 22;
}

function readIndex(): SaveMeta[] {
  return readSaveIndex();
}

function writeIndex(list: SaveMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

/**
 * Escribe/actualiza un slot y su entrada de índice (upsert por id). Ante un
 * localStorage lleno devuelve `{ ok: false }` en vez de lanzar; el slot antiguo
 * (si existía) queda intacto porque `setItem` es atómico: o reemplaza o lanza.
 *
 * ── TRANSACCIONAL: CUERPO PRIMERO, ÍNDICE DESPUÉS, ROLLBACK SI EL ÍNDICE FALLA (#236) ──
 * Son DOS `setItem` y el segundo también puede reventar por cuota (el índice crece con
 * cada partida). Sin rollback, el cuerpo ya escrito quedaba HUÉRFANO: bytes en
 * `u5clone:save:<id>` que el índice no lista — una fuga de cuota invisible que encima
 * acerca el siguiente fallo. El orden es cuerpo→índice y no al revés a propósito: ante
 * un corte DURO (pestaña muerta entre las dos escrituras), cuerpo-primero deja o bien
 * bytes sueltos que `clearAllSaves` barre por prefijo, o bien (upsert) un estado nuevo
 * bajo cabecera vieja — molesto pero cargable. Índice-primero dejaría una entrada
 * apuntando a un cuerpo ausente o rancio, y `loadGame` LANZA sobre eso: el corte se
 * convertiría en una partida listada que no abre.
 */
function putSave(
  id: string,
  name: string,
  locationName: string,
  state: GameState,
  shot?: string | null,
  /** Campos extra de la cabecera (hoy: la procedencia de un momento legendario). */
  extra?: Pick<SaveMeta, "provenance" | "momentoId">,
): SaveResult {
  const meta: SaveMeta = {
    id,
    name,
    timestamp: Date.now(),
    turns: state.turnsSinceStart,
    locationName,
    ...extra,
  };
  // 🔴 La clave del cuerpo se escribe `SLOT_PREFIX + id` EN CADA LLAMADA, sin variable
  // intermedia: el censo de limpieza de /byo (`re/tools/test_byo_limpieza.py`) resuelve
  // las escrituras a localStorage siguiendo constantes con LITERAL, y un `const bodyKey
  // = SLOT_PREFIX + id` lo dejaría sin resolver — la puerta enrojece (medido en la
  // batería de este mismo fix) o, peor, obligaría a una exención que ya no PRUEBA que
  // el borrado cubre esta clave. (Y ojo: el censo lee TEXTO, comentarios incluidos —
  // nombrar aquí la llamada con su punto y su paréntesis plantó una clave fantasma.)
  // Foto del cuerpo ANTERIOR (null si la ranura es nueva): es lo que el rollback
  // restaura si el índice no cabe. Se toma antes de tocar nada.
  let prevBody: string | null;
  try {
    prevBody = localStorage.getItem(SLOT_PREFIX + id);
  } catch {
    prevBody = null; // almacenamiento bloqueado: el setItem de abajo fallará y saldremos
  }
  try {
    localStorage.setItem(SLOT_PREFIX + id, serialize(state));
  } catch (err) {
    // Falló el CUERPO: no se escribió nada, el estado previo está intacto.
    return { ok: false, reason: isQuotaError(err) ? "quota" : "unknown" };
  }
  try {
    const list = readIndex().filter((m) => m.id !== id);
    list.push(meta);
    writeIndex(list);
  } catch (err) {
    // Falló el ÍNDICE con el cuerpo ya escrito: deshacer el cuerpo para volver al
    // estado de antes de la llamada (ranura nueva → fuera; upsert → cuerpo anterior).
    try {
      if (prevBody === null) localStorage.removeItem(SLOT_PREFIX + id);
      else localStorage.setItem(SLOT_PREFIX + id, prevBody);
    } catch {
      // Ni el cuerpo VIEJO cabe (cabía hace un momento; rarísimo). Mejor borrar que
      // dejar un estado nuevo bajo la cabecera vieja del índice.
      try {
        localStorage.removeItem(SLOT_PREFIX + id);
      } catch {
        /* almacenamiento bloqueado por completo */
      }
    }
    return { ok: false, reason: isQuotaError(err) ? "quota" : "unknown" };
  }
  // 🔴 LA MINIATURA VA DESPUÉS Y SU FALLO NO TUMBA EL GUARDADO. Es adorno: perder la
  // partida por no poder guardar una foto sería un intercambio absurdo. Este `catch`
  // NO es una guarda de robustez sobre una ruta de medición (que taparía errores
  // propios): es la separación deliberada entre el dato y su ilustración, y sólo
  // envuelve la escritura de la foto. Si el hueco se agota, el slot ya está a salvo
  // arriba y la tarjeta caerá al minimapa, que es justo el respaldo previsto.
  if (shot) {
    try {
      localStorage.setItem(SHOT_PREFIX + id, shot);
    } catch {
      // Cuota: la partida está guardada; se queda sin foto y se dice con el fallback.
      try {
        localStorage.removeItem(SHOT_PREFIX + id); // no dejar una foto a medias del slot ANTERIOR
      } catch {
        /* almacenamiento bloqueado por completo */
      }
    }
  }
  return { ok: true, meta };
}

/** Slots existentes, del más reciente al más antiguo. */
export function listSaves(): SaveMeta[] {
  return readIndex().sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * El save MÁS RECIENTE (por timestamp), deserializado — o `null` si no hay ninguno.
 * Es el equivalente de "cargar SAVED.GAM": el menú de portada del original recarga
 * SAVED.GAM verbatim en **Journey Onward** (`INTRO.OVL intro_main_controller 0x0986`;
 * `re/notes/gypsy.md:11-13`). Aquí SAVED.GAM = el slot con mayor timestamp, sea el
 * autosave rotatorio de (Q) o un guardado manual. Sin ninguno → `null` (el arranque
 * sigue con partida nueva, como el SAVED.GAM por defecto que el disco original trae).
 */
export function loadMostRecentSave(): GameState | null {
  const id = mostRecentSaveId();
  return id === null ? null : loadGame(id);
}

/**
 * El ID del save que `loadMostRecentSave` cargaría, o `null` si no hay ninguno.
 *
 * Existe para que el arranque pueda decir DE QUÉ RANURA salió el estado que restauró — lo
 * necesita la re-captura de miniaturas viejas (`ui/shot-refresh.ts`), que escribe en
 * `u5clone:shot:<id>`. Se extrae aquí, y `loadMostRecentSave` pasa a apoyarse en ella, para
 * que «cuál es la más reciente» tenga UN dueño: una segunda copia del criterio en el
 * llamador podría desviarse del que de verdad se carga y re-escribiría la foto de OTRA
 * partida — que es un fallo silencioso y plausible.
 */
export function mostRecentSaveId(): string | null {
  const saves = listSaves(); // ya ordenado desc por timestamp
  return saves[0]?.id ?? null;
}

export function saveGame(
  state: GameState,
  name: string,
  locationName: string,
  shot?: string | null,
): SaveResult {
  const id = `save-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return putSave(id, name.trim() || "Untitled", locationName, state, shot);
}

/**
 * Siembra (o re-siembra) un MOMENTO LEGENDARIO como partida del jugador.
 *
 * ── POR QUÉ VIVE AQUÍ Y NO EN LA LANDING ────────────────────────────────────────────────
 * Decisión #4 del spec: un momento se escribe en el MISMO almacén que los saves propios, y
 * eso significa por la MISMA función. Si `/byo` hiciera su propio `setItem`, habría dos
 * escritores del índice `u5clone:saves` y el día que cambie su forma sólo se actualizaría
 * uno — el defecto que `save-keys.ts` documenta en su cabecera, cometido por el otro lado.
 *
 * ── IDEMPOTENTE POR CONSTRUCCIÓN, NO POR COMPROBACIÓN ───────────────────────────────────
 * 🔴 El `id` del slot ES el id del momento (estable), y `putSave` hace upsert: filtra el
 * índice por id antes de empujar la cabecera nueva. Así «añadir dos veces» deja UNA entrada
 * sin que nadie tenga que acordarse de mirar antes si ya estaba — que es la clase de
 * comprobación que se olvida en la segunda vía de llamada. El `timestamp` sí se refresca: es
 * cuándo se añadió, y re-añadir es añadir otra vez.
 */
export function installMomentoSave(
  momentoId: string,
  state: GameState,
  name: string,
  locationName: string,
): SaveResult {
  return putSave(momentoId, name, locationName, state, null, {
    provenance: "momento",
    momentoId,
  });
}

/**
 * Instala una partida que llega DE FUERA (un fichero que el jugador trae de otro
 * dispositivo; ver `demo-byo/src/exporta.ts`) como una partida más de este navegador.
 *
 * ── POR QUÉ NO ES `saveGame` A SECAS ────────────────────────────────────────────────────
 * Por `provenance`. Una partida sembrada por la galería de momentos lleva su insignia para
 * que «quien vuelve dentro de un mes pueda distinguir la partida que jugó de la que se le
 * puso ahí» (`save-keys.ts:47-57`), y ese hecho SIGUE SIENDO VERDAD después de un traslado:
 * perderlo al cruzar de un dispositivo a otro convertiría la insignia en una propiedad del
 * navegador en vez de una propiedad de la partida. `saveGame` no tiene por dónde pasarla.
 *
 * 🔴 Y VIVE AQUÍ POR LA MISMA RAZÓN QUE `installMomentoSave`: el índice `u5clone:saves` lo
 * escribe `putSave` y NADIE MÁS. Un `setItem` en la landing sería el segundo escritor, y el
 * día que la cabecera cambie de forma sólo se actualizaría uno.
 *
 * El `id` es NUEVO (mismo formato que el de `saveGame`) y no el del origen: dos dispositivos
 * pueden tener la misma partida importada dos veces con historias distintas desde entonces, y
 * reutilizar el id de origen haría que la segunda importación PISARA a la primera en silencio.
 * Por eso tampoco viaja `momentoId`: ése ES el id de su ranura, y aquí la ranura es otra.
 */
export function installImportedSave(
  state: GameState,
  name: string,
  locationName: string,
  provenance?: SaveMeta["provenance"],
): SaveResult {
  const id = `save-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return putSave(id, name.trim() || "Untitled", locationName, state, null,
    provenance ? { provenance } : undefined);
}

/**
 * DE QUÉ RANURA SALIÓ EL ESTADO QUE SE ESTÁ USANDO — o `null` si no salió de ninguna.
 *
 * POR QUÉ EXISTE Y POR QUÉ AQUÍ. La re-captura de miniaturas viejas
 * (`ui/shot-refresh.ts`) necesita saber a qué clave `u5clone:shot:<id>` re-escribir, y el
 * callback `onLoad` del panel de partidas entrega el GameState SIN su id. La forma limpia
 * sería pasarlo por ese callback; no se hace porque `ui/savepanel.ts` tiene otro dueño en
 * esta ola (ver la entrega de #153). Así que el dato se anota DONDE de verdad se conoce:
 * en el único sitio que carga una ranura por id.
 *
 * 🔴 EL BORRADO EN LOS CAMINOS DE IMPORTAR NO ES SIMETRÍA DECORATIVA, ES LA GUARDA. Un
 * estado IMPORTADO no viene de ninguna ranura, y si esta variable conservase el id de la
 * carga ANTERIOR, la re-captura escribiría la foto de la partida importada encima de la
 * miniatura de OTRA partida — un dato plausible en el sitio equivocado, que es la peor
 * forma de fallo porque nadie lo mira. El `null` es la respuesta correcta ahí.
 */
let slotUltimaCarga: string | null = null;

/** La ranura de la última carga, o `null` si lo último que entró fue una importación. */
export function slotDeLaUltimaCarga(): string | null {
  return slotUltimaCarga;
}

export function loadGame(id: string): GameState {
  const raw = localStorage.getItem(SLOT_PREFIX + id);
  if (raw === null) throw new Error(`No existe la partida guardada: ${id}`);
  const state = deserialize(raw);
  // Después del `deserialize`: un JSON corrupto lanza y NO debe dejar anotada una carga
  // que no ocurrió.
  slotUltimaCarga = id;
  return state;
}

export function deleteSave(id: string): void {
  localStorage.removeItem(SLOT_PREFIX + id);
  localStorage.removeItem(SHOT_PREFIX + id); // o la foto sobrevive a su partida
  writeIndex(readIndex().filter((m) => m.id !== id));
}

/**
 * Autoguardado rotatorio en `autosave-1/2/3` (round-robin) para no pisar
 * historia. Nunca lanza: un fallo de cuota devuelve `{ ok: false }` y el juego
 * sigue (el llamante lo loguea). Ver nota en {@link SaveResult}.
 *
 * 🔴 EL PUNTERO SE CONSUME DESPUÉS DEL ÉXITO, NO ANTES (#236). Avanzarlo antes de
 * escribir gastaba una ranura de la rotación por cada fallo: tres autosaves fallidos
 * seguidos (cuota llena) daban la vuelta entera al anillo sin guardar nada, y el
 * siguiente que SÍ cabía pisaba `autosave-1` — el más antiguo superviviente — en vez
 * de la ranura que llevaba tres turnos esperando. Con el orden correcto, un fallo
 * deja el puntero quieto y el retry cae en la MISMA ranura.
 */
export function autosave(
  state: GameState,
  locationName: string,
  shot?: string | null,
): SaveResult {
  const ptr = Number(localStorage.getItem(AUTOSAVE_PTR_KEY) ?? "0") || 0;
  const slot = (ptr % AUTOSAVE_SLOTS) + 1;
  const res = putSave(`autosave-${slot}`, `Autosave ${slot}`, locationName, state, shot);
  if (res.ok) {
    try {
      localStorage.setItem(AUTOSAVE_PTR_KEY, String(ptr + 1));
    } catch {
      // El puntero es diminuto y el putSave de arriba acaba de caber; si aun así no
      // cabe, el save YA está a salvo — el siguiente autosave reusará esta ranura
      // (pisa el más reciente en vez de rotar), que es el degradado menos malo.
    }
  }
  return res;
}

/**
 * Dispara la descarga de un Blob con un nombre de fichero.
 *
 * 🔴 La revocación va en el TURNO SIGUIENTE (`setTimeout(…, 0)`), no en la línea de
 * después del `click()`. Revocar síncrono funciona en Chrome —que arranca la
 * transferencia dentro del propio `click()`— y da descargas VACÍAS o canceladas SIN
 * error en Safari/iOS, donde el objeto tiene que seguir vivo mientras el navegador
 * arranca la descarga. El gesto y su porqué vienen de `descarga` en
 * `demo-byo/src/exporta.ts`, donde se descubrió primero; el conocimiento vivía sólo
 * allí y las dos copias del juego se quedaron con la forma frágil.
 *
 * Importa DOBLE aquí: `downloadNativeSave` llama tres veces seguidas (.GAM, .OOL y
 * sidecar), o sea tres URL vivas a la vez — el caso más expuesto de todo el port.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Descarga el estado actual como fichero JSON (backup fuera del navegador). */
export function exportSave(state: GameState): void {
  triggerDownload(
    new Blob([serialize(state)], { type: "application/json" }),
    `u5clone-save-${Date.now().toString(36)}.json`,
  );
}

/**
 * Guardado NATIVO (task #27): descarga un `SAVED.GAM` byte-válido de 4192 B — el
 * MISMO formato que el Ultima V original, cargable en DOSBox — más su sidecar JSON
 * (`SAVED.sidecar.json`) con lo que el formato de 1988 no captura (diario, minimapa,
 * objetos del mundo, estado runtime; ver saveNative.ts). `template` = la plantilla
 * base de 4192 B (/assets/init.gam) cuyos bytes oscuros se preservan. Requisito del
 * espejo del Grand Tour: un checkpoint del clon y uno del original son comparables.
 */
export function downloadNativeSave(
  state: GameState,
  template: Uint8Array,
  oolTemplate?: Uint8Array | null,
): void {
  const { gam, sidecar } = exportNativeSave(state, template);
  const stamp = Date.now().toString(36);
  // gam es un slice fresco de 4192 B → su buffer es un ArrayBuffer plano de ese tamaño.
  triggerDownload(
    new Blob([gam.buffer as ArrayBuffer], { type: "application/octet-stream" }),
    "SAVED.GAM",
  );
  // SAVED.OOL (512 B, overlay overworld++underworld) — writer buildNativeOol
  // (ítem saved-ool-no-generado). Se emite junto al .GAM cuando el caller aporta
  // la plantilla de siembra (/assets/init.ool = BRIT.OOL++UNDER.OOL); el DOS
  // exige ambos ficheros para un Journey Onward completo.
  if (oolTemplate !== undefined) {
    const ool = buildNativeOol(state, oolTemplate);
    triggerDownload(
      new Blob([ool.buffer as ArrayBuffer], { type: "application/octet-stream" }),
      "SAVED.OOL",
    );
  }
  triggerDownload(
    new Blob([JSON.stringify(sidecar)], { type: "application/json" }),
    `SAVED-${stamp}.sidecar.json`,
  );
}

/** Lee un fichero JSON exportado y lo valida como GameState. */
export async function importSave(file: File): Promise<GameState> {
  const text = await file.text();
  const state = deserialize(text);
  slotUltimaCarga = null; // lo importado no viene de ninguna ranura (ver `slotDeLaUltimaCarga`)
  return state;
}

/**
 * Carga un save NATIVO: un `SAVED.GAM` (4192 B) + su sidecar JSON. Inverso de
 * `downloadNativeSave`. Si no hay sidecar (p.ej. un save del ORIGINAL importado
 * directo), reconstruye con un sidecar vacío (defaults de partida nueva para lo
 * no-mapeado). Ver saveNative.importNativeSave.
 *
 * ── Y TAMBIÉN COME UN `.u5gam`, QUE LLEVA SU SIDECAR PEGADO DETRÁS (#229) ───────────────
 * 🔴 El `.u5gam` que emite `/byo` para llevarse una partida a otro dispositivo son los
 * MISMOS 4192 B con el sobre detrás, así que hasta aquí llegaba entero y se le tiraba la
 * cola: la partida entraba SIN trama (los Shadowlords vivos otra vez), SIN diario y sin los
 * objetos del mundo que el formato de 1988 no sabe escribir. No fallaba — daba una partida
 * distinta con pinta de buena, que es el modo de fallo contra el que existe el sobre.
 * El sobre se lee AQUÍ y no en el llamante para que las tres puertas de importación (la
 * landing, este camino y el del `.gam` pelado) coincidan en qué significa cada caso.
 *
 * PRECEDENCIA: un `sidecarFile` EXPLÍCITO gana al sobre. Quien selecciona los tres ficheros
 * de `downloadNativeSave` (`SAVED.GAM` + `SAVED.OOL` + `SAVED-*.sidecar.json`) está diciendo
 * cuál es su sidecar, y ése manda sobre cualquier cola que el `.gam` traiga pegada.
 *
 * 🔴 DEVUELVE DE DÓNDE SALIÓ EL SIDECAR, y no es adorno: el panel le dice al jugador si lo
 * que el formato de 1988 no guarda ha viajado o empieza de cero, y esa frase NO puede
 * deducirse del nombre del fichero — un `.u5gam` con el sobre ROTO se llama igual que uno
 * sano. El rótulo se deriva de lo que pasó, no de la extensión.
 */
export interface NativeImport {
  state: GameState;
  /** `"file"` = sidecar JSON explícito · `"envelope"` = el sobre del `.u5gam` · `"none"` = vacío. */
  sidecarSource: "file" | "envelope" | "none";
}

export async function importNativeSaveFiles(
  gamFile: File,
  sidecarFile?: File,
): Promise<NativeImport> {
  const gam = new Uint8Array(await gamFile.arrayBuffer());
  if (gam.length < SAVED_GAM_SIZE) {
    throw new Error(`SAVED.GAM inválido: ${gam.length} < ${SAVED_GAM_SIZE} bytes`);
  }
  let sidecar: SaveSidecar;
  let sidecarSource: NativeImport["sidecarSource"];
  if (sidecarFile) {
    sidecar = JSON.parse(await sidecarFile.text()) as SaveSidecar;
    sidecarSource = "file";
  } else {
    // Un sobre ROTO cae al vacío igual que un `.gam` pelado: `readU5gamEnvelope` ya
    // distingue los tres casos y los dos malos degradan, nunca lanzan.
    const leido = readU5gamEnvelope(gam);
    sidecar = leido.kind === "ok" ? leido.envelope.sidecar : emptySidecar();
    sidecarSource = leido.kind === "ok" ? "envelope" : "none";
  }
  const state = importNativeSave(gam, sidecar);
  slotUltimaCarga = null; // ídem que `importSave`: sin ranura de origen
  return { state, sidecarSource };
}
