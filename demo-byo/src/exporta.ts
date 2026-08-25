/**
 * LLEVARSE UNA PARTIDA A OTRO DISPOSITIVO — por FICHERO, de tu mano a tu mano.
 *
 * ── EA-LIMPIO POR CONSTRUCCIÓN, Y ÉSA ES LA RAZÓN DE QUE SEA UN FICHERO ─────────────────
 * No hay servidor, no hay subida, no hay enlace. El fichero lo genera ESTE navegador con TU
 * copia y baja a TU disco; para llevarlo al otro dispositivo lo mueves tú, por el medio que
 * quieras. Un `.gam` de una partida jugada lleva dentro el roster de 16 registros de Ultima V
 * (nombres, cifras y equipo de los compañeros de EA — `saveNative.ts:41-53`), así que este
 * camino es el ÚNICO que puede existir: en cuanto hubiera un endpoint, ese material estaría
 * pasando por una máquina nuestra. Por lo mismo, ni un byte de lo que aquí se produce entra
 * en el repositorio (CLAUDE.md REGLA 4): los ficheros de los tests son SINTÉTICOS.
 *
 * ── QUÉ HAY DENTRO DEL FICHERO, Y POR QUÉ NO ES SÓLO EL `.GAM` ──────────────────────────
 *   [0x0000 .. 0x1060)   SAVED.GAM — 4192 B, byte a byte lo que emite `exportNativeSave`
 *   [0x1060 .. 0x1060+11) la marca `U5PARTIDA1\n`
 *   [ .. EOF)            el SOBRE, JSON UTF-8: cabecera de índice + SIDECAR
 *
 * 🔴 EL SIDECAR VIAJA O EL TRASLADO MIENTE. El SAVED.GAM de 1988 no tiene hueco para media
 * docena de cosas que el clon sí modela, y la lista está escrita en `saveNative.ts:159-193`:
 * `questFlags`, `worldObjects`, `overworldEnemies`, `transport`, el diario, el mapa
 * explorado. Mandar sólo los 4192 B **no da un fichero peor: da una partida distinta y con
 * pinta de buena**, y las dos formas del defecto ya están MEDIDAS en este repositorio:
 *   · 🔴 EJEMPLO RETIRADO POR #238 (mismo destino que el de la fragata, abajo): decía «los
 *     tres Shadowlords muertos viven en `questFlags['shadowlord-dead:*']` y NO en el .gam».
 *     Era cierto hasta que #238 cableó la capa de trama a sus bytes nativos (+0x322 ≥0x80 =
 *     destruido) y `importNativeSave` deriva hoy esos flags de un `.gam` pelado. Lo que
 *     SIGUE sin viajar de `questFlags` es todo lo demás: claves de trama del port sin celda
 *     en 1988 (in-doom, arrest, etc.);
 *   · de `worldObjects` no viaja NADA que el formato de 1988 no sepa escribir: cofres,
 *     antorchas de pared, botín-suelo, ítems de trama y todo objeto de INTERIOR llegan sin
 *     rastro al otro dispositivo.
 * 🔴 EL EJEMPLO QUE ESTABA AQUÍ YA NO VALE, y se retira nombrándolo: esta línea decía «la
 * fragata de (20,130) desaparece del mundo» (ficha #106, medida por video-split). Era cierto
 * hasta que #106 se arregló — `importNativeSave` reconstruye ahora las NAVES ATRACADAS del
 * overworld leyendo la tabla nativa 0x6B4 cuando no hay sidecar (`readNativeWorldObjects`,
 * saveNative.ts). Un `.gam` pelado sí recupera hoy esa fragata. Se corrige SÓLO el ejemplo:
 * la tesis —el sobre es la mitad del formato— la sostiene el resto de `worldObjects` (y las
 * claves de `questFlags` sin celda de 1988), que siguen sin un byte donde caerse en los 4192.
 * Por eso el sobre no es un extra: es la mitad del formato. Lo que se descarga SIGUE siendo
 * un `.gam` nativo —sus primeros 4192 B son exactamente los que el juego escribiría, y el
 * `slice(0, 0x1060)` los recupera intactos—, con el resto detrás.
 * ⚠ NO SE AFIRMA que DOSBox tolere la cola: no está medido. Quien quiera alimentar al
 * original recorta a 4192 B, que es una operación exacta y comprobada por el test.
 *
 * ── Y UN `.GAM` PELADO TAMBIÉN SE ACEPTA ────────────────────────────────────────────────
 * Un fichero de 4192 B sin marca entra igual, DEGRADADO y diciéndolo: es lo que trae quien
 * llega desde el DOS o desde otra herramienta, y `importNativeSave` ya sabe reconstruir con
 * sidecar vacío (`persistence.ts:267-282` hace lo mismo). Lo que no se hace es fingir que la
 * partida está completa cuando no lo está.
 *
 * ── CHUNK APARTE, COMO `momentos-instala.ts` Y POR SU MISMA RAZÓN ───────────────────────
 * Este fichero arrastra el MODELO DEL JUEGO (`state.ts` + `saveNative.ts` + `persistence.ts`)
 * — justo lo que `save-keys.ts` existe para mantener fuera del bundle de una landing cuyo
 * trabajo es leer una carpeta y arrancar. Entra por `import()` desde `partidas.ts`: quien no
 * descargue ni importe no paga un byte.
 */
import { deserialize, serialize, type GameState } from "../../game/src/core/state.js";
import {
  exportNativeSave,
  SAVED_GAM_SIZE,
  importNativeSave,
  type SaveSidecar,
} from "../../game/src/core/saveNative.js";
import { installImportedSave } from "../../game/src/core/persistence.js";
import { SAVE_SLOT_PREFIX, type SaveMeta } from "../../game/src/core/save-keys.js";
// 🔴 LA MARCA Y LA LECTURA DEL SOBRE YA NO VIVEN AQUÍ (#229). Se mudaron a `core/u5gam.ts`
// porque este fichero no es el único que abre un `.u5gam`: el panel de guardado del JUEGO
// también, y con la marca declarada sólo aquí no podía reconocerlo. La razón larga —y por
// qué copiarla habría fallado MUDO— está en la cabecera de ese módulo.
import {
  U5GAM_MARKER as MARCA,
  emptySidecar,
  readU5gamEnvelope,
  type U5gamEnvelope as Sobre,
} from "../../game/src/core/u5gam.js";
// 🔴 SE REUTILIZA, NO SE COPIA. `generaShotDelMomento` sólo recibe un ID de ranura y arranca
// `/play.html?save=<id>&shot=<id>` en un iframe fuera de pantalla: no sabe nada de momentos y
// vale igual para una partida importada. Sus cuarenta líneas son MEDIDAS (el `visibility:
// hidden` que daba capturas negras, el presupuesto de 20 s, el desmontaje en el `finally`);
// copiarlas aquí sería tener dos versiones de un camino que costó tres mediciones acertar.
// El nombre se le quedó pequeño, pero renombrarlo es del dueño de ese fichero, no mío.
import { generaShotDelMomento as generaCaptura } from "./momentos-instala.js";
import { txt } from "./idioma.js";

// ══ ESCRITURA ═══════════════════════════════════════════════════════════════════════════

/**
 * Compone el fichero: los 4192 B del `.gam` seguidos de la marca y del sobre en JSON.
 * PURA — no toca ni el DOM ni la red, que es lo que permite que el arnés la mida entera.
 */
export function componeFichero(
  state: GameState,
  meta: Sobre["meta"],
  plantilla: Uint8Array,
): Uint8Array {
  const { gam, sidecar } = exportNativeSave(state, plantilla);
  const sobre: Sobre = { formato: "openu5-partida", version: 1, meta, sidecar };
  const cola = new TextEncoder().encode(MARCA + JSON.stringify(sobre));
  const out = new Uint8Array(gam.length + cola.length);
  out.set(gam, 0);
  out.set(cola, gam.length);
  return out;
}

/**
 * Nombre de fichero INFORMATIVO: personaje · lugar · fecha.
 *
 * 🔴 Y ES INFORMATIVO PORQUE NADIE LO LEE DE VUELTA. Al importar, el nombre de la partida
 * sale del SOBRE, no del nombre del fichero: quien renombre el suyo «para ordenarlo» no puede
 * cambiar con eso lo que la partida dice ser. Aquí el nombre sólo sirve para que una carpeta
 * con seis descargas se pueda mirar sin abrirlas.
 *
 * El personaje es `characters[0]`, el AVATAR, que es el nombre que TÚ tecleaste al empezar
 * (los otros quince son de EA, y por eso no aparece ninguno más). La fecha es la del guardado
 * en tu reloj, no la del juego: es la que distingue dos partidas del mismo sitio.
 */
export function nombreDeFichero(state: GameState, meta: Sobre["meta"]): string {
  const d = new Date(meta.timestamp);
  const p2 = (n: number): string => String(n).padStart(2, "0");
  const fecha = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  return [limpia(state.characters[0]?.name), limpia(meta.locationName), fecha]
    .filter((s) => s !== "")
    .join("-") + ".u5gam";
}

/**
 * Trocito de nombre APTO PARA UN SISTEMA DE FICHEROS. Se queda con letras, cifras y guiones
 * y tira el resto: una barra en el nombre de un lugar convertiría la descarga en una ruta, y
 * los acentos y los espacios viajan mal entre un móvil y un escritorio. Si no queda nada
 * (nombre vacío, o todo signos), devuelve cadena vacía y el llamante lo omite — un fichero
 * llamado `--2026-08-08.u5gam` sería peor que uno sin esa pieza.
 */
function limpia(s: string | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // un nombre con tilde da el mismo trozo que sin ella
    // 🔴 EL APÓSTROFO CAE AQUÍ DENTRO, EN «todo lo demás → guion», Y SE QUEDA ASÍ — decisión
    // del lead en #132, y está MEDIDA, que es lo que la hace defendible. La alternativa
    // tentadora es elidirlo (`.replace(/'/g, "")`) porque mejora los tres topónimos
    // posesivos del pool… pero `limpia()` NO es sólo para topónimos: la primera pieza del
    // nombre es el NOMBRE DEL PERSONAJE, y ahí la misma regla resta:
    //
    //     nombre                 con guion (HOY)         elidiendo
    //     O'Brien                O-Brien                 OBrien      ← funde dos mayúsculas
    //     D'Artagnan             D-Artagnan              DArtagnan   ← íd.
    //     Serpent's Hold         Serpent-s-Hold          Serpents-Hold  ← aquí sí mejora
    //     Lord British's Castle  Lord-British-s-Castle   Lord-Britishs-Castle ← ni una ni otra
    //
    // UNA función, DOS poblaciones con reglas opuestas: la que arregla una estropea la otra.
    // Mientras esté compartida gana la conservadora. Separarla en dos saneados (persona /
    // topónimo) es lo único que dejaría elidir sin coste, y eso lleva decisión de producto
    // detrás, no un `.replace` de paso.
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Dispara la descarga de un Blob.
 *
 * Hermano de `triggerDownload` (función de `game/src/core/persistence.ts`) y hoy con el
 * MISMO gesto: la URL se revoca en el turno siguiente y no en la línea de después del
 * `click()`. Revocarla síncrona funciona en Chrome y ha dado descargas vacías en otros
 * motores — el objeto tiene que seguir vivo mientras el navegador arranca la descarga.
 * Esa forma se descubrió aquí y durante un tiempo fue «una diferencia deliberada» con
 * aquélla; era, en realidad, un defecto de aquélla que nadie había traído, y se corrigió
 * con la ficha #233. No se unifican porque una vive dentro del juego y ésta en la landing:
 * son dos bundles distintos y el módulo que las compartiera arrastraría el modelo del
 * juego (ver la cabecera). Se citan por NOMBRE DE FUNCIÓN y fichero, sin número de línea:
 * esta cita decía `persistence.ts:207` cuando la función ya vivía doscientas líneas más
 * abajo, y una cita que caduca sola es la que hace buscar un defecto donde no está.
 */
function descarga(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Plantilla base de 4192 B: `/assets/init.gam`, o sea el INIT.GAM de la copia del VISITANTE
 * (lo sirve el service worker desde la Cache Storage — ver `momentos-instala.ts:9-18`).
 *
 * 🔴 SIN ELLA SE EXPORTA IGUAL, con una plantilla a ceros, y esto NO pierde nada de la
 * partida: el `GameState` que hay en `localStorage` es JSON y NUNCA ha contenido los bytes
 * oscuros del formato (la tabla de objetos, los character-states, las listas de movimiento).
 * Lo único que cambia es de dónde salen esos bytes que la partida no tiene: del INIT.GAM del
 * visitante, o de cero. La ida y vuelta dentro de OpenU5 es idéntica en los dos casos; lo que
 * la plantilla del visitante añade es un `.gam` con la pinta que tendría uno del DOS.
 * ⇒ Por eso la descarga NO exige extracción: quien haya vaciado su caché pero conserve sus
 * partidas tiene que poder llevárselas, que es exactamente cuando más falta hace.
 */
async function plantilla(): Promise<Uint8Array> {
  try {
    const r = await fetch("/assets/init.gam");
    if (r.ok) {
      const b = new Uint8Array(await r.arrayBuffer());
      if (b.length >= SAVED_GAM_SIZE) return b;
    }
  } catch {
    /* sin service worker o sin caché: se cae a la plantilla a ceros */
  }
  return new Uint8Array(SAVED_GAM_SIZE);
}

/**
 * Deja LISTO el fichero de la partida `meta.id`: sus bytes y su nombre. `null` si la ranura
 * no está o no se puede leer.
 *
 * 🔴 SEPARADA DE LA DESCARGA A PROPÓSITO, y no por gusto arquitectónico — es la misma razón
 * por la que `siembraMomento` está separada de su `fetch` (`momentos-instala.ts:76-82`): ésta
 * es la parte que el arnés puede ejecutar bajo node, y la única que NO se puede medir de otra
 * forma es precisamente ésta. Lo comprobó un MUTANTE: con la composición de la cabecera
 * dentro de la función que hace `a.click()`, el mutante que borraba el viaje de `provenance`
 * SOBREVIVÍA — el arnés llamaba a `componeFichero` con una cabecera hecha a mano y nunca
 * pasaba por la línea que la construye desde el `SaveMeta`. Lo que queda sin cubrir por el
 * pytest es el `click()`, y de eso se ocupa la sonda de navegador.
 */
export async function preparaDescarga(
  meta: SaveMeta,
): Promise<{ bytes: Uint8Array; nombre: string } | null> {
  let crudo: string | null;
  try {
    crudo = localStorage.getItem(SAVE_SLOT_PREFIX + meta.id);
  } catch {
    return null; // almacenamiento bloqueado
  }
  if (!crudo) return null; // la ranura se fue entre que se pintó la lista y se pulsó
  let state: GameState;
  try {
    state = deserialize(crudo);
  } catch {
    return null; // ranura corrupta: no se descarga basura con nombre de partida
  }
  const cabecera: Sobre["meta"] = {
    name: meta.name,
    locationName: meta.locationName,
    turns: meta.turns,
    timestamp: meta.timestamp,
    // 🔴 `provenance` VIAJA y `momentoId` NO, y no es una omisión. La insignia dice de dónde
    // SALIÓ la partida y eso sigue siendo verdad al otro lado del traslado; el `momentoId`, en
    // cambio, ES el id de la ranura en el navegador que lo sembró (`save-keys.ts:57-70`), y
    // aquí la ranura será otra — llevarlo sería publicar una identidad que ya no se cumple.
    ...(meta.provenance ? { provenance: meta.provenance } : {}),
  };
  // 🔴 EL COMPOSITOR TAMBIÉN VA DENTRO DE UNA GUARDA, y no estaba: `exportNativeSave` LANZA
  // si el estado no trae algún campo que el `.gam` modela —`state.lbArtifacts.amulet`, sin ir
  // más lejos (`saveNative.ts:556`)—, y una ranura vieja de un formato anterior puede pasar
  // `assertValidState`, que no mira esos campos, y morir aquí. Lo vi en el navegador con una
  // ranura sembrada a mano. Sin esto la función RECHAZA la promesa en vez de devolver `null`,
  // que es lo que su propia firma promete; el llamante lo tapaba con un `.catch`, o sea que
  // el mensaje al usuario era el mismo y el contrato, mentira.
  try {
    return {
      bytes: componeFichero(state, cabecera, await plantilla()),
      nombre: nombreDeFichero(state, cabecera),
    };
  } catch {
    return null; // ranura que el códec no sabe escribir: mensaje, no excepción suelta
  }
}

/** Prepara el fichero y lo baja. Devuelve su nombre, o `null` si no se pudo preparar. */
export async function descargaPartida(meta: SaveMeta): Promise<string | null> {
  const listo = await preparaDescarga(meta);
  if (!listo) return null;
  descarga(
    new Blob([listo.bytes.buffer as ArrayBuffer], { type: "application/octet-stream" }),
    listo.nombre,
  );
  return listo.nombre;
}

// ══ LECTURA ═════════════════════════════════════════════════════════════════════════════

/** Por qué se rechazó un fichero. Cada clave tiene su frase en `idioma.ts`. */
export type MotivoRechazo = "corto" | "no-es-partida" | "codec";

/** Qué se perdió por el camino, si algo. `null` = el fichero venía entero. */
export type Degradacion = null | "sin-sobre" | "sobre-ilegible";

export type Lectura =
  | { ok: true; state: GameState; meta: Sobre["meta"]; degradado: Degradacion }
  | { ok: false; motivo: MotivoRechazo; detalle?: string };

/**
 * VALIDACIÓN ESTRUCTURAL de la ventana SAVED.GAM. Devuelve `null` si pasa.
 *
 * ── POR QUÉ HACE FALTA, SI YA HAY UN VALIDADOR ─────────────────────────────────────────
 * Porque `assertValidState` (`state.ts:531`) comprueba FORMA —que los campos existan y sean
 * números— y aquí todos lo son SIEMPRE: `parseSaveWindow` lee bytes, y cualquier fichero de
 * 4192 bytes, incluido un JPEG, produce un `GameState` de tipos perfectos con valores
 * absurdos. Sin este trozo, soltar una foto en el importador metería en la lista una partida
 * con 214 miembros de grupo en el mes 87. **El validador que hay no puede fallar, y por eso
 * no basta.** (Se usa igualmente, después: son dos preguntas distintas.)
 *
 * Los cinco predicados son INVARIANTES DEL FORMATO, no umbrales elegidos. Cada uno con su
 * offset de `saveNative.ts`:
 *   · el grupo (0x2B5) está entre 1 y 6 — MAX_PARTY = 6 (`party.ts:9`), y 0 no existe: el
 *     Avatar siempre está;
 *   · el Avatar (registro 0, +0x1F) viaja en el grupo: `partyStatus === 0` (`state.ts:31`);
 *   · su nombre (registro 0, 9 B) es ASCII imprimible hasta el NUL;
 *   · la fecha del juego es una fecha: mes 1-12 (0x2D7), día 1-31 (0x2D8);
 *   · y la hora es una hora: 0-23 (0x2D9), 0-59 (0x2DB).
 * Sobre bytes al azar los cinco juntos pasan con probabilidad del orden de 10⁻⁷.
 */
function validaVentana(gam: Uint8Array): string | null {
  const grupo = gam[0x2b5]!;
  if (grupo < 1 || grupo > 6) return `partySize=${grupo}`;
  if (gam[0x02 + 0x1f]! !== 0) return `avatar partyStatus=${gam[0x02 + 0x1f]!}`;
  for (let i = 0; i < 9; i++) {
    const b = gam[0x02 + i]!;
    if (b === 0) break; // terminador: el resto del campo no se mira
    if (b < 0x20 || b > 0x7e) return `nombre del avatar byte ${i}=0x${b.toString(16)}`;
  }
  const mes = gam[0x2d7]!;
  const dia = gam[0x2d8]!;
  const hora = gam[0x2d9]!;
  const min = gam[0x2db]!;
  if (mes < 1 || mes > 12) return `mes=${mes}`;
  if (dia < 1 || dia > 31) return `dia=${dia}`;
  if (hora > 23) return `hora=${hora}`;
  if (min > 59) return `minuto=${min}`;
  return null;
}

/**
 * Lee un fichero de partida: bytes → resultado. Es la función que el arnés puede correr
 * entera, y por eso las DOS degradaciones (`sin-sobre`, `sobre-ilegible`) y los TRES rechazos
 * (`corto`, `no-es-partida`, `codec`) se pueden medir uno a uno.
 *
 * 🔴 NUNCA LANZA Y NUNCA ESCRIBE. El índice `u5clone:saves` no se toca hasta que esto ha
 * dicho que sí — que es la mitad del encargo: un fichero que el códec no entiende tiene que
 * salir por la puerta del mensaje, no dejar media partida puesta.
 *
 * ⚠ Y NO ES PURA, aunque lo parezca por la firma: para el `.gam` sin cabecera pide dos
 * rótulos a `txt()`, que resuelve el idioma leyendo de `window`. Se dice porque no se ve, y
 * porque quien la mida sin un DOM se llevará un `ReferenceError` por esa rama y sólo por esa
 * (le pasó al arnés: por eso monta un jsdom entero y no un `localStorage` de juguete).
 */
export function leeFichero(bytes: Uint8Array): Lectura {
  if (bytes.length < SAVED_GAM_SIZE) {
    return { ok: false, motivo: "corto", detalle: `${bytes.length} B` };
  }
  const gam = bytes.slice(0, SAVED_GAM_SIZE);
  const malo = validaVentana(gam);
  if (malo) return { ok: false, motivo: "no-es-partida", detalle: malo };

  // ── el SOBRE, si lo hay ───────────────────────────────────────────────────────────────
  // Los tres estados los distingue `readU5gamEnvelope` (`core/u5gam.ts`), que es el ÚNICO
  // sitio donde vive la marca; aquí sólo se traducen a las dos degradaciones que esta
  // pantalla sabe contar. 🔴 Cola SIN marca = `.gam` pelado (con o sin basura detrás), y se
  // trata como el caso del DOS y NO como un error: los 4192 B ya han pasado la validación
  // estructural, que es lo que decide si esto es una partida.
  const leido = readU5gamEnvelope(bytes);
  const sobre: Sobre | null = leido.kind === "ok" ? leido.envelope : null;
  let degradado: "sin-sobre" | "sobre-ilegible" | null = null;
  if (leido.kind === "none") degradado = "sin-sobre";
  else if (leido.kind === "bad") degradado = "sobre-ilegible";

  // Sidecar vacío = el mismo que usan las OTRAS dos puertas de importación. Ya no se calca
  // el literal: lo sirve `emptySidecar()` para que las tres no puedan divergir (#229).
  const sidecar: SaveSidecar = sobre?.sidecar ?? emptySidecar();

  let state: GameState;
  try {
    state = importNativeSave(gam, sidecar);
    // ★ Y EL VALIDADOR QUE YA EXISTE, por el camino que ya existe: `deserialize` corre
    // `assertValidState`, el «esquema mínimo del camino no confiable» (`state.ts:726`).
    // Reimplementarlo aquí sería tener dos predicados de lo mismo, que pueden divergir.
    //
    // ⚠ HONESTAMENTE: NO CONOZCO UNA ENTRADA QUE LO DISPARE. Lo intenté. Todo lo que
    // `assertValidState` mira (roster, `partySize`, posición, fecha, cantidades) sale de los
    // BYTES, y ésos ya pasaron por `validaVentana`; lo que viene del sobre son campos que ese
    // validador no toca —de ahí `sidecarSano`, arriba, que sí es la guarda con dientes—. Se
    // conserva igual y no como adorno: es la puerta ESTÁNDAR del camino no confiable en este
    // repositorio, cuesta un `JSON.parse` una vez al importar, y el día que el códec cambie
    // será la que avise. Si alguien encuentra la entrada que la dispara, que la meta en el
    // arnés; mientras tanto queda dicho que su cobertura es CERO y por qué.
    state = deserialize(serialize(state));
  } catch (e) {
    return { ok: false, motivo: "codec", detalle: e instanceof Error ? e.message : String(e) };
  }

  const meta: Sobre["meta"] = sobre?.meta ?? {
    name: txt("importaNombrePorDefecto"),
    // Sin sobre no hay nombre de lugar y NO se inventa uno: los nombres de sitio viven en
    // `data.json`, o sea en la extracción del visitante. Se dice que no se sabe.
    locationName: txt("importaLugarDesconocido"),
    turns: state.turnsSinceStart,
    timestamp: Date.now(),
  };
  return { ok: true, state, meta, degradado };
}

/**
 * Lee el fichero e INSTALA la partida. Devuelve el id de la ranura nueva, o el rechazo.
 * Separada de `leeFichero` por la misma razón que `siembraMomento` está separada de la
 * descarga: la mitad que se puede medir sin navegador se mide sin navegador.
 */
export function instalaFichero(bytes: Uint8Array):
  | { ok: true; id: string; degradado: Degradacion }
  | { ok: false; motivo: MotivoRechazo | "almacen"; detalle?: string } {
  const l = leeFichero(bytes);
  if (!l.ok) return l;
  const r = installImportedSave(l.state, l.meta.name, l.meta.locationName, l.meta.provenance);
  if (!r.ok) return { ok: false, motivo: "almacen", detalle: r.reason };
  return { ok: true, id: r.meta.id, degradado: l.degradado };
}

// ══ LA PANTALLA ═════════════════════════════════════════════════════════════════════════

function el(tag: string, cls: string, texto?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

/**
 * Cuelga el botón DESCARGAR de cada tarjeta y el bloque IMPORTAR al final de la lista.
 *
 * ── EL ENGANCHE ES UN `data-partida` Y NO EL ORDEN ─────────────────────────────────────
 * 🔴 Las tarjetas se localizan por `[data-partida]`, que `partidas.ts` pone con el id de la
 * ranura. La alternativa —recorrer las tarjetas en paralelo con el inventario— habría atado
 * este módulo al ORDEN de pintado, y ahí el fallo no es un error: es un botón que descarga la
 * partida de al lado. Un atributo cuesta una línea en el fichero ajeno y no puede desalinearse.
 *
 * ── Y ES IDEMPOTENTE A MANO, aunque `pintaPartidas` vacíe su raíz antes de repintar ────
 * 🔴 Porque el enganche es un `import()` y eso abre una VENTANA: dos repintados seguidos
 * (cambiar de idioma justo después de cargar) dejan DOS llamadas en vuelo, y la segunda se
 * encuentra el DOM que montó la primera — que ya no está vacío. Sin esta retirada saldrían
 * dos bloques de importar y dos botones «Descargar» por tarjeta. Se desmonta lo anterior en
 * vez de comprobar «¿ya estaba?»: la comprobación dejaría los botones de la llamada VIEJA,
 * que pueden llevar el inventario viejo.
 */
export function montaTransferencia(raiz: HTMLElement, inv: SaveMeta[]): void {
  desmonta(raiz);
  const porId = new Map(inv.map((m) => [m.id, m]));
  for (const li of raiz.querySelectorAll<HTMLElement>("[data-partida]")) {
    const meta = porId.get(li.dataset.partida ?? "");
    if (!meta) continue;
    li.appendChild(cajaDeAcciones(li, meta));
  }
  // ── DÓNDE SE CUELGA, Y POR QUÉ NO AL FINAL ────────────────────────────────────────────
  // 🔴 Iba `appendChild` a la raíz, o sea DETRÁS de las repeticiones — y eso lo dejaba a
  // ~1.630 px del principio en un documento de 2.379 (medido en 1280×900, visitante nuevo),
  // con el bloque entero de repeticiones (su explicación de qué son, su lista y su párrafo
  // de privacidad) entre el lector y el importador. La sección de PARTIDAS es de lo que
  // esto habla, así que va pegado a ella. Se ancla en la clase `--partidas` y no en el
  // índice del hijo: ver la razón en `partidas.ts`.
  const partidas = raiz.querySelector(".guardados--partidas");
  const bloque = bloqueImportar();
  if (partidas?.nextSibling) raiz.insertBefore(bloque, partidas.nextSibling);
  else raiz.appendChild(bloque); // sin ancla (o siendo la última) el final es el sitio bueno
}

/**
 * Retira un montaje anterior DEJANDO LA TARJETA COMO ESTABA: el enlace «Continuar» que se
 * había movido dentro de la caja de acciones vuelve al `<li>`. Devolverlo importa — es el
 * nodo de `partidas.ts`, con su escuchador del popover encima, y tirarlo con la caja dejaría
 * tarjetas sin acción hasta el siguiente repintado completo.
 */
function desmonta(raiz: HTMLElement): void {
  raiz.querySelector(".importa")?.remove();
  for (const caja of raiz.querySelectorAll<HTMLElement>(".guardado__acciones")) {
    const enlace = caja.querySelector<HTMLAnchorElement>("a.guardado__accion");
    if (enlace && caja.parentElement) caja.parentElement.appendChild(enlace);
    caja.remove();
  }
}

/**
 * La columna de acciones de la tarjeta: «Continuar» (si estaba) + «Descargar».
 *
 * La rejilla de la tarjeta tiene UN área para la acción (`byo.html`, `grid-template-areas:
 * "media info accion"`) y dos elementos en la misma área se superpondrían, así que se envuelve
 * el enlace que ya había en un contenedor que ocupa esa área. Si el enlace no está —sin copia
 * del juego, `partidas.ts` no lo pinta— el contenedor lleva sólo el botón: **descargar una
 * partida NO necesita la extracción** (ver `plantilla()`), y es justo el caso de quien ha
 * perdido su caché y quiere rescatar lo suyo.
 */
function cajaDeAcciones(li: HTMLElement, meta: SaveMeta): HTMLElement {
  const caja = el("div", "guardado__acciones");
  const enlace = li.querySelector<HTMLAnchorElement>("a.guardado__accion");
  if (enlace) caja.appendChild(enlace); // mover, no clonar: el escuchador del popover viaja con él
  const b = document.createElement("button");
  b.type = "button";
  b.className = "guardado__accion guardado__descarga";
  b.textContent = txt("partidaDescargar");
  b.addEventListener("click", () => {
    b.disabled = true;
    b.textContent = txt("partidaDescargando");
    void descargaPartida(meta)
      .then((nombre) => {
        // 🔴 EL NOMBRE DEL FICHERO SE ENSEÑA —en el móvil la descarga cae en una carpeta que
        // no se ve, y saberlo es la diferencia entre encontrarlo y darlo por perdido— PERO NO
        // DENTRO DEL BOTÓN. La columna de acciones mide 93 px en escritorio: un nombre de 34
        // caracteres ahí dentro se parte en cinco líneas y estira la tarjeta entera. El aviso
        // va a la columna de INFORMACIÓN, que es la ancha (`minmax(0, 1fr)`), y el botón se
        // queda diciendo lo que hace. Un botón cuyo rótulo cambia a una frase deja de ser un
        // botón que se puede volver a pulsar.
        avisa(li, nombre ? txt("partidaDescargada", { f: nombre }) : txt("partidaDescargaFallo"), !nombre);
      })
      .catch(() => {
        avisa(li, txt("partidaDescargaFallo"), true);
      })
      .finally(() => {
        b.disabled = false;
        b.textContent = txt("partidaDescargar");
      });
  });
  caja.appendChild(b);
  return caja;
}

/**
 * Pone (o reemplaza) el aviso de la tarjeta, al final de su columna de información.
 * Reemplaza en vez de acumular: dos descargas seguidas dejan un aviso, no dos.
 */
function avisa(li: HTMLElement, texto: string, mal: boolean): void {
  const destino = li.querySelector(".guardado__info") ?? li;
  destino.querySelector(".guardado__aviso")?.remove();
  const s = el("small", "guardado__aviso" + (mal ? " guardado__aviso--mal" : ""), texto);
  destino.appendChild(s);
}

/**
 * El bloque IMPORTAR: un `<label>` con su `<input type=file>` de verdad, y toda la caja como
 * zona de soltado.
 *
 * 🔴 UN `<input type="file">` NATIVO DENTRO DE UN `<label>`, y no un botón que lo dispara por
 * JS. El input nativo trae el teclado (Enter y Espacio abren el diálogo), el nombre accesible,
 * el foco y el soporte de móvil; el `<label>` hace que TODA la caja sea la diana sin
 * reimplementar nada. El arrastrar-y-soltar es un AÑADIDO encima, no la única vía: en un
 * teléfono no hay arrastre, y una zona de soltado sin picker deja fuera a quien más lo
 * necesita. Mismo criterio que la portada, que también acepta las dos.
 */
function bloqueImportar(): HTMLElement {
  const sec = el("section", "importa");
  sec.appendChild(el("h3", "guardados__titulo", txt("importaTitulo")));
  sec.appendChild(el("p", "guardados__que", txt("importaQue")));
  // Dónde vive la EXPORTACIÓN. Va aquí y no en la sección de partidas porque es la frase que
  // contesta a quien viene buscando «exportar» — y tiene que estar TAMBIÉN cuando la lista
  // está vacía, que es justo cuando no hay ningún botón «Descargar» que mirar (#229).
  sec.appendChild(el("p", "guardados__nota", txt("importaExportaDonde")));
  // El ALCANCE del formato, dicho donde se usa (#266): .u5gam es OpenU5↔OpenU5 y NO
  // alimenta al Ultima V original de DOS/DOSBox. Sin esta línea, «te da un fichero» de
  // arriba deja creer que el fichero sirve también allí.
  sec.appendChild(el("p", "guardados__nota", txt("importaFormatoAlcance")));

  const zona = document.createElement("label");
  zona.className = "importa__zona";
  const input = document.createElement("input");
  input.type = "file";
  input.className = "importa__input";
  // Se aceptan las dos extensiones Y el tipo genérico: un `.gam` del DOS puede llegar con
  // cualquier nombre, y `accept` es una sugerencia del picker, nunca la validación (la
  // validación son los bytes, en `leeFichero`).
  input.accept = ".u5gam,.gam,application/octet-stream";
  zona.append(input, el("span", "importa__rotulo", txt("importaSuelta")));

  const aviso = el("p", "importa__aviso");
  sec.append(zona, aviso);

  const traga = (f: File | undefined): void => {
    if (!f) return;
    aviso.className = "importa__aviso";
    aviso.textContent = txt("importaLeyendo");
    void procesa(f, aviso);
  };
  input.addEventListener("change", () => {
    traga(input.files?.[0]);
    input.value = ""; // el mismo fichero dos veces seguidas tiene que volver a disparar `change`
  });
  // Arrastrar: hay que cancelar `dragover` o el navegador ABRE el fichero y se lleva la
  // página por delante — con la partida a medio importar y sin aviso ninguno.
  zona.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    zona.classList.add("importa__zona--encima");
  });
  zona.addEventListener("dragleave", () => zona.classList.remove("importa__zona--encima"));
  zona.addEventListener("drop", (ev) => {
    ev.preventDefault();
    zona.classList.remove("importa__zona--encima");
    traga(ev.dataTransfer?.files?.[0]);
  });
  return sec;
}

/** Lee el fichero soltado, lo instala y cuenta lo que ha pasado. Nunca lanza. */
async function procesa(f: File, aviso: HTMLElement): Promise<void> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await f.arrayBuffer());
  } catch {
    aviso.className = "importa__aviso importa__aviso--mal";
    aviso.textContent = txt("importaFalloLectura");
    return;
  }
  const r = instalaFichero(bytes);
  if (!r.ok) {
    // 🔴 CADA MOTIVO CON SU FRASE, no un «algo salió mal». Los tres mandan a sitios
    // distintos: «corto» es que has soltado otra cosa, «no-es-partida» es que el fichero no
    // tiene dentro una partida (o está dañado), y «codec»/«almacen» son de este navegador.
    // Colapsarlos mandaría a la mitad de la gente a mirar donde no está el problema — el
    // mismo criterio que separa los cinco estados de carga de `main.ts`.
    aviso.className = "importa__aviso importa__aviso--mal";
    aviso.textContent = txt("importaRechazo_" + r.motivo, { detalle: r.detalle ?? "" });
    return;
  }
  aviso.className = "importa__aviso importa__aviso--bien";
  // La degradación se DICE, y se dice qué falta: una partida sin sobre entra completa en
  // cuanto a bytes del `.gam` y coja en todo lo que el formato de 1988 no guarda. Quien la
  // importe tiene que saberlo ANTES de jugar cuarenta horas encima.
  aviso.textContent =
    r.degradado === null
      ? txt("importaHecho")
      : txt(r.degradado === "sin-sobre" ? "importaHechoSinSobre" : "importaHechoSobreRoto");
  // La lista se repinta desde el almacén (main.ts escucha este evento): la partida nueva
  // tiene que aparecer sin recargar. Se dispara ANTES de la captura porque la captura tarda
  // ~2 s y la tarjeta no depende de ella (cae al minimapa, como las de los momentos).
  window.dispatchEvent(new Event("openu5:partidas"));
  const conFoto = await generaCaptura(r.id).catch(() => false);
  if (conFoto) window.dispatchEvent(new Event("openu5:partidas"));
  // Si no hubo foto no se dice nada: es un adorno, y la tarjeta ya tiene su respaldo.
}
